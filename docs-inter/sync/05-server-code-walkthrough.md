# 05 - 服务端代码讲解

> 本文档讲解 QuantaNote 的同步服务器（`web-rust-template-project`）中与同步相关的代码。
> 服务端是一个独立的 Rust Web 服务，使用 Axum 框架。

---

## 服务端整体架构

```
HTTP 请求
    │
    ▼
┌─────────────────────────────────────┐
│  handlers/sync.rs                   │  ← API 接口层（路由处理函数）
│  接收请求、解析参数、调用 service     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  services/sync_service.rs           │  ← 业务逻辑层
│  快照管理、记录存取、附件处理、       │
│  Hash 校验、文件移动、快照清理        │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
┌──────────────┐ ┌────────────────┐
│ sync_repo    │ │ StorageBackend │
│ (数据库操作)  │ │ (对象存储)      │
│ MySQL/SQLite │ │ S3/本地/OpenList│
└──────────────┘ └────────────────┘
```

**分层说明**：
- **Handler 层**：薄薄的 HTTP 适配层，只做参数解析和响应格式化
- **Service 层**：真正的业务逻辑
- **Repository 层**：数据库操作（通过 SeaORM）
- **Storage 层**：文件存储（支持 S3、本地文件系统、OpenList）

---

## 数据模型

### 请求 DTO（`domain/dto/sync.rs`）

客户端发给服务器的数据结构：

| 结构体 | 作用 |
|--------|------|
| `PushRecordsRequest` | 推送记录请求，包含 `records` 数组 |
| `SyncRecordPayload` | 单条同步记录（table_name, record_id, content_hash, updated_at, data） |
| `PullRecordsRequest` | 拉取请求，包含可选的 `since_snapshot_id` |
| `AttachmentDiffRequest` | 附件差异请求，包含客户端所有附件的 hash 列表 |
| `CommitSyncRequest` | 提交同步请求，包含推送的记录 ID 列表和附件元数据 |
| `CommitAttachmentMeta` | 单条附件元数据（ID, filename, hash, size 等） |

### 响应 VO（`domain/vo/sync.rs`）

服务器返回给客户端的数据结构：

| 结构体 | 作用 |
|--------|------|
| `SnapshotInfo` | 快照信息（ID, hash, 记录数, 大小, 创建时间） |
| `RecordMetaInfo` | 记录元信息（用于差异比对，不含完整数据） |
| `PushResult` | 推送结果（accepted 列表 + skipped 列表） |
| `PullResult` | 拉取结果（完整记录数据列表 + 快照 ID） |
| `SyncRecordData` | 带完整数据的同步记录 |
| `RemoteAttachmentInfo` | 远程附件信息（用于客户端判断下载哪些） |
| `AttachmentDiffResult` | 附件差异结果（missing + remote_attachments） |
| `CommitResult` | 提交结果（新快照 ID + 创建时间） |
| `PaginatedSyncHistory` | 分页的同步历史 |

---

## API 接口详解

### 1. 获取最新快照 — `GET /sync/snapshot/latest`

**作用**：客户端同步的第一步，获取服务器上最新的快照信息。

**流程**：
```
客户端: "你最新的快照是什么？"
服务器: 从数据库查该用户的最新快照 → 返回 SnapshotInfo
        如果没有快照 → 返回 data: null
```

**代码位置**：`handlers/sync.rs:24` → `services/sync_service.rs:24`

### 2. 获取快照记录 — `GET /sync/snapshot/{snapshot_id}/records`

**作用**：获取某个快照中所有记录的元信息（hash、更新时间），用于三方 diff。

**注意**：只返回元信息，不返回完整的记录数据。完整数据在 pull 时才返回。

**代码位置**：`handlers/sync.rs:41` → `services/sync_service.rs:36`

### 3. 推送记录 — `POST /sync/records/push`

**作用**：接收客户端推送的记录变更。

