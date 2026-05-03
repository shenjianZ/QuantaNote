# 03 - 前端代码讲解

> 本文档逐文件讲解前端同步相关的每一行代码。读完之后，你能看懂前端的同步实现。
> 假设你了解基本的 React 和 TypeScript，但不熟悉这个项目。

---

## 整体数据流

```
用户点击"同步"按钮
     │
     ▼
SyncSettingsPanel.tsx（UI 组件）
     │ 调用 store 方法
     ▼
syncStore.ts（Zustand 状态管理）
     │ 调用 tauriCommands
     ▼
tauriCommands.ts（通信层）
     │ invoke("trigger_sync")
     ▼
Rust 后端（Tauri Command）
     │ HTTP 请求
     ▼
同步服务器
```

**反过来**，服务器状态变化通过事件推送回来：

```
Rust 后端 state_manager.emit_state()
     │ Tauri 事件 "sync-state-changed"
     ▼
syncStore.ts 的 listen() 回调
     │ set({ state })
     ▼
React 组件自动重新渲染
```

---

## 文件 1：`src/services/tauriCommands.ts`

### 作用

这是前后端之间的"翻译层"。前端不直接和 Rust 通信，而是通过 Tauri 的 `invoke()` 函数。这个文件把每个 invoke 调用包装成一个 TypeScript 函数，提供类型定义。

### 同步相关的类型定义

```typescript
// 同步配置（用户在设置面板里填的那些东西）
export interface SyncConfig {
    enabled: boolean;              // 是否启用同步
    server_url: string;            // 服务器地址
    access_token: string;          // 访问令牌（登录后获得）
    refresh_token: string;         // 刷新令牌（用于获取新的 access_token）
    user_id: string;               // 用户 ID
    device_id: string;             // 设备 ID（每台电脑自动生成一个）
    auto_sync: boolean;            // 是否自动同步
    sync_interval_minutes: number; // 自动同步间隔（分钟）
    conflict_resolution: string;   // 冲突策略："auto" | "local-wins" | "remote-wins" | "manual"
    sync_attachments: boolean;     // 是否同步附件
    last_sync_at: string | null;   // 上次同步时间
    last_snapshot_id: string | null;// 上次同步的快照 ID
}

// 同步状态（实时更新，显示在 UI 上）
export interface SyncState {
    status: string;    // "idle" | "preparing" | "pushing" | "pulling" | "syncing_attachments" | "completed" | "error"
    progress: { phase: string; current: number; total: number } | null;
    last_error: string | null;
    last_sync_at: string | null;
}

// 同步结果（一次同步的统计）
export interface SyncResult {
    pushed: number;               // 推送了多少条
    pulled: number;               // 拉取了多少条
    skipped: number;              // 跳过了多少条（无变化）
    conflicts: number;            // 有多少冲突
    pending_conflicts: ConflictInfo[] | null;  // 待解决的冲突（manual 模式）
    attachments_uploaded: number; // 上传了多少附件
    attachments_downloaded: number;// 下载了多少附件
    snapshot_id: string;          // 新快照 ID
}
```

### 同步相关的函数

每个函数对应一个 Rust Tauri command：

```typescript
// ── 配置 ──
getSyncConfig()                    // 读取同步配置（从 SQLite settings 表）
saveSyncConfig(config)             // 保存同步配置
getSyncState()                     // 获取当前同步状态

// ── 认证 ──
syncLogin(serverUrl, email, password)       // 登录
syncRegister(serverUrl, email, password)    // 注册
syncLogout()                                // 登出
syncForgotPassword(serverUrl, email)        // 忘记密码（返回 reset token）
syncResetPassword(serverUrl, email, resetToken, newPassword)  // 重置密码

// ── 同步操作 ──
triggerSync()                      // 触发一次同步
testSyncConnection(serverUrl)      // 测试服务器连接（访问 /health 端点）
getSyncHistory(page, pageSize)     // 获取同步历史（分页）

// ── 冲突管理 ──
getPendingConflicts()              // 获取待解决的冲突列表
resolveSyncConflicts(resolutions)  // 提交冲突解决选择
cancelSyncConflicts()              // 取消待解决的冲突
```

