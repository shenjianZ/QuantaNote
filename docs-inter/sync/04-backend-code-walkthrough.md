# 04 - 客户端后端代码讲解（Rust / Tauri）

> 本文档逐模块讲解 QuantaNote 客户端的 Rust 同步代码。
> 这是 Tauri 应用的"后端"——运行在桌面进程中的 Rust 代码。
> 假设你了解基本的 Rust 语法，但不熟悉这个项目的同步实现。

---

## 模块结构

```
src-tauri/src/
├── commands/sync.rs    ← 命令层：接收前端调用，编排同步流程
├── sync/
│   ├── mod.rs          ← 同步引擎：记录应用（apply）、基线读写
│   ├── diff.rs         ← 三方 Diff 算法：收集记录、比对差异、发现冲突
│   ├── transport.rs    ← HTTP 通信：请求服务器、重试、Token 刷新
│   └── state.rs        ← 状态管理：实时向前端推送同步进度
├── models/sync.rs      ← 数据模型：所有同步相关的 struct
├── repositories/       ← 数据仓库：删除时写墓碑
└── db/mod.rs           ← 数据库表结构
```

---

## 模块 1：`models/sync.rs` — 数据模型

所有同步相关的数据结构定义在这里。先看这个文件，因为其他模块都在用这些类型。

### SyncConfig — 同步配置

```rust
pub struct SyncConfig {
    pub enabled: bool,                    // 是否启用
    pub server_url: String,               // 服务器地址
    pub access_token: String,             // 访问令牌
    pub refresh_token: String,            // 刷新令牌
    pub user_id: String,                  // 用户 ID
    pub device_id: String,                // 设备 ID（每台电脑唯一）
    pub auto_sync: bool,                  // 自动同步
    pub sync_interval_minutes: u32,       // 间隔（分钟）
    pub conflict_resolution: String,      // 冲突策略
    pub sync_attachments: bool,           // 同步附件
    pub last_sync_at: Option<String>,     // 上次同步时间
    pub last_snapshot_id: Option<String>, // 上次快照 ID
}
```

**存储位置**：SQLite 的 `settings` 表，key = `quantanote-sync-config`，value = JSON 字符串。

### SyncState — 同步状态

```rust
pub struct SyncState {
    pub status: SyncStatus,        // 当前状态枚举
    pub progress: Option<SyncProgress>, // 进度（阶段、当前、总数）
    pub last_error: Option<String>,    // 最后的错误
    pub last_sync_at: Option<String>,  // 最后同步时间
}

pub enum SyncStatus {
    Idle,              // 空闲
    Preparing,         // 准备中
    Pushing,           // 推送中
    Pulling,           // 拉取中
    SyncingAttachments,// 同步附件中
    Completed,         // 完成
    Error,             // 错误
}
```

**这个状态是实时的**：Rust 后端每改变状态，就通过 Tauri 事件推送到前端。

### SyncRecordPayload — 同步记录

```rust
pub struct SyncRecordPayload {
    pub table_name: String,       // 表名（items/tags/...）
    pub record_id: String,        // 记录 ID
    pub content_hash: String,     // SHA-256 哈希
    pub updated_at: String,       // 更新时间
    pub data: serde_json::Value,  // 记录的完整 JSON 数据
}
```

这是同步中传输的基本单位。每条记录（笔记、标签等）都会被包装成这个格式。

### ConflictInfo — 冲突信息

```rust
pub struct ConflictInfo {
    pub record_id: String,
    pub table_name: String,
    pub local_data: serde_json::Value,  // 本地版本的数据
    pub local_updated_at: String,       // 本地更新时间
    pub remote_updated_at: String,      // 远程更新时间
    pub content_hash: String,           // 内容哈希
}
```

这个结构传给前端，用于冲突解决弹窗中显示信息。

### PendingSyncState — 暂停状态

```rust
pub struct PendingSyncState {
    pub pushed_records: Vec<PushedRecord>,  // 已推送的记录
    pub conflicts: Vec<ConflictInfo>,       // 冲突列表
    pub to_push: Vec<SyncRecordPayload>,    // 非冲突的待推送
    pub to_pull: Vec<RecordMetaInfo>,       // 非冲突的待拉取
}
```

manual 模式下，同步暂停时把这些状态保存在内存中。等用户选择后，用这些信息继续同步。

---

## 模块 2：`sync/state.rs` — 状态管理器