**流程**：
```
1. 客户端发送记录列表
2. 服务端逐条验证 content_hash（重新算 hash，确认数据完整性）
3. 把记录的 JSON 数据存到对象存储（S3/本地）
4. 把记录元信息写入数据库（snapshot_id = "pending"）
5. 返回 accepted 列表
```

**Hash 校验**：
```rust
// 重新计算 hash，确保数据没在传输中损坏
let computed_hash = {
    let json_str = serde_json::to_string(&record.data).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(json_str.as_bytes());
    format!("{:x}", hasher.finalize())
};
if computed_hash != record.content_hash {
    return Err("记录的 content_hash 不匹配");
}
```

**存储路径**：`{user_id}/pending/{table_name}/{record_id}.json`

**注意**：推送时 snapshot_id 是 `"pending"`（临时），等 commit 时才改为真正的快照 ID。

### 4. 拉取记录 — `POST /sync/records/pull`

**作用**：向客户端提供最新的完整记录数据。 

**流程**：
```
1. 获取用户最新快照
2. 如果客户端传了 since_snapshot_id 且等于最新快照 → 返回空（没有变化）
3. 否则，获取最新快照的所有记录
4. 从对象存储读取每条记录的完整 JSON 数据
5. 返回完整记录列表
```

**关键点**：拉取是**全量**的，不是增量的。客户端拿到所有记录后，自己做三方 diff 决定哪些需要写入。

### 5. 附件差异查询 — `POST /sync/attachments/diff`

**作用**：比对客户端和服务端的附件 hash，找出差异。

**流程**：
```
1. 客户端发送所有本地附件的 hash 列表
2. 服务端查询该用户所有附件
3. 找出：
   - missing: 服务端缺少的 hash（客户端需要上传的）
   - remote_attachments: 服务端已有的附件列表（客户端据此判断需要下载的）
```

**代码逻辑**：
```rust
// 客户端的 hash 集合中，哪些是服务端没有的
let missing: Vec<String> = client_hashes
    .iter()
    .filter(|h| !existing_hashes.contains(h.as_str()))
    .cloned()
    .collect();
```

### 6. 上传附件 — `POST /sync/attachments/upload`

**作用**：接收客户端上传的附件文件。

**流程**：
```
1. 客户端通过查询参数发送附件元数据（ID、文件名、hash 等）
2. 文件内容在请求体中（二进制）
3. 服务端把文件存到对象存储
4. 写入附件元信息到数据库
5. 返回 storage_key
```

**存储路径**：`{user_id}/{snapshot_id}/attachments/{attachment_id}/{filename}`

上传时 snapshot_id 是 `"pending"`，等 commit 时一起移动。

### 7. 下载附件 — `GET /sync/attachments/download/{attachment_id}`

**作用**：向客户端提供附件文件。

**流程**：
```
1. 根据用户 ID 和附件 ID 查找附件记录
2. 从对象存储读取文件内容
3. 返回二进制数据 + MIME 类型
```

### 8. 提交同步 — `POST /sync/commit`

**这是最重要的接口**。它把一次同步的所有变更"固化"为一个新快照。

**流程**：
```
1. 生成新的 snapshot_id（UUID）

2. 找出 pending 状态的记录（本次推送的）
   → 更新数据库中的 storage_key（从 pending 路径移到正式路径）
   → 移动对象存储中的文件（pending/ → {snapshot_id}/）

3. 把用户所有记录关联到新快照（确保最新快照是完整视图）

4. 处理附件：
   → 移动 pending 附件到新快照路径
   → 更新附件元信息
   → 删除不在本次提交列表中的旧附件
   → 把所有附件关联到新快照

5. 统计记录数，计算数据 hash

6. 创建新快照记录

7. 清理旧快照（保留最近 20 个）
```

**为什么 commit 这么复杂？**

因为记录和附件在上传时都存在 `pending/` 路径下。commit 时需要：
- 把 pending 文件移到正式路径
- 更新数据库中的路径引用
- 创建新快照
- 清理旧数据

这保证了原子性——要么整个同步成功，要么不会留下部分数据。

### 9. 获取同步历史 — `GET /sync/sync/history`