每个函数内部都很简单，就是一行 `invoke()`：

```typescript
export async function triggerSync() {
    return invoke<SyncResult>("trigger_sync");
    // "trigger_sync" 是 Rust 侧 #[tauri::command] 函数的名字
}
```

---

## 文件 2：`src/stores/syncStore.ts`

### 作用

这是同步功能的**状态管理中心**，使用 Zustand 库管理。所有同步相关的状态（配置、实时状态、冲突、历史）都在这里。

### 状态结构

```typescript
interface SyncStore {
    config: SyncConfig;              // 同步配置
    state: SyncState;                // 实时同步状态（从 Rust 后端推送）
    history: SyncHistoryEntry[];     // 同步历史列表
    historyTotal: number;            // 历史总数（分页用）
    historyPage: number;             // 当前页
    historyPageSize: number;         // 每页大小
    isLoading: boolean;              // 是否正在操作（登录/同步中）
    error: string | null;            // 错误信息
    pendingConflicts: ConflictInfo[] | null;  // 待解决的冲突
    // ... 方法们
}
```

### init() — 初始化（应用启动时调用）

```typescript
init: async () => {
    // 1. 从后端加载配置和状态
    const config = await getSyncConfig();
    const state = await getSyncState();
    set({ config, state });

    // 2. 检查有没有上次遗留的未解决冲突（应用重启后恢复）
    const pending = await getPendingConflicts();
    if (pending && pending.length > 0) {
        set({ pendingConflicts: pending });
    }

    // 3. 监听后端事件（实时更新同步进度）
    listen<SyncState>("sync-state-changed", (event) => {
        set({ state: event.payload });
    });

    // 4. 如果开启了自动同步，启动定时器
    if (config.enabled && config.access_token && config.auto_sync) {
        startAutoSync(config.sync_interval_minutes, async () => {
            await get().triggerSync();
        });
    }
}
```

**在哪里被调用的？** 在 `src/app/QuantaNoteApp.tsx` 中：

```typescript
useEffect(() => {
    useSyncStore.getState().init();
}, []);
```

### 自动同步定时器

```typescript
// 启动自动同步
function startAutoSync(intervalMinutes: number, triggerFn: () => Promise<void>) {
    stopAutoSync();
    if (intervalMinutes < 1) return;
    _autoSyncTimer = setInterval(() => {
        triggerFn().catch(() => {});  // 失败了静默忽略
    }, intervalMinutes * 60 * 1000);  // 分钟转毫秒
}

// 停止自动同步
function stopAutoSync() {
    if (_autoSyncTimer) {
        clearInterval(_autoSyncTimer);
        _autoSyncTimer = null;
    }
}
```

定时器在以下时机被管理：
- `init()` 时：如果配置了自动同步，启动
- `updateConfig()` 时：如果配置变了，重新启动或停止
- `logout()` 时：停止
- Token 过期时：停止

### triggerSync() — 触发同步

```typescript
triggerSync: async () => {
    set({ isLoading: true, error: null });
    try {
        const result = await triggerSync();  // 调用 Rust 后端

        // 更新本地状态
        const config = await getSyncConfig();
        const state = await getSyncState();
        set({ config, state, isLoading: false });

        // manual 模式有冲突：保存冲突列表，不刷新数据
        if (result.pending_conflicts && result.pending_conflicts.length > 0) {
            set({ pendingConflicts: result.pending_conflicts });
            return result;
        }

        // 同步成功且有拉取的记录 → 刷新 UI 数据
        if (result.pulled > 0) {
            await useItemStore.getState().fetchItems();
            await useTagStore.getState().fetchTags();
        }

        // 刷新同步历史
        await get().refreshHistory();
        return result;
    } catch (e) {
        // Token 过期：自动注销
        if (msg.includes("TokenExpired") || msg.includes("登录已过期")) {
            stopAutoSync();
            await get().logout();
            set({ isLoading: false, error: "登录已过期，请重新登录" });
            return {} as SyncResult;
        }
        throw e;
    }
}
```

### resolveConflicts() — 解决冲突