### 作用

实时向前端推送同步进度。每次状态变化，都通过 Tauri 事件通知前端。

### 核心：SyncStateManager

```rust
pub struct SyncStateManager {
    state: Arc<Mutex<SyncState>>,  // 线程安全的状态
    app_handle: Option<AppHandle>, // Tauri 应用句柄（用来发事件）
}
```

### 方法

| 方法 | 作用 |
|------|------|
| `set_status(status)` | 设置状态（如 Pushing、Pulling），并推送到前端 |
| `set_progress(phase, current, total)` | 设置进度（如"推送记录 3/10"），并推送到前端 |
| `set_error(error)` | 设置错误状态，并推送到前端 |
| `set_completed()` | 设置完成状态，并推送到前端 |
| `clear_progress()` | 清除进度 |

### 事件推送机制

```rust
fn emit_state(&self, state: &SyncState) {
    if let Some(ref handle) = self.app_handle {
        let _ = handle.emit("sync-state-changed", state);
    }
}
```

前端通过 `listen("sync-state-changed", ...)` 接收这些事件。

---

## 模块 3：`sync/diff.rs` — 三方 Diff 算法

这是同步最核心的模块。

### compute_record_hash() — 计算记录哈希

```rust
pub fn compute_record_hash(data: &serde_json::Value) -> String {
    let json_str = serde_json::to_string(data).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(json_str.as_bytes());
    format!("{:x}", hasher.finalize())
}
```

把一条记录的 JSON 序列化成字符串，然后算 SHA-256。**只要内容有一丁点不同，哈希就完全不同。**

### collect_local_records() — 收集本地所有记录

```rust
pub fn collect_local_records(db: &DbState) -> Result<Vec<SyncRecordPayload>, AppError>
```

这个函数做了什么：
1. 查询 `items` 表 → 每条记录转成 JSON，算 hash
2. 查询 `tags` 表 → 用 `uuid` 作为记录 ID
3. 查询 `item_tags` 表 → 用 `item_id_tag_uuid` 作为记录 ID
4. 查询 `attachments` 表 → 每条记录转成 JSON
5. 查询 `versions` 表 → 每条记录转成 JSON
6. 查询 `sync_tombstones` 表 → 每条墓碑转成带 `_deleted: true` 的 JSON
7. 去重：如果同一条记录既有活数据又有墓碑，优先保留活数据

**为什么 tags 用 uuid？** 因为 tags 表的主键是自增 ID，在不同设备上 ID 不一样。UUID 是全局唯一的，适合做同步标识。

### compute_diff() — 三方比较

```rust
pub fn compute_diff(
    local_records: &[SyncRecordPayload],    // 本地所有记录
    remote_metas: &[RecordMetaInfo],         // 远程所有记录的元信息
    baseline_map: &HashMap<String, String>,  // 基线（上次同步时的 hash）
    conflict_strategy: &str,                 // 冲突策略
) -> DiffResult
```

**算法**：

```
对于每条记录（用 "表名:记录ID" 作为唯一标识）：

1. 本地有、远程没有 → 推送到服务器（to_push）
2. 本地没有、远程有 → 从服务器拉取（to_pull）
3. 两端都有：
   a. 都没变（hash 都等于基线） → 无变化（unchanged）
   b. 只有本地变了 → 推送
   c. 只有远程变了 → 拉取
   d. 两端都变了：
      - hash 相同 → 同样的修改，无变化
      - hash 不同 → 冲突！按策略处理：
        · local-wins → 推送本地版本
        · remote-wins → 拉取远程版本
        · auto → 比时间戳，新的赢
```

**auto 策略的时间比较**：
```rust
match (local_time, remote_time) {
    (Some(lt), Some(rt)) => {
        if lt >= rt { ConflictResolution::LocalWins }
        else { ConflictResolution::RemoteWins }
    }
    // 时间解析失败 → 用 hash 字典序做确定性 tie-breaker
    _ => {
        if l.content_hash >= r.content_hash { LocalWins }
        else { RemoteWins }
    }
}
```

---

## 模块 4：`sync/transport.rs` — HTTP 通信层

### 作用

封装所有和同步服务器的 HTTP 通信。自动处理认证、重试、Token 刷新。

### SyncTransport 结构

