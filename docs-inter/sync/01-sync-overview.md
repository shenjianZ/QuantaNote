# 01 - QuantaNote 同步功能总览

> 本文档用最通俗的语言，带你鸟瞰 QuantaNote 的同步系统——它是什么、为什么需要它、整体怎么工作的。

---

## 一、什么是"数据同步"？

**生活中的例子**：你手机上的微信，和电脑上的微信，消息是一样的——这就是同步。

在 QuantaNote 中，"同步"的意思是：

> **你在不同电脑上的笔记、标签、附件等数据，通过一台服务器，保持一致。**

你在公司电脑写了一篇笔记，回家打开家里的电脑，这篇笔记自动就出现了——这就是同步在帮你做的事。

---

## 二、QuantaNote 为什么需要同步？

QuantaNote 是一个**"本地优先"**的桌面笔记软件。它的特点是：

1. **数据先存本地**：所有笔记都存在你电脑上的 SQLite 数据库里（`~/.quantanote/quanta_note.sqlite`）
2. **离线也能用**：不需要网络就能正常使用
3. **但多台电脑时**：你的公司电脑和家里电脑各自独立，数据不一样

**同步就是为了解决第 3 点**：通过一台服务器，让多台电脑上的数据保持一致。

---

## 三、整体架构（一张图看懂）

```
┌─────────────────────────────┐        ┌─────────────────────────────┐
│       设备 A（你的电脑）       │        │       设备 B（另一台电脑）     │
│                             │        │                             │
│  ┌─────────────────────┐    │        │  ┌─────────────────────┐    │
│  │  前端 (React)        │    │        │  │  前端 (React)        │    │
│  │  syncStore / UI组件  │    │        │  │  syncStore / UI组件  │    │
│  └────────┬────────────┘    │        │  └────────┬────────────┘    │
│           │ invoke()         │        │           │ invoke()         │
│  ┌────────▼────────────┐    │        │  ┌────────▼────────────┐    │
│  │  Tauri 后端 (Rust)   │    │        │  │  Tauri 后端 (Rust)   │    │
│  │  同步引擎 / Diff算法  │    │        │  │  同步引擎 / Diff算法  │    │
│  └────────┬────────────┘    │        │  └────────┬────────────┘    │
│           │ HTTP请求          │        │           │ HTTP请求          │
│  ┌────────▼────────────┐    │        │  ┌────────▼────────────┐    │
│  │  SQLite 本地数据库    │    │        │  │  SQLite 本地数据库    │    │
│  └─────────────────────┘    │        │  └─────────────────────┘    │
└─────────────┬───────────────┘        └─────────────┬───────────────┘
              │                                      │
              │          HTTPS (REST API)             │
              └──────────────┬───────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   同步服务器      │
                    │  (web-rust-      │
                    │   template-      │
                    │   project)       │
                    │                 │
                    │  用户认证        │
                    │  快照管理        │
                    │  记录存储        │
                    │  附件存储        │
                    └─────────────────┘
```

**简单理解**：
- 你的笔记存在本地 SQLite 数据库
- 同步引擎负责把本地变化推送到服务器，或者从服务器拉取变化
- 服务器是一个中间人，帮你管理数据版本

---

## 四、涉及哪些代码文件？

### 4.1 前端（TypeScript / React）

| 文件路径 | 一句话说明 |
|---------|-----------|
| `src/stores/syncStore.ts` | 同步状态管理（Zustand store），管理配置、状态、冲突、定时器 |
| `src/services/tauriCommands.ts` | 前后端通信桥梁，封装所有 `invoke()` 调用 |
| `src/components/sync/SyncSettingsPanel.tsx` | 同步设置面板 UI（服务器地址、登录、策略配置） |
| `src/components/sync/SyncStatusIndicator.tsx` | 顶栏上的小云朵图标，显示同步状态 |
| `src/components/sync/ConflictResolutionModal.tsx` | 冲突解决弹窗（手动模式时出现） |
| `src/components/auth/LoginModal.tsx` | 登录弹窗 |
| `src/components/auth/RegisterModal.tsx` | 注册弹窗 |
| `src/components/auth/ForgotPasswordModal.tsx` | 忘记密码弹窗 |
| `src/app/QuantaNoteApp.tsx` | 应用入口，启动时初始化同步 |

### 4.2 Tauri 后端（Rust）

| 文件路径 | 一句话说明 |
|---------|-----------|
| `src-tauri/src/commands/sync.rs` | Tauri 命令层，接收前端调用，编排同步流程 |
| `src-tauri/src/sync/mod.rs` | 同步引擎核心：记录应用（apply）、基线读写 |
| `src-tauri/src/sync/diff.rs` | 三方 diff 算法：比对本地/远程/基线，找出变化和冲突 |
| `src-tauri/src/sync/transport.rs` | HTTP 通信层：请求服务器、重试、Token 刷新 |
| `src-tauri/src/sync/state.rs` | 状态管理器：实时向前端推送同步进度 |
| `src-tauri/src/models/sync.rs` | 数据模型：SyncConfig、SyncState、SyncResult 等 |
| `src-tauri/src/repositories/*.rs` | 各数据仓库：删除时写墓碑记录 |
| `src-tauri/src/db/mod.rs` | 数据库初始化：sync_baseline、sync_tombstones 表结构 |

