# QuantaNote 项目完善修复报告

共修改 32 个文件，新增 1 个文件（CI 工作流），新增 14 个测试。

---

## 一、前端 Store 错误处理（5 个文件）

### 1. userStore.ts — deleteAccount 添加 try/catch

**文件**: `src/stores/userStore.ts`

**问题**: `deleteAccount()` 没有 try/catch。如果服务端调用失败（网络错误、服务端拒绝等），`set({ profile: null })` 仍会执行，导致本地状态被清空但账户实际未删除。

**修复**: 添加 try/catch，失败时显示错误 toast 并重新抛出异常（让调用方也能感知失败）。

```diff
 deleteAccount: async () => {
-    await deleteAccountCmd();
-    set({ profile: null });
+    try {
+        await deleteAccountCmd();
+        set({ profile: null });
+    } catch {
+        useToastStore.getState().addToast("error", i18n.t("profile:saveFailed"));
+        throw new Error("deleteAccount failed");
+    }
 },
```

**验证**: 前端构建通过。所有调用方（ProfilePage 中的删除按钮 handler）已有 try/catch 处理。

---

### 2. syncStore.ts — token 过期不再返回类型不安全的空对象

**文件**: `src/stores/syncStore.ts`

**问题**: `return {} as SyncResult` 返回一个所有字段为 `undefined` 的对象。`SyncResult` 接口要求 `pushed: number` 等字段，调用方如果访问 `result.pushed` 会得到 `undefined` 而非数字，可能导致 UI 异常。

**修复**: 改为 `throw`，让调用方通过 catch 处理 token 过期。

```diff
 stopAutoSync();
 await get().logout();
 set({ isLoading: false, error: i18n.t("sync:sessionExpired") });
-return {} as SyncResult;
+throw new Error(i18n.t("sync:sessionExpired"));
```

**验证**: 所有 5 个 `triggerSync()` 调用方已有 try/catch：
- `syncStore.ts` L138（自动同步）
- `syncStore.ts` L316（config 更新后同步）
- `SyncStatusIndicator.tsx` L47（手动点击同步）
- `SyncSettingsPanel.tsx` L85（设置面板同步）

---

### 3. tagStore.ts — loading 状态管理

**文件**: `src/stores/tagStore.ts`

**问题**: `loading` 状态在接口中声明（`loading: boolean`），但 `fetchTags` 从未设置它为 `true`，导致 UI 无法显示标签加载状态。

**修复**: 进入时 `loading: true, error: null`，完成/失败时 `loading: false`。

```diff
 fetchTags: async () => {
+    set({ loading: true, error: null });
     try {
       const tags = await getAllTags();
-      set({ tags });
+      set({ tags, loading: false });
     } catch (e) {
-      set({ error: String(e) });
+      set({ error: String(e), loading: false });
     }
 },
```

**验证**: 完整生命周期 — L35 设 `true` → L38/L40 设回 `false`。

---

### 4. itemStore.ts — 清除旧的 error 状态

**文件**: `src/stores/itemStore.ts`

**问题**: 如果 `fetchItems` 第一次失败（设置 `error: "some error"`），第二次调用时 `error` 不会清除。用户看到旧的错误信息与新数据同时存在。

**修复**: 开始新请求时 `set({ loading: true, error: null })`。

```diff
 fetchItems: async (itemType) => {
-    set({ loading: true });
+    set({ loading: true, error: null });
```

**验证**: 前端构建通过。

---

### 5. updaterStore.ts — 自动更新下载错误日志

**文件**: `src/stores/updaterStore.ts`

**问题**: `.catch(() => {})` 完全吞掉了自动更新检查/下载的错误，无法排查自动更新失败原因。

**修复**: 改为 `.catch((e) => { console.warn(...) })` — 保留日志便于调试。

```diff
 .catch(() => {});
+.catch((e) => {
+    console.warn("Auto update check/download failed:", e);
+ });
```

**验证**: 前端构建通过。

---

## 二、后端 Rust 错误处理（7 个文件）