**作用**：返回用户的同步历史（分页）。

**参数**：`page`（页码，默认 1）、`page_size`（每页大小，默认 10，最大 100）

### 10. 重置同步数据 — `POST /sync/sync/reset`

**作用**：删除用户所有同步数据（快照、记录、附件元信息）。

---

## 一次完整同步的服务端视角

```
客户端请求序列                服务端操作
─────────────                ─────────
GET /snapshot/latest         → 查数据库，返回最新快照信息
GET /snapshot/{id}/records   → 查数据库，返回所有记录的 hash

（客户端计算 diff...）

POST /records/push           → 验证 hash → 存 JSON 到对象存储 → 写 DB（pending）
POST /attachments/diff       → 查 DB → 返回 missing + remote 列表
POST /attachments/upload     → 存文件到对象存储 → 写 DB（pending）

POST /commit                 → 移动 pending → 正式路径
                              → 创建新快照
                              → 清理旧快照

POST /attachments/diff       → 再次查（下载阶段）
GET /attachments/download    → 从对象存储读取文件
```

---

## 客户端-服务器通信协议汇总

| # | 方法 | 路径 | 请求体 | 响应 |
|---|------|------|--------|------|
| 1 | GET | `/health` | - | `200 OK` |
| 2 | POST | `/auth/login` | `{email, password, device_id}` | `{user_id, access_token, refresh_token}` |
| 3 | POST | `/auth/register` | `{email, password, device_id}` | `{user_id, access_token, refresh_token}` |
| 4 | POST | `/auth/forgot-password` | `{email}` | `{reset_token}` |
| 5 | POST | `/auth/reset-password` | `{email, reset_token, new_password}` | `200 OK` |
| 6 | GET | `/sync/snapshot/latest` | - | `SnapshotInfo | null` |
| 7 | GET | `/sync/snapshot/{id}/records` | - | `RecordMetaInfo[]` |
| 8 | POST | `/sync/records/push` | `{records: SyncRecordPayload[]}` | `{accepted, skipped}` |
| 9 | POST | `/sync/records/pull` | `{since_snapshot_id?}` | `{records, snapshot_id}` |
| 10 | POST | `/sync/attachments/diff` | `{hashes[]}` | `{missing[], remote_attachments[]}` |
| 11 | POST | `/sync/attachments/upload` | 查询参数 + 二进制体 | `{storage_key}` |
| 12 | GET | `/sync/attachments/download/{id}` | - | 二进制流 |
| 13 | POST | `/sync/commit` | `{pushed_records, attachments, attachments_complete}` | `{snapshot_id, created_at}` |
| 14 | GET | `/sync/history` | `?page=&page_size=` | `{items[], total, page, page_size}` |
| 15 | POST | `/sync/reset` | - | `200 OK` |

所有 API（除了 `/health` 和 `/auth/*`）都需要 `Authorization: Bearer {access_token}` 请求头。

---

## 服务端存储架构

### 对象存储路径结构

```
{user_id}/
├── pending/                        ← 推送时暂存
│   ├── items/{record_id}.json
│   ├── tags/{record_id}.json
│   └── attachments/{att_id}/{filename}
├── {snapshot_id_1}/                ← 正式快照
│   ├── items/{record_id}.json
│   ├── tags/{record_id}.json
│   ├── item_tags/{record_id}.json
│   ├── versions/{record_id}.json
│   └── attachments/{att_id}/{filename}
├── {snapshot_id_2}/
│   └── ...
```

### 数据库表

| 表 | 内容 |
|----|------|
| `sync_snapshots` | 快照（id, user_id, snapshot_id, data_hash, record_count, total_size, created_at） |
| `sync_records` | 记录（id, user_id, table_name, record_id, content_hash, updated_at, snapshot_id, storage_key） |
| `sync_attachments` | 附件（id, user_id, attachment_id, item_id, filename, mime_type, file_size, file_hash, storage_key, snapshot_id） |

---

> 下一站：[06-sync-testing-guide.md](./06-sync-testing-guide.md) — 学会如何测试同步功能