### 4.3 同步服务器（Rust / Axum）

| 文件路径 | 一句话说明 |
|---------|-----------|
| `web-rust-template-project/src/handlers/sync.rs` | API 接口层：snapshot、push、pull、attachment、commit |
| `web-rust-template-project/src/services/sync_service.rs` | 业务逻辑：快照管理、记录比对、附件处理 |
| `web-rust-template-project/src/repositories/sync_repository.rs` | 数据库操作：记录存储、快照清理 |
| `web-rust-template-project/src/domain/dto/sync.rs` | 请求结构体：PushRecordsRequest、PullRecordsRequest 等 |
| `web-rust-template-project/src/domain/vo/sync.rs` | 响应结构体：SnapshotInfo、PushResult、PullResult 等 |

---

## 五、关键概念速查表

### 5.1 核心概念

| 概念 | 英文名 | 通俗解释 |
|------|--------|---------|
| **基线** | Baseline | 上次同步时"拍了张照片"——记住了当时每条记录的样子（hash 值）。下次同步时，拿现在和基线对比，就知道什么变了。 |
| **快照** | Snapshot | 服务器上保存的一次同步结果。每次同步成功，服务器创建一个新快照。就像 Git 的 commit。 |
| **墓碑** | Tombstone | 一条"死亡证明"。当你删除一条记录时，不是直接删除，而是插入一条墓碑标记。这样其他设备同步时就知道"这条记录被删了"，而不是"这条记录不存在"。 |
| **三方 Diff** | Three-way Diff | 三方比较算法。比较三方：本地当前、远程当前、基线（上次同步的样子）。这样才能准确判断"谁改了什么"。 |
| **哈希** | Hash | 用 SHA-256 算法把一条记录的内容算出一个"指纹"（一串字符）。指纹相同 = 内容相同，指纹不同 = 内容不同。 |
| **冲突** | Conflict | 本地和远程同时修改了同一条记录，而且改的内容不一样。需要决定用哪个版本。 |

### 5.2 同步状态

| 状态 | 含义 |
|------|------|
| `idle` | 空闲，没有在同步 |
| `preparing` | 正在准备（获取快照、收集本地记录、计算差异） |
| `pushing` | 正在推送本地变更到服务器 |
| `pulling` | 正在从服务器拉取变更 |
| `syncing_attachments` | 正在同步附件文件 |
| `completed` | 同步完成 |
| `error` | 同步出错 |

### 5.3 冲突解决策略

| 策略 | 英文 | 含义 |
|------|------|------|
| 自动（按时间） | `auto` | 比较时间戳，新的覆盖旧的 |
| 本地优先 | `local-wins` | 冲突时总是用本地版本 |
| 远程优先 | `remote-wins` | 冲突时总是用远程版本 |
| 手动 | `manual` | 冲突时暂停同步，弹出对话框让你选择 |

### 5.4 同步的数据表

QuantaNote 同步以下 5 张表的数据：

| 表名 | 内容 | 同步标识 |
|------|------|---------|
| `items` | 笔记/记录 | `id`（UUID） |
| `tags` | 标签 | `uuid`（UUID） |
| `item_tags` | 笔记-标签关联 | `item_id + tag_uuid` |
| `versions` | 版本历史 | `id`（UUID） |
| `attachments` | 附件 | `id`（UUID） |

### 5.5 同步专用的表

| 表名 | 内容 |
|------|------|
| `sync_baseline` | 每次同步成功后，记录每条记录的 hash 值（作为下次 diff 的参照） |
| `sync_tombstones` | 删除记录时写入的"死亡证明" |

---

## 六、一个同步周期的完整步骤（速览）

```
1. 准备阶段    → 获取服务器最新快照，收集本地所有记录并计算 hash
2. 计算差异    → 三方 diff：本地 vs 远程 vs 基线
3. 推送变更    → 把本地独有的修改推送到服务器
4. 拉取变更    → 从服务器拉取远程的修改，写入本地数据库
5. 同步附件    → 上传本地新附件、下载远程新附件
6. 提交同步    → 告诉服务器"这次同步完成了"，服务器创建新快照
7. 更新基线    → 把当前状态保存为新的基线（供下次 diff 使用）
```

> 详细的流程讲解请看 [02-sync-flow.md](./02-sync-flow.md)

---

## 七、推荐阅读顺序

1. **本文档**（总览）— 建立全局认知
2. [02-sync-flow.md](./02-sync-flow.md)（流程详解）— 理解每一步怎么做
3. [03-frontend-code-walkthrough.md](./03-frontend-code-walkthrough.md)（前端代码）— 看懂前端怎么实现
4. [04-backend-code-walkthrough.md](./04-backend-code-walkthrough.md)（后端代码）— 看懂 Rust 怎么实现
5. [05-server-code-walkthrough.md](./05-server-code-walkthrough.md)（服务端代码）— 看懂服务器怎么实现
6. [06-sync-testing-guide.md](./06-sync-testing-guide.md)（测试指南）— 学会验证同步功能