```rust
pub struct SyncTransport {
    client: Client,                              // reqwest HTTP 客户端
    server_url: String,                          // 服务器地址
    access_token: Arc<Mutex<String>>,            // 访问令牌（线程安全）
    refresh_token: Arc<Mutex<String>>,           // 刷新令牌
    device_id: String,                           // 设备 ID
    refreshing: Arc<Mutex<bool>>,                // 防止并发刷新
    on_token_refreshed: Option<Arc<TokenRefreshCallback>>,  // 刷新成功回调
}
```

### API 方法一览

| 方法 | HTTP | 路径 | 作用 |
|------|------|------|------|
| `login()` | POST | `/auth/login` | 登录 |
| `register()` | POST | `/auth/register` | 注册 |
| `forgot_password()` | POST | `/auth/forgot-password` | 忘记密码 |
| `reset_password()` | POST | `/auth/reset-password` | 重置密码 |
| `test_connection()` | GET | `/health` | 测试连接 |
| `get_latest_snapshot()` | GET | `/sync/snapshot/latest` | 获取最新快照 |
| `get_snapshot_records()` | GET | `/sync/snapshot/{id}/records` | 获取快照记录 |
| `push_records()` | POST | `/sync/records/push` | 推送记录 |
| `pull_records()` | POST | `/sync/records/pull` | 拉取记录 |
| `diff_attachments()` | POST | `/sync/attachments/diff` | 比对附件 |
| `upload_attachment()` | POST | `/sync/attachments/upload` | 上传附件 |
| `download_attachment()` | GET | `/sync/attachments/download/{id}` | 下载附件 |
| `commit_sync()` | POST | `/sync/commit` | 提交同步 |
| `get_sync_history()` | GET | `/sync/history` | 获取历史 |

### 自动重试机制

```rust
async fn execute_with_retry(&self, req: Request) -> Result<Response, AppError> {
    const MAX_RETRIES: u32 = 3;
    const INITIAL_BACKOFF_MS: u64 = 500;

    for attempt in 0..MAX_RETRIES {
        match self.client.execute(req_clone).await {
            Ok(resp) => {
                if is_retryable_status(resp.status()) && attempt < MAX_RETRIES - 1 {
                    // 指数退避：500ms → 1000ms → 2000ms
                    let backoff = INITIAL_BACKOFF_MS * 2u64.pow(attempt);
                    sleep(backoff).await;
                    continue;
                }
                return Ok(resp);
            }
            Err(e) => {
                if is_retryable_error(&e) && attempt < MAX_RETRIES - 1 {
                    sleep(backoff).await;
                    continue;
                }
                return Err(...);
            }
        }
    }
}
```

**哪些情况会重试？**
- 服务器错误（5xx）
- 请求太频繁（429）
- 网络超时
- 连接失败

### Token 自动刷新

```rust
async fn send_auth_with_refresh(&self, builder: RequestBuilder) -> Result<Response> {
    // 1. 用当前 token 发请求
    let resp = execute_with_retry(req).await?;

    // 2. 如果返回 401（token 过期）
    if resp.status() == 401 {
        // 3. 刷新 token（防止并发刷新）
        refresh_access_token().await?;

        // 4. 用新 token 重新发请求
        let resp2 = execute_with_retry(req2).await?;
        return Ok(resp2);
    }

    Ok(resp)
}
```

**防止并发刷新**：如果多个请求同时发现 token 过期，只刷新一次：

```rust
async fn refresh_access_token(&self) -> Result<()> {
    let mut flag = self.refreshing.lock().await;
    if *flag {
        // 已经有人在刷新了，等待完成
        for _ in 0..50 {
            sleep(100ms).await;
            if !*self.refreshing.lock().await {
                return Ok(());  // 刷新完成了
            }
        }
        return Err("等待 token 刷新超时");
    }
    *flag = true;  // 标记为正在刷新
    // ... 执行刷新 ...
    *flag = false;
}
```

**刷新成功后立即持久化**：通过回调函数，在内存中的 token 更新后，立刻写入 SQLite：

```rust
SyncTransport::new_with_callback(..., Box::new(move |new_access, new_refresh| {
    if let Ok(mut cfg) = shared_cfg_clone.lock() {
        cfg.access_token = new_access;
        cfg.refresh_token = new_refresh;
        let _ = save_sync_config(&db_clone, &cfg);
    }
}));
```

---

## 模块 5：`sync/mod.rs` — 同步引擎

### apply 系列函数