```typescript
resolveConflicts: async (resolutions) => {
    const result = await resolveSyncConflicts(resolutions);  // 发送给 Rust 后端
    set({ pendingConflicts: null });  // 清空冲突

    // 刷新数据
    if (result.pulled > 0) {
        await useItemStore.getState().fetchItems();
        await useTagStore.getState().fetchTags();
    }
    return result;
}
```

### updateConfig() — 更新配置

```typescript
updateConfig: async (partial) => {
    const current = get().config;
    const updated = { ...current, ...partial };  // 合并部分更新
    set({ config: updated });                     // 乐观更新 UI
    await saveSyncConfig(updated);                // 持久化到后端

    // 更新自动同步定时器
    if (updated.enabled && updated.access_token && updated.auto_sync) {
        startAutoSync(updated.sync_interval_minutes, ...);
    } else {
        stopAutoSync();
    }
}
```

---

## 文件 3：`src/components/sync/SyncSettingsPanel.tsx`

### 作用

这是设置页面里的同步配置面板。用户在这里：
- 开关同步功能
- 填写服务器地址并测试连接
- 登录/注册/登出
- 配置同步策略（自动同步、冲突策略、附件同步）
- 手动触发同步
- 查看同步历史

### UI 结构

```
SyncSettingsPanel
├── 同步总开关（enabled toggle）
├── 服务器地址 + 测试按钮
├── 账号状态
│   ├── 已登录：显示"已登录" + 登出按钮
│   └── 未登录：登录按钮 + 注册按钮
├── 同步策略（仅登录后显示）
│   ├── 自动同步开关
│   ├── 同步间隔（分钟）
│   ├── 同步附件开关
│   └── 冲突策略选择
├── 待解决冲突提示（黄色警告条）
├── 同步状态
│   ├── 状态图标 + 文字
│   ├── 进度条
│   ├── 上次同步时间
│   └── 错误信息
├── 同步历史列表（分页）
├── 认证弹窗（LoginModal / RegisterModal / ForgotPasswordModal / ResetPasswordModal）
└── 冲突解决弹窗（ConflictResolutionModal）
```

### 关键交互逻辑

**测试连接**：
```typescript
async function handleTestConnection() {
    setIsTesting(true);
    const result = await testConnection(serverUrlInput);  // 调用后端的 /health 端点
    setTestResult(result);  // true 显示绿色 ✓，false 显示红色 ✗
    setIsTesting(false);
}
```

**手动同步**：
```typescript
async function handleSync() {
    clearError();
    await triggerSync();  // 由 store 处理所有逻辑
}
```

**判断是否正在同步**：
```typescript
const isSyncing =
    state.status === "preparing" ||
    state.status === "pushing" ||
    state.status === "pulling" ||
    state.status === "syncing_attachments";
```

---

## 文件 4：`src/components/sync/SyncStatusIndicator.tsx`

### 作用

顶栏上的小云朵图标，一眼看到同步状态。点击可以手动触发同步。

### 状态显示

| 状态 | 图标 | 颜色 |
|------|------|------|
| 同步中 | 旋转的 Loader | 蓝色 |
| 同步完成 | CloudCog | 绿色 |
| 同步出错 | CloudOff | 红色 |
| 空闲 | Cloud | 灰色 |

### 显示条件

只在同步已启用且已登录时显示：

```typescript
if (!config.enabled || !config.access_token) {
    return null;  // 不显示
}
```

### 点击行为

```typescript
async function handleClick() {
    if (isSyncing) return;  // 同步中不允许重复触发
    await triggerSync();
}
```

### 在 TopBar 中的位置

`src/components/layout/TopBar.tsx` 中：

```tsx
<SyncStatusIndicator />  {/* 放在导航按钮和搜索之间 */}
```

---

## 文件 5：`src/components/sync/ConflictResolutionModal.tsx`

### 作用

手动冲突解决弹窗。当同步策略为 `manual` 且检测到冲突时自动弹出。

### UI 结构