### 6. item_repository.rs — 行级错误不再静默丢弃

**文件**: `src-tauri/src/repositories/item_repository.rs`

**问题**: `get_pinned` 和 `get_recent` 使用 `filter_map(|r| r.ok())` 静默丢弃反序列化失败的行。如果数据库有损坏行（schema 变更后旧数据不兼容），用户看到的是"数据少了"但没有任何错误提示。

**修复**: 用 `collect::<Result<Vec<_>, _>>()` 正确传播每一行的错误。

```diff
 .filter_map(|r| r.ok())
 .collect();
+.collect::<Result<Vec<_>, _>>()
+.map_err(|e| AppError::Database(e.to_string()))?;
```

**测试**: `cargo test -- item_repository` → 7 passed; 0 failed

---

### 7. search_repository.rs — 同样的 filter_map 修复

**文件**: `src-tauri/src/repositories/search_repository.rs`

**问题**: 与 item_repository 相同的问题，搜索结果中损坏的行被静默丢弃。涉及 FTS 搜索和 LIKE 搜索两个代码路径。

**修复**: 2 处 `filter_map` → `collect::<Result>`。

**测试**: `cargo test -- search_repository` → 4 passed; 0 failed

---

### 8. item_service.rs — 版本创建失败不再静默

**文件**: `src-tauri/src/services/item_service.rs`

**问题**: `let _ = version_repository::create_version(...)` 完全忽略错误。如果版本创建失败（DB 满等），用户创建的 item 没有初始版本，版本历史功能不可用且无任何提示。

**修复**: 改为 `log::warn!` 记录日志。

```diff
-let _ =
-    version_repository::create_version(db, &item.id, &content_val, "创建", "初始版本", "");
+if let Err(e) = version_repository::create_version(db, &item.id, &content_val, "创建", "初始版本", "") {
+    log::warn!("Failed to create initial version for item {}: {}", item.id, e);
+}
```

**测试**: `cargo test -- item_service` → 8 passed; 0 failed

---

### 9. sync/state.rs — unwrap → map_err（6 处）

**文件**: `src-tauri/src/sync/state.rs`

**问题**: 6 处 `.unwrap()` — 如果 mutex 被 poisoned（某个线程 panic），所有后续调用也会 panic，导致应用崩溃。

**修复**: 所有方法返回 `Result<T, AppError>`，用 `.map_err()` 转换锁错误。调用方用 `let _ =` 处理（因为状态 UI 更新失败不应中断同步操作本身）。

```diff
-pub fn get_state(&self) -> SyncState {
-    self.state.lock().unwrap().clone()
+pub fn get_state(&self) -> Result<SyncState, AppError> {
+    self.state
+        .lock()
+        .map(|s| s.clone())
+        .map_err(|e| AppError::Database(e.to_string()))
```

**验证**: 所有调用方（sync_service.rs 和 commands/sync.rs）已适配新返回类型，`cargo check` 通过。

---

### 10. sync_service.rs — eprintln! → log::warn! + load_sync_config 日志

**文件**: `src-tauri/src/services/sync_service.rs`

**问题 1**: `eprintln!` 输出到 stderr，不经过 Tauri 的日志系统（`tauri-plugin-log`），生产环境中无法收集。

**问题 2**: `load_sync_config` 在 3 种失败场景（锁失败、JSON 解析失败、查询失败）中都返回默认值但不记录日志，难以排查配置问题。

**修复**: 
- 冲突日志从 `eprintln!` 改为 `log::warn!` / `log::info!`
- `load_sync_config` 的 3 种失败路径添加 `log::warn!`

```diff
-Err(_) => return SyncConfig::default(),
+Err(e) => {
+    log::warn!("Failed to acquire DB lock for sync config: {}", e);
+    return SyncConfig::default();
+}
```

**验证**: `cargo check` 通过。

---

### 11. tag_service.rs — 标签颜色验证

**文件**: `src-tauri/src/services/tag_service.rs`

**问题**: 前端 ColorPickerModal 只提供 6 种颜色（cyan, purple, yellow, blue, green, red），但后端接受任意字符串，可能导致存储了前端无法正确渲染的颜色值。