每个函数负责把一条从服务器拉取的记录写入本地数据库。所有函数都有相同的模式：

```
1. 检查 _deleted 标记
   - 如果是删除记录 → 执行本地删除 + 写墓碑
   - 返回

2. 解析 JSON 字段

3. 检查父记录是否存在（附件和版本需要检查对应的 item 是否存在）

4. INSERT ... ON CONFLICT DO UPDATE（upsert）

5. 清理残留的墓碑（如果记录被重新创建了）
```

### apply_item() 示例

```rust
pub fn apply_item(conn: &Connection, data: &serde_json::Value) -> Result<()> {
    let id = data["id"].as_str().unwrap_or_default();

    // 删除标记
    if data["_deleted"].as_bool().unwrap_or(false) {
        conn.execute("DELETE FROM items WHERE id = ?1", ...)?;
        conn.execute("INSERT OR IGNORE INTO sync_tombstones ...", ...)?;
        return Ok(());
    }

    // 正常 upsert
    conn.execute(
        "INSERT INTO items (...) VALUES (...)
         ON CONFLICT(id) DO UPDATE SET ...",
        params![id, title, content, ...],
    )?;

    // 清理残留墓碑
    conn.execute("DELETE FROM sync_tombstones WHERE record_id = ?1 AND table_name = 'items'", ...)?;

    Ok(())
}
```

### load_baseline_map() — 加载基线

```rust
pub fn load_baseline_map(db: &DbState) -> Result<HashMap<String, String>> {
    // SELECT record_id, table_name, content_hash FROM sync_baseline
    // 返回 HashMap<"表名:记录ID", "hash值">
}
```

### save_baseline_map() — 保存基线

```rust
pub fn save_baseline_map(db: &DbState, records: &[SyncRecordPayload], ...) -> Result<()> {
    // 在事务中：
    // 1. 清空旧基线
    // 2. 写入新基线（所有记录的 hash）
    // 3. 清理 90 天前的旧墓碑
}
```

---

## 模块 6：`commands/sync.rs` — Tauri 命令层

这是前端和后端的接口层。每个 `#[tauri::command]` 函数对应前端的一个 `invoke()` 调用。

### SyncEngineState — 全局状态

```rust
pub struct SyncEngineState {
    pub engine: Mutex<SyncEngine>,          // 同步引擎
    pub config: Mutex<SyncConfig>,          // 当前配置
    is_syncing: AtomicBool,                 // 防止并发同步
    pub pending_conflicts: Mutex<Option<PendingSyncState>>,  // manual 模式的暂停状态
}
```

### trigger_sync — 触发同步（主命令）

这是最复杂的命令，完整的同步流程：

```rust
pub async fn trigger_sync(db, sync_state) -> Result<SyncResult> {
    // 1. 防止并发（AtomicBool 交换）
    if sync_state.is_syncing.compare_exchange(false, true, ...).is_err() {
        return Err("同步正在进行中");
    }
    let _guard = SyncGuard(&sync_state.is_syncing);  // RAII 保证退出时清除标记

    // 2. 读取配置
    let config = sync_state.config.lock().unwrap().clone();

    // 3. 创建 transport（带 token 刷新回调）
    let transport = SyncTransport::new_with_callback(...);

    // 4. 执行同步
    let result = run_sync_with_transport(&transport, &state_manager, &config, &db).await?;

    // 5. 更新配置（保存 token、last_sync_at 等）
    save_sync_config(&db, &updated_config)?;

    Ok(result)
}
```

### run_sync_with_transport — 核心同步流程