```
ConflictResolutionModal
├── 警告提示："检测到 N 条冲突记录"
├── 批量操作按钮："全选本地" "全选远程"
├── 冲突列表（可滚动）
│   └── 每条冲突（ConflictRow）
│       ├── 表名 + 记录 ID（截断显示）
│       ├── 本地选项：单选按钮 + 更新时间
│       └── 远程选项：单选按钮 + 更新时间
├── 取消按钮
└── 应用按钮
```

### 关键逻辑

**选择管理**：
```typescript
// 用一个 Record 存储每条冲突的选择
const [resolutions, setResolutions] = useState<Record<string, "local" | "remote">>({});

// 每条冲突用 "table_name:record_id" 作为 key
function conflictKey(conflict: ConflictInfo): string {
    return `${conflict.table_name}:${conflict.record_id}`;
}
```

**批量操作**：
```typescript
function selectAllLocal() {
    const all: Record<string, "local" | "remote"> = {};
    for (const c of pendingConflicts!) {
        all[conflictKey(c)] = "local";
    }
    setResolutions(all);
}
```

**提交解决**：
```typescript
async function handleResolve() {
    // 把每条冲突和用户的选择组合成 ConflictResolutionChoice[]
    const choices = pendingConflicts!.map((c) => ({
        table_name: c.table_name,
        record_id: c.record_id,
        choice: resolutions[conflictKey(c)] || "local",  // 默认用本地
    }));
    await resolveConflicts(choices);  // 提交给后端
    onClose();
}
```

**取消**：
```typescript
async function handleCancel() {
    await cancelConflicts();  // 清除后端的 pending 状态
    onClose();
}
```

---

## 文件 6：认证组件（`src/components/auth/`）

### LoginModal.tsx — 登录弹窗

简单的表单：
- 服务器地址输入框（如果还没配置）
- 邮箱输入框
- 密码输入框
- 登录按钮
- 链接到注册和忘记密码

点击登录后：
```
1. 调用 syncStore.login(serverUrl, email, password)
2. store 内部调用 syncLogin() → invoke("sync_login")
3. Rust 后端验证账号，返回 token
4. 前端保存配置，关闭弹窗
```

### RegisterModal.tsx — 注册弹窗

类似登录，多了一个"确认密码"字段。前端做密码匹配验证（最少 6 位）。

### ForgotPasswordModal.tsx / ResetPasswordModal.tsx — 忘记/重置密码

两步流程：
1. 忘记密码：输入邮箱 → 后端发送重置令牌 → 弹窗切换到重置密码
2. 重置密码：输入新密码 → 提交令牌和新密码 → 完成

---

## 文件 7：`src/app/QuantaNoteApp.tsx` — 同步初始化入口

在应用启动时，调用同步 store 的 init：

```typescript
useEffect(() => {
    useSyncStore.getState().init();
}, []);
```

这一行代码做了：
1. 加载同步配置
2. 加载同步状态
3. 检查未解决的冲突
4. 注册事件监听
5. 启动自动同步定时器（如果配置了的话）

---

## 前端数据流总结图

```
┌─────────────────────────────────────────────────────┐
│                     React UI 层                      │
│                                                     │
│  SyncSettingsPanel ──调用──► syncStore.triggerSync() │
│  SyncStatusIndicator              │                  │
│  ConflictResolutionModal          │                  │
│  LoginModal / RegisterModal       │                  │
└───────────────────────────────────┼─────────────────┘
                                    │
                            ┌───────▼────────┐
                            │   syncStore     │
                            │   (Zustand)     │
                            │                │
                            │ config, state  │◄─── listen("sync-state-changed")
                            │ history        │        (Rust 推送实时状态)
                            │ pendingConflicts│
                            │ isLoading/error│
                            └───────┬────────┘
                                    │
                            ┌───────▼────────┐
                            │ tauriCommands   │
                            │ invoke() 调用    │
                            └───────┬────────┘
                                    │
                            ┌───────▼────────┐
                            │  Rust 后端      │
                            │  Tauri Command  │
                            └────────────────┘
```

---

> 下一站：[04-backend-code-walkthrough.md](./04-backend-code-walkthrough.md) — 看看 Rust 后端怎么处理这些请求