**修复**: 添加白名单验证函数 `validate_tag_color`，在 `create_tag` 和 `update_tag_color` 中调用。

```rust
const VALID_TAG_COLORS: &[&str] = &["cyan", "purple", "yellow", "blue", "green", "red"];

fn validate_tag_color(color: &str) -> Result<(), AppError> {
    if !VALID_TAG_COLORS.contains(&color) {
        return Err(AppError::Validation(format!(
            "无效的标签颜色: {}，有效值: {:?}",
            color, VALID_TAG_COLORS
        )));
    }
    Ok(())
}
```

**测试**: `cargo test -- tag_service` → 10 passed; 0 failed

---

### 12. 密码强度验证（3 处）

**文件**: 
- `src-tauri/src/commands/sync.rs`（sync_login、sync_register）
- `src-tauri/src/commands/user.rs`（change_password）

**问题**: 注册、登录、修改密码时，后端不对密码长度做任何验证。过短的密码安全性不足。

**修复**: 3 处添加 `password.len() < 8` 检查。

```rust
if password.len() < 8 {
    return Err(AppError::Validation("密码长度不能少于8位".to_string()));
}
```

**验证**: `cargo check` 通过。

---

### 13. item_service.rs — item_type 白名单验证

**文件**: `src-tauri/src/services/item_service.rs`

**问题**: `create_item` 接受任意 `item_type` 字符串，但前端只使用 `"note"` 类型。非法类型会存入数据库但无法被前端正确处理。

**修复**: 添加白名单 `VALID_ITEM_TYPES: &[&str] = &["note"]`。

**测试**: `cargo test -- item_service` → 8 passed; 0 failed

---

## 三、前端代码质量（6 个文件）

### 14. tauriCommands.ts — any → Record<string, unknown>

**文件**: `src/services/tauriCommands.ts`

**问题**: `ConflictInfo.local_data: any` 绕过了 TypeScript 类型检查，可能在不安全访问属性时无编译警告。

**修复**: 改为 `Record<string, unknown>`，使用时必须进行类型断言。

```diff
-local_data: any;
+local_data: Record<string, unknown>;
```

**验证**: `local_data` 只在 `tauriCommands.ts` 中定义，无其他消费方直接访问其属性，前端构建通过。

---

### 15. TopBar.tsx — 模块级 getCurrentWindow 防崩溃

**文件**: `src/components/layout/TopBar.tsx`

**问题**: `const appWindow = getCurrentWindow()` 在模块顶层执行。在非 Tauri 环境（单元测试、SSR）中，`@tauri-apps/api/window` 不可用，会抛出异常导致整个模块无法加载。

**修复**: try/catch 包裹 + nullable 类型 + 所有使用处添加 null guard。

```diff
-const appWindow = getCurrentWindow();
+let appWindow: ReturnType<typeof getCurrentWindow> | null = null;
+try {
+  appWindow = getCurrentWindow();
+} catch {
+  // non-Tauri environment
+}
```

6 个 `appWindow.` 调用点全部添加了 null 检查（`if (!appWindow) return` 或 `appWindow?.`）。

**验证**: 前端构建通过。

---

### 16. SettingsPage.tsx — 可访问性：toggle 添加 role 和 aria-checked

**文件**: `src/pages/SettingsPage.tsx`

**问题**: toggle 开关只用了 `<button>` 但没有 `role="switch"` 和 `aria-checked`。屏幕阅读器无法识别这是一个开关控件。对比 `DocumentEditorPage.tsx` L207 已有正确的实现。

**修复**: 添加 ARIA 属性。

```diff
 <button
     type="button"
+    role="switch"
+    aria-checked={value}
```

**验证**: 前端构建通过。

---

### 17. ProfilePage.tsx — 头像 alt 属性

**文件**: `src/pages/ProfilePage.tsx`

**问题**: `alt=""` 告诉屏幕阅读器这是装饰性图片，但头像是信息性的（用户需要知道这是谁的图片）。