```rust
async fn run_sync_with_transport(transport, state_manager, config, db) -> Result<SyncOutput> {
    // ① 准备阶段
    state_manager.set_status(SyncStatus::Preparing);
    let remote_snapshot = transport.get_latest_snapshot().await?;
    let local_records = collect_local_records(db)?;
    let remote_metas = transport.get_snapshot_records(&snapshot_id).await?;
    let baseline_map = load_baseline_map(db)?;

    // ② 三方 Diff
    let diff_result = compute_diff(&local_records, &remote_metas, &baseline_map, &config.conflict_resolution);

    // ③ manual 模式有冲突 → 暂停返回
    if config.conflict_resolution == "manual" && !diff_result.conflicts.is_empty() {
        return Ok(SyncOutput { result, pending_state: Some(...) });
    }

    // ④ 推送
    state_manager.set_status(SyncStatus::Pushing);
    transport.push_records(diff_result.to_push).await?;

    // ⑤ 拉取
    state_manager.set_status(SyncStatus::Pulling);
    let pull_result = transport.pull_records(config.last_snapshot_id.as_deref()).await?;
    apply_pulled_records(&pull_result.records, db)?;

    // ⑥ 上传附件
    state_manager.set_status(SyncStatus::SyncingAttachments);
    sync_attachments_upload(transport, state_manager, &mut result, db).await?;

    // ⑦ 提交
    let commit_result = transport.commit_sync(pushed_records, attachment_metas, ...).await?;

    // ⑧ 下载附件
    sync_attachments_download(transport, &mut result, db, &snapshot_id).await?;

    // ⑨ 保存基线
    let final_records = collect_local_records(db)?;
    save_baseline_map(db, &final_records, &snapshot_id)?;

    state_manager.set_completed();
    Ok(SyncOutput { result, pending_state: None })
}
```

### resolve_sync_conflicts — 解决手动冲突

```rust
pub async fn resolve_sync_conflicts(db, sync_state, resolutions) -> Result<SyncResult> {
    // 1. 取出 pending 状态
    let pending = sync_state.pending_conflicts.lock().unwrap().clone()
        .ok_or("没有待解决的冲突")?;

    // 2. 先推送/拉取非冲突记录
    transport.push_records(pending.to_push).await?;
    let pull_result = transport.pull_records(...).await?;
    apply_pulled_records(&pull_result.records, &db)?;

    // 3. 按用户选择逐条处理冲突
    for resolution in &resolutions {
        match resolution.choice.as_str() {
            "local" => {
                // 推送本地版本到服务器
                transport.push_records(vec![payload]).await?;
            }
            "remote" => {
                // 从服务器拉取并写入本地
                let pull_result = transport.pull_records(None).await?;
                let matching = pull_result.records.into_iter()
                    .filter(|r| r.table_name == ... && r.record_id == ...)
                    .collect();
                apply_pulled_records(&matching, &db)?;
            }
        }
    }

    // 4. 上传附件 → 提交 → 下载附件 → 保存基线
    // ...（和主流程相同）

    // 5. 清空 pending 状态
    *sync_state.pending_conflicts.lock().unwrap() = None;

    Ok(result)
}
```

### apply_pulled_records — 应用拉取的记录

```rust
fn apply_pulled_records(records: &[SyncRecordPayload], db: &DbState) -> Result<()> {
    let conn = db.conn.lock()?;
    let tx = conn.unchecked_transaction()?;

    // 按依赖顺序排序：items(0) → tags(1) → item_tags(2) → versions(3) → attachments(4)
    let mut sorted: Vec<&SyncRecordPayload> = records.iter().collect();
    sorted.sort_by_key(|r| table_priority(&r.table_name));

    // 逐条应用
    for record in sorted {
        match record.table_name.as_str() {
            "items" => apply_item(&tx, &record.data)?,
            "tags" => apply_tag(&tx, &record.data)?,
            "item_tags" => apply_item_tag(&tx, &record.data)?,
            "versions" => apply_version(&tx, &record.data)?,
            "attachments" => apply_attachment(&tx, &record.data)?,
            _ => {}
        }
    }

    tx.commit()?;
    Ok(())
}
```

**为什么按依赖顺序排序？** 因为 `item_tags` 引用 `items` 和 `tags`，`versions` 和 `attachments` 引用 `items`。如果先写 `item_tags`，但对应的 `item` 还不存在，数据库会因为外键约束报错（或写入无效数据）。

---

## 数据库表结构

### sync_baseline 表

```sql
CREATE TABLE sync_baseline (
    record_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    synced_at TEXT NOT NULL,
    PRIMARY KEY (record_id, table_name)
);
```

每次同步成功后，把所有记录的 hash 写入这个表。下次同步时，用这些 hash 作为"上次拍了什么照片"的参考。

### sync_tombstones 表

```sql
CREATE TABLE sync_tombstones (
    record_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    PRIMARY KEY (record_id, table_name)
);
```

当记录被删除时，先写入 tombstone，再硬删除记录。这样其他设备同步时能知道"这条记录是被删除的"。

---

> 下一站：[05-server-code-walkthrough.md](./05-server-code-walkthrough.md) — 看看服务器端怎么实现
