# 02 - 同步流程详解

> 本文档像讲故事一样，带你走遍 QuantaNote 的每一个同步场景。
> 每个场景都配有流程图和具体步骤，读完你就知道"同步"到底做了什么。

---

## 场景 1：首次同步

**背景**：你在电脑 A 上用 QuantaNote 写了很多笔记，现在想在一台新电脑 B 上也能看到。你在 B 上登录了同步账号，点"立即同步"。

### 流程图

```
设备 B（刚登录）                    同步服务器                    设备 A（已有数据）
     │                                │                              │
     │  ① 获取最新快照                  │                              │
     │ ──────────────────────────────► │                              │
     │  ← 返回：快照 ID + 记录列表      │                              │
     │                                │                              │
     │  ② 收集本地记录（空）             │                              │
     │                                │                              │
     │  ③ 加载基线（空）                │                              │
     │                                │                              │
     │  ④ 三方 Diff                    │                              │
     │  本地=空, 远程=有数据             │                              │
     │  → 全部需要拉取                  │                              │
     │                                │                              │
     │  ⑤ 拉取所有远程记录              │                              │
     │ ──────────────────────────────► │                              │
     │  ← 返回：全部记录数据            │                              │
     │                                │                              │
     │  ⑥ 写入本地数据库                │                              │
     │  ⑦ 下载附件                     │                              │
     │  ⑧ 提交同步 → 服务器创建新快照    │                              │
     │  ⑨ 保存基线（记录所有 hash）      │                              │
     ▼                                ▼                              ▼
```

### 逐步讲解

**步骤 1：获取服务器最新快照**

代码位置：`src-tauri/src/sync/transport.rs` → `get_latest_snapshot()`

同步引擎向服务器发请求："你那边最新的快照是什么？" 服务器返回快照 ID、记录数量等信息。

**步骤 2：收集本地记录**

代码位置：`src-tauri/src/sync/diff.rs` → `collect_local_records()`

从本地 SQLite 数据库读取 5 张表（items、tags、item_tags、versions、attachments）的所有记录，加上 tombstones（墓碑），给每条记录计算一个 SHA-256 哈希值。

**步骤 3：获取远程记录元信息**

代码位置：`src-tauri/src/sync/transport.rs` → `get_snapshot_records()`

获取服务器快照中所有记录的元信息（table_name、record_id、content_hash、updated_at）。注意：这里只拿元信息（不含具体内容），用来做比对。

**步骤 4：加载基线**

代码位置：`src-tauri/src/sync/mod.rs` → `load_baseline_map()`

从本地 `sync_baseline` 表读取上次同步时每条记录的 hash 值。首次同步时，这个表是空的。

**步骤 5：三方 Diff（比对差异）**

代码位置：`src-tauri/src/sync/diff.rs` → `compute_diff()`

核心算法。对于每条记录，比较三方：

| 本地 hash | 远程 hash | 基线 hash | 判定 | 动作 |
|-----------|-----------|-----------|------|------|
| 有 | 无 | 无 | 本地独有 | 推送到服务器 |
| 无 | 有 | 无 | 远程独有 | 从服务器拉取 |
| 有 | 有 | 相同且都等于当前 | 无变化 | 跳过 |
| 有 | 有 | 本地≠基线，远程=基线 | 本地独改 | 推送 |
| 有 | 有 | 本地=基线，远程≠基线 | 远程独改 | 拉取 |
| 有 | 有 | 两端都≠基线，hash不同 | 冲突 | 按策略处理 |

首次同步时，基线为空，所以：远程有的记录（设备 A 上传的）判定为"远程独有"，全部拉取。

**步骤 6：拉取并写入本地**

代码位置：`src-tauri/src/commands/sync.rs` → `apply_pulled_records()`

从服务器拿到完整的记录数据（JSON），按依赖顺序写入本地数据库：
- 先写 `items`（笔记本身）
- 再写 `tags`（标签）
- 再写 `item_tags`（关联关系，依赖 items 和 tags）
- 再写 `versions`（版本，依赖 items）
- 最后写 `attachments`（附件，依赖 items）

