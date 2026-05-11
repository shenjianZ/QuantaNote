# Changelog

本文件记录 QuantaNote 的版本更新历史。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.2.2] - 2026-05-11

### Fixed

- 修复桌面端更新器公钥配置被占位符覆盖，导致下载更新后签名校验失败的问题。
- 更新关于页的更新错误提示，签名校验失败时显示明确原因。

## [0.2.1] - 2026-05-11

### Changed

- 升级 rusqlite 0.31→0.35、thiserror 1→2、hashlink 0.9→0.10
- 同步状态管理改用 `Result` 替代 `unwrap`，改善错误传播
- CI concurrency 分组独立命名，避免 docs/site 部署互相取消

### Added

- 密码长度（≥8位）、标签颜色、记录类型等输入验证
- 同步 diff 模块单元测试（冲突策略、跨表 ID、哈希确定性等）
- PR Check workflow（仅手动触发）

### Fixed

- 前端 TopBar 兼容非 Tauri 环境（浏览器预览不再报错）
- 标签加载状态管理，fetchTags 正确设置 loading/error
- 删除账号异常时显示错误提示而非静默失败
- 编辑器搜索高亮改用 DOM API，移除 innerHTML 替换
- SettingsPage 开关组件添加 role="switch" 和 aria-checked 无障碍属性

## [0.2.0] - 2026-05-05

### Added

#### 账号管理
- 新增个人资料页面，支持查看和修改昵称
- 修改密码功能，独立模态框输入旧密码和新密码
- 删除账号功能，需输入邮箱二次确认，服务端自动清理关联数据
- 未登录状态下账号入口引导用户配置服务器或登录

#### 云同步增强
- Token 刷新竞态条件修复，并发请求共享同一刷新 Promise
- 同步状态指示器显示上次同步时间
- Redis 键命名空间 `qn-cloud:` 前缀，支持多应用共享 Redis 实例
- 环境变量分隔符统一为双下划线 `__`（如 `DATABASE__HOST`）
- Rust HTTP 请求日志补全 URL 全路径输出

#### 云服务端部署
- Docker 多阶段构建镜像 (rust:1.85 + debian:bookworm-slim)
- docker-compose 编排 (PostgreSQL 17 + Redis 7 + quantanote-cloud)
- .env.example 全量环境变量模板
- GitHub Actions CI 推送 Docker 镜像到阿里云 ACR
- 启动配置日志新增 Email 模块打印

#### 文档站
- 文档站配置补齐缺失字段 (sidebar collapseControl、toc collapseControl、reading fullscreen、backend)
- 新增 GitHub Actions 自动部署文档到 GitHub Pages
- 设置页文档按钮链接到 GitHub Pages 文档站

#### 其他
- 设置页关于按钮添加图标 (GitHub / BookOpen / MessageSquare)
- `pnpm bump` 脚本支持自动更新 SettingsPage.tsx 中的版本号
- reqwest 连接日志级别调整为 Warn，减少噪音输出
- 服务端邮件配置模块 (EmailConfig / EmailService)

### Fixed

- 修复修改密码接口返回空响应导致前端误判为失败
- 修复删除账号 422 错误 (DeleteUserRequest 字段默认值)
- 修复删除账号外键约束失败 (关联数据删除顺序调整)
- 修复环境变量单下划线分隔符无法映射嵌套配置

## [0.1.0] - 2026-05-02

### Added

#### 笔记编辑
- Markdown 笔记编辑器，基于 Vditor IR 模式，支持快捷键工具栏
- 全文查找替换 (Ctrl+F / Ctrl+H)，支持区分大小写
- 编辑器通过 forwardRef 暴露 getValue/focus 方法

#### 搜索与组织
- 全文搜索 (FTS5 + trigram 双引擎)，支持中文子串检索
- 标签管理系统 (CRUD + 多对多关联 + 筛选)
- 列表项显示标签，最多 3 个，超出显示 +N
- 命令面板 (Ctrl+K) 全局快速搜索
- 搜索结果使用项的摘要字段显示
- 文档摘要功能，自动提取内容前 10 个字符
- 记录标题工具函数，优先使用 Markdown 标题作为记录名称

#### 版本管理
- 版本历史记录 (创建/预览/恢复)
- 版本 Diff 对比，支持选择两个版本进行差异比较
- 编辑器内容变更时自动创建版本快照

#### 附件管理
- 附件上传与管理，支持图片/音频/视频/PDF/文本预览
- 附件路径采用相对路径存储

#### 数据导入导出
- JSON 格式数据导入导出 (含附件)
- ZIP 格式选择性导出/导入 (可选标签、附件、版本历史)
- 导出前显示数据大小预估

#### 自动备份
- 定时自动备份，可配置备份间隔和保留数量
- 备份管理器，支持查看、删除历史备份
- 手动触发即时备份

#### 界面与主题
- 深色/浅色主题切换，跟随系统或手动设置
- 自定义强调色 (内置 + 自定义取色器)
- 字体本地化，自定义正文字体/等宽字体及字号
- 文本选中色与强调色同步
- 全局 Toast 通知系统
- React Error Boundary 防止组件渲染错误导致白屏
- 加载状态 UI，骨架屏 + 搜索 spinner

#### 系统集成
- 系统托盘，支持最小化/关闭到托盘
- 系统托盘右键菜单 (显示主窗口/快速记录/退出)
- 开机自启动设置
- 数据库路径显示与一键打开数据目录
- 支持隐藏启动模式

#### 设置中心
- 通用设置 (主题/字体/字号/强调色)
- 数据管理 (数据库信息/优化/导入导出)
- 备份管理 (自动备份配置/手动备份)
- SQL 日志诊断 (可配置日志输出到控制台/文件)
- 快捷键说明
- 应用设置统一存储到 SQLite (替代 localStorage)

#### 开发者体验
- CI/CD 自动化构建，推送 tag 时自动构建 Windows/Linux/macOS 安装包
- E2E 测试覆盖 (Playwright + Page Object 模式)
- Rust 后端单元测试 (commands/services/repositories)
- SQL 日志可配置输出 (控制台/文件/pretty 格式)
- Vditor 资源预加载优化启动性能

### Fixed

- 修复发布构建产物缺少 Vditor 本地资源导致编辑器加载中文语言包 404 的问题
- 修复编辑器粘贴事件丢失和版本比较尾部空白问题
- 修复预览区域 Ctrl+C 复制被全局快捷键拦截的问题