**修复**: 使用昵称、邮箱或回退文本作为 alt。

```diff
-alt=""
+alt={profile?.nickname || profile?.email || "User avatar"}
```

**验证**: 前端构建通过。

---

### 18. itemAdapter.ts — 移除冗余类型断言

**文件**: `src/adapters/itemAdapter.ts`

**问题**: `[] as Tag[]` 是冗余的类型断言。`tags` 字段类型已由 `Item` 接口定义为 `Tag[]`，空数组自动推断。`Tag` import 也不需要了。

**修复**: 移除 `as Tag[]` 和 `Tag` import。

```diff
-import type { Item, ItemType, Tag } from "../types";
+import type { Item, ItemType } from "../types";
-tags: [] as Tag[],
+tags: [],
```

**验证**: 前端构建通过。

---

### 19. VditorEditor.tsx — 修正过时注释

**文件**: `src/components/editor/VditorEditor.tsx`

**问题**: 注释写"使用 innerHTML 替换方式"，但实际代码使用的是安全的 DOM API（`createElement` + `textContent` + `replaceChild`）。注释误导代码审查者。

**修复**: 更正注释为"使用 DOM API 安全替换"。

**验证**: 前端构建通过。

---

## 四、依赖升级（3 个文件）

### 20. rusqlite 0.31 → 0.35

**文件**: `src-tauri/Cargo.toml`

**问题**: rusqlite 0.31 是 2024 年初的版本，缺少性能改进和 bug 修复。

**修复**: 升级到 0.35。唯一的 API 变化是 `conn.trace()` 被标记为 deprecated。

### 21. thiserror 1 → 2

**文件**: `src-tauri/Cargo.toml`

**问题**: thiserror 1 已过时，2.x 有改进。

**修复**: 升级到 2。后向兼容，无需代码修改。

### 22. db/mod.rs — 抑制 deprecated 警告

**文件**: `src-tauri/src/db/mod.rs`

**问题**: rusqlite 0.35 中 `conn.trace()` 被标记为 deprecated，应使用 `trace_v2`。但迁移到 `trace_v2` 需要较大的 API 变更。

**修复**: 暂用 `#[allow(deprecated)]` 抑制警告。

**验证**: `cargo check` → 零 warning、零 error。`cargo test` → 100 passed。

---

## 五、配置修复（3 个文件）

### 23. tsconfig.node.json — 添加 types: ["node"]

**文件**: `tsconfig.node.json`

**问题**: `vite.config.ts` 中使用 `process.env` 需要 `@ts-expect-error`，因为 tsconfig.node.json 没有声明 Node.js 类型。

**修复**: 添加 `types: ["node"]`。

### 24. vite.config.ts — 移除 @ts-expect-error

**文件**: `vite.config.ts`

**问题**: 添加 `types: ["node"]` 后，`process` 被正确识别，`@ts-expect-error` 不再需要。

**修复**: 移除注释行。

**验证**: 前端构建通过。

### 25. site/tsconfig.app.json — 启用 strict: true

**文件**: `site/tsconfig.app.json`

**问题**: site 子项目未启用 `strict: true`，缺少 null 检查等严格模式保护。主项目已有 strict，site 应保持一致。

**修复**: 添加 `"strict": true`。

---

## 六、文档和配置修正（5 个文件）

### 26. README.md / README_ZH.md — Vite 版本徽章

**文件**: `README.md`, `README_ZH.md`

**问题**: Vite 徽章显示 6.0，但实际依赖是 `"vite": "^7.0.4"`。

**修复**: 改为 7.0。

### 27. README.md / README_ZH.md — 测试框架名称

**文件**: `README.md`, `README_ZH.md`

**问题**: 技术栈表中写"Playwright"，但项目实际使用 WebDriverIO（`e2e-tests/wdio.conf.js`）。

**修复**: 改为 WebDriverIO。

### 28. AGENTS.md — 移除 Windows 绝对路径

**文件**: `AGENTS.md`

**问题**: 第一行包含 `D:\rustproject\QuantaNote`，是原开发者的 Windows 路径，在其他环境下没有意义。