**步骤 7：保存基线**

代码位置：`src-tauri/src/sync/mod.rs` → `save_baseline_map()`

把当前每条记录的 hash 写入 `sync_baseline` 表。下次同步时，就拿这个当"上次拍了什么照片"来对比。

---

## 场景 2：增量同步

**背景**：你在设备 A 上新建了一条笔记，设备 B 点"立即同步"。

### 三方 Diff 详解

假设有记录 X：

| 时刻 | 本地（设备 B） | 远程（服务器） | 基线（上次同步时） |
|------|--------------|--------------|------------------|
| 上次同步后 | X 的 hash = `aaa` | X 的 hash = `aaa` | `aaa` |
| 设备 A 修改后 | — | X 的 hash = `bbb` | — |
| 设备 B 同步时 | `aaa` | `bbb` | `aaa` |

判定过程：
- 本地 hash (`aaa`) == 基线 hash (`aaa`) → 本地没改
- 远程 hash (`bbb`) ≠ 基线 hash (`aaa`) → 远程改了
- 结论：**远程独改 → 拉取**

### 流程

```
1. 获取最新快照        → 服务器的快照 ID 可能变了（因为设备 A 同步过了）
2. 收集本地记录        → 设备 B 当前的所有记录和 hash
3. 获取远程记录元信息   → 服务器上所有记录的 hash
4. 加载基线           → 上次同步时的 hash 映射
5. 三方 Diff          → 算出哪些需要推送、拉取、冲突
6. 推送（如果本地有改）  → 把本地修改的记录推到服务器
7. 拉取（如果远程有改）  → 把远程修改的记录拉到本地
8. 同步附件           → 上传新附件 / 下载新附件
9. 提交同步           → 服务器创建新快照
10. 保存基线          → 更新本地基线
```

---

## 场景 3：冲突处理

**背景**：你在设备 A 和设备 B 上都修改了同一条笔记，但没有同步过。

### 三方 Diff 如何发现冲突

| 时刻 | 本地（设备 B） | 远程（服务器） | 基线 |
|------|--------------|--------------|------|
| 上次同步后 | hash = `aaa` | hash = `aaa` | `aaa` |
| 设备 A 改了 | — | hash = `bbb` | — |
| 设备 B 也改了 | hash = `ccc` | `bbb` | `aaa` |

判定：
- 本地 (`ccc`) ≠ 基线 (`aaa`) → 本地改了
- 远程 (`bbb`) ≠ 基线 (`aaa`) → 远程改了
- 本地 (`ccc`) ≠ 远程 (`bbb`) → 内容不同
- 结论：**冲突！**

### 四种冲突策略

#### 3.1 自动策略（`auto`）

比较时间戳，新的赢：

```
本地更新时间: 2024-01-01 14:00
远程更新时间: 2024-01-01 13:00
→ 本地更新 → 用本地版本（推送本地到服务器）
```

如果时间解析失败，用 hash 字典序做确定性 tie-breaker（保证结果一致）。

#### 3.2 本地优先（`local-wins`）

冲突时总是用本地版本（推送到服务器，覆盖远程）。

#### 3.3 远程优先（`remote-wins`）

冲突时总是用远程版本（拉取到本地，覆盖本地）。

#### 3.4 手动模式（`manual`）

**这是最有趣的模式**。当检测到冲突时，同步不会自动解决，而是：

```
1. 同步引擎检测到冲突
2. 暂停同步，把冲突信息返回给前端
3. 前端弹出冲突解决弹窗
4. 用户逐条选择"用本地版本"或"用远程版本"
5. 用户点"应用"后，按选择完成同步
```

用户看到的界面（`ConflictResolutionModal`）：
- 每条冲突显示：表名、记录 ID、本地更新时间、远程更新时间
- 两个单选按钮："本地"和"远程"
- 批量操作："全选本地"、"全选远程"
- 确认按钮："应用解决"

---

## 场景 4：删除同步（墓碑机制）

**问题**：你在设备 A 上删除了一条笔记，同步后设备 B 应该也删掉它。但如何区分"这条记录不存在"和"这条记录被删除了"？