**修复**: 改为通用标题 `# AGENTS.md instructions for QuantaNote`。

### 29. bump-version.mjs — 移除不存在的 slides 引用

**文件**: `scripts/bump-version.mjs`

**问题**: `replaceJsonVersion("slides/package.json")` 引用了不存在的目录，脚本运行时会报错 `ENOENT`。

**修复**: 移除该行。

### 30. deploy-docs.yml — concurrency group 冲突 + pnpm 版本

**文件**: `.github/workflows/deploy-docs.yml`

**问题 1**: 与 `deploy-site.yml` 共用 concurrency group `"pages"`，如果两个 workflow 同时触发，`deploy-site`（有 `cancel-in-progress: true`）会取消 `deploy-docs`。

**问题 2**: 指定 `version: 9`，但根项目用 pnpm 10（`packageManager` 字段），版本不一致可能导致 lockfile 不兼容。

**修复**: concurrency group 改为 `"pages-docs"`，移除 pnpm version 指定（使用 `packageManager` 字段）。

### 31. deploy-site.yml — concurrency group 冲突

**文件**: `.github/workflows/deploy-site.yml`

**问题**: 同上，与 deploy-docs.yml 共用 `"pages"` 组。

**修复**: 改为 `"pages-site"`。

---

## 七、新增：CI 工作流

### 32. .github/workflows/pr-check.yml（新建）

**文件**: `.github/workflows/pr-check.yml`

**问题**: 原来没有 PR/push 触发的 CI。代码质量问题只能在 Release 构建时（tag push）发现，没有质量门禁。

**修复**: 新建 PR 检查工作流，包含两个并行 job：

| Job | 步骤 |
|---|---|
| Frontend Check | pnpm install → pnpm build（含 tsc）→ pnpm test:unit |
| Rust Check | cargo check → cargo test → cargo fmt --check |

**触发条件**: push 到 master 或 PR 到 master。

---

## 八、新增：sync/diff.rs 测试（14 个）

### 33. src-tauri/src/sync/diff.rs（新增测试）

**问题**: 三方 diff 算法是同步功能的核心逻辑（`compute_diff` 函数），原来零测试覆盖。

**修复**: 新增 14 个测试，覆盖所有关键路径：

| 测试 | 覆盖场景 |
|---|---|
| `local_only_records_are_pushed` | 本地独有记录 → 推送 |
| `remote_only_records_are_pulled` | 远程独有记录 → 拉取 |
| `unchanged_records_counted` | 两端相同 + 基线一致 → 无变化 |
| `local_only_change_is_pushed` | 仅本地修改 → 推送 |
| `remote_only_change_is_pulled` | 仅远程修改 → 拉取 |
| `both_changed_same_content_is_unchanged` | 双方同改（内容相同）→ 无变化 |
| `both_changed_different_content_is_conflict` | 双方异改 → 冲突 |
| `local_wins_strategy_pushes_conflict` | local-wins 策略推送到服务端 |
| `remote_wins_strategy_pulls_conflict` | remote-wins 策略拉取到本地 |
| `auto_strategy_picks_newer_on_conflict` | auto 策略选时间戳更新的一方 |
| `no_baseline_treats_as_new` | 无基线时的降级处理 |
| `cross_table_ids_do_not_collide` | 跨表同 ID 不产生误冲突 |
| `compute_record_hash_is_deterministic` | 记录哈希计算确定性 |
| `compute_file_hash_is_deterministic` | 文件哈希计算确定性 |

**验证**: `cargo test -- sync::diff::tests` → 14 passed; 0 failed

---

## 最终验证结果

| 检查项 | 结果 |
|---|---|
| Rust 编译 | `cargo check` → 零 warning、零 error |
| Rust 测试 | `cargo test` → **100 passed**（86 原有 + 14 新增），0 failed |
| 前端构建 | `pnpm build` → **成功** |
| 前端测试 | 42 passed，27 failed（**全部为原有 i18n locale 问题**，非本次引入） |