**答案**：墓碑（Tombstone）。

### 删除流程

```
用户在设备 A 删除一条笔记
    │
    ▼
item_repository.rs → delete() 函数：
    1. 写入 tombstone：INSERT INTO sync_tombstones (record_id='xxx', table_name='items', deleted_at='...')
    2. 硬删除记录：DELETE FROM items WHERE id = 'xxx'
    │
    ▼
下次同步时：
    collect_local_records() 会读取 tombstones 表
    把每条 tombstone 包装成一条带 _deleted=true 标记的记录
    计算这条"删除记录"的 hash
    │
    ▼
三方 Diff 发现：
    本地有这条记录（带 _deleted=true）
    远程没有 → 推送到服务器
    │
    ▼
设备 B 同步时：
    拉取到这条 _deleted=true 的记录
    apply_item() 看到 _deleted=true → 执行本地删除 + 写 tombstone
    │
    ▼
两个设备上的记录都消失了 ✓
```

### 墓碑清理

墓碑不会永远保留。每次保存基线时，会自动清理 90 天前的旧墓碑：

```rust
// src-tauri/src/sync/mod.rs → save_baseline_map()
let cutoff = (chrono::Utc::now() - chrono::Duration::days(90)).to_rfc3339();
tx.execute("DELETE FROM sync_tombstones WHERE deleted_at < ?1", ...);
```

90 天足够覆盖大多数离线场景——如果你离线超过 90 天，墓碑被清理后，已删除的记录可能不会传播到其他设备。

---

## 场景 5：附件同步

附件（图片、文件等）比文字记录复杂，因为它们是二进制文件，体积大。

### 上传阶段（在 commit 之前）

```
1. 收集本地所有附件文件
2. 计算每个附件的 SHA-256 hash
3. 把所有 hash 发给服务器：diff_attachments(hashes)
4. 服务器返回"我缺少哪些 hash"（missing 列表）
5. 只上传服务器缺少的附件（用 "pending" 作为临时 snapshot_id）
```

**为什么不一次性全上传？** 因为可能服务器已经有了相同的文件（hash 相同），没必要重复传。

### 下载阶段（在 commit 之后）

```
1. 再次调用 diff_attachments() 获取服务器上所有附件列表
2. 对比本地：
   - 本地没有这个附件 → 下载
   - 本地有但 hash 不匹配（文件损坏） → 重新下载
   - 本地有且 hash 匹配 → 跳过
3. 下载后验证 hash（确保传输没有出错）
4. 写入本地文件系统
```

### 为什么上传在 commit 前、下载在 commit 后？

```
时间线：
上传附件 → 推送记录 → commit（服务器创建新快照）→ 下载附件

- 上传在前：附件先传到服务器的"暂存区"（pending），commit 时正式归入新快照
- 下载在后：commit 后新快照已经确定，此时下载的附件是最新的
```

---

## 附录：同步引擎主流程（代码视角）

代码位于 `src-tauri/src/commands/sync.rs` → `run_sync_with_transport()`

```
fn run_sync_with_transport():
    ① state_manager.set_status(Preparing)
    ② remote_snapshot = transport.get_latest_snapshot()
    ③ local_records = collect_local_records(db)
    ④ remote_metas = transport.get_snapshot_records(snapshot_id)
    ⑤ baseline_map = load_baseline_map(db)
    ⑥ diff_result = compute_diff(local_records, remote_metas, baseline_map, strategy)

    ⑦ if manual 模式 && 有冲突:
         return (暂停，等用户选择)

    ⑧ 推送: transport.push_records(diff_result.to_push)
    ⑨ 拉取: transport.pull_records() → apply_pulled_records()
    ⑩ 上传附件: sync_attachments_upload()
    ⑪ 提交: transport.commit_sync()
    ⑫ 下载附件: sync_attachments_download()
    ⑬ 保存基线: save_baseline_map()
    ⑭ state_manager.set_completed()
```

---

> 下一站：[03-frontend-code-walkthrough.md](./03-frontend-code-walkthrough.md) — 看看前端代码怎么实现这些流程
