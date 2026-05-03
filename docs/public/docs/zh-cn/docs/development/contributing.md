---
title: 贡献指南
description: 如何向 QuantaNote 贡献代码、报告问题和参与开发
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# 贡献指南

感谢你对 QuantaNote 的关注！本文将指导你如何参与 QuantaNote 的开发，包括代码贡献、问题报告和开发流程。

## 开始之前

### Fork 仓库

1. 访问 [QuantaNote GitHub 仓库](https://github.com/shenjianZ/QuantaNote)
2. 点击右上角的 **Fork** 按钮，将仓库 Fork 到你的账户
3. 将 Fork 的仓库克隆到本地：

```bash
git clone https://github.com/你的用户名/QuantaNote.git
cd QuantaNote
```

### 添加上游仓库

```bash
git remote add upstream https://github.com/shenjianZ/QuantaNote.git
```

定期同步上游代码：

```bash
git fetch upstream
git checkout master
git merge upstream/master
```

### 安装依赖

```bash
pnpm install
```

详细的开发环境搭建请参考 [从源码构建](/docs/development/building)。

## 开发流程

### 分支命名规范

为新功能或修复创建分支时，请遵循以下命名规范：

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feat/` | 新功能 | `feat/sync-enhancements` |
| `fix/` | Bug 修复 | `fix/search-crash` |
| `docs/` | 文档更新 | `docs/api-reference` |
| `refactor/` | 代码重构 | `refactor/item-store` |
| `test/` | 测试相关 | `test/e2e-workspace` |
| `chore/` | 杂项 | `chore/update-deps` |

### 创建功能分支

```bash
# 从最新的 master 创建分支
git checkout master
git pull upstream master
git checkout -b feat/your-feature-name
```

### Commit 消息规范

QuantaNote 使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type）：**

- `feat` — 新功能
- `fix` — Bug 修复
- `docs` — 文档更新
- `style` — 代码格式（不影响逻辑）
- `refactor` — 代码重构
- `test` — 测试相关
- `chore` — 构建或辅助工具

**示例：**

```
feat(editor): 添加 Markdown 快捷键支持

为 Vditor 编辑器添加常用 Markdown 快捷键，包括加粗、斜体、代码块等。

Closes #123
```

```
fix(search): 修复全文搜索中文分词问题

FTS5 搜索在处理中文内容时出现截断，更新分词器配置解决问题。

Fixes #456
```

## 代码规范

### TypeScript 规范

- 启用 **strict 模式**，不允许使用隐式 any
- 使用函数式组件和 Hooks，不使用 class 组件
- 优先使用 `interface` 定义类型
- 使用 `enum` 时使用 `const enum` 或字符串联合类型

### CSS 规范

- 使用 TailwindCSS 工具类，不编写自定义 CSS（主题变量除外）
- 主题相关的 CSS 变量命名遵循项目约定：

```css
/* 核心颜色变量 */
--app-bg      /* 应用背景 */
--paper       /* 纸张/卡片背景 */
--text        /* 主文本颜色 */
--muted       /* 次要文本颜色 */
--line        /* 分割线颜色 */
--field       /* 输入框背景 */
--hover       /* 悬浮状态背景 */
--accent      /* 强调色 */
--accent-soft /* 柔和强调色 */
--popover     /* 弹出层背景 */
```

### 包管理器

- **严格使用 pnpm**，禁止使用 npm 或 yarn
- 添加新依赖时使用 `pnpm add <package>`
- 添加开发依赖时使用 `pnpm add -D <package>`

### Rust 规范

- 遵循 `cargo fmt` 格式化标准
- 通过 `cargo clippy` 检查代码质量
- 公共 API 必须编写文档注释 `///`
- 错误处理使用 `Result<T, AppError>`，不使用 `unwrap()`

## 提交更改

### 创建 Pull Request

1. 确保所有测试通过：

```bash
pnpm test:unit && pnpm test:rust
pnpm build && cargo check --manifest-path src-tauri/Cargo.toml
```

2. 格式化代码：

```bash
pnpm format:rust
```

3. 推送分支并创建 PR：

```bash
git push origin feat/your-feature-name
```

4. 在 GitHub 上创建 Pull Request，填写以下信息：
   - **标题** — 使用 Conventional Commits 格式
   - **描述** — 详细说明修改内容和原因
   - **关联 Issue** — 使用 `Closes #123` 或 `Fixes #456`
   - **截图** — UI 修改需附截图

### PR 审查流程

1. 项目维护者会审查你的代码
2. 根据审查意见进行修改
3. 确保所有 CI 检查通过
4. 维护者合并你的 PR

## 报告问题

### 提交 Bug 报告

在 [GitHub Issues](https://github.com/shenjianZ/QuantaNote/issues) 提交 Bug 报告时，请包含：

- **问题描述** — 清晰描述遇到的问题
- **复现步骤** — 逐步说明如何复现
- **预期行为** — 你期望的正确行为
- **实际行为** — 实际发生的情况
- **环境信息** — 操作系统、应用版本
- **日志输出** — 如有错误日志请附上
- **截图** — 如适用

### 功能请求

提交功能请求时，请包含：

- **需求背景** — 为什么需要这个功能
- **功能描述** — 详细描述期望的功能
- **使用场景** — 举出具体的使用场景
- **替代方案** — 你考虑过的其他解决方案

### 问题标签

| 标签 | 含义 |
|------|------|
| `bug` | Bug 报告 |
| `enhancement` | 功能请求 |
| `good first issue` | 适合新贡献者 |
| `help wanted` | 需要社区帮助 |
| `documentation` | 文档相关 |
| `P0` - `P3` | 优先级 |

## 开发提示

- 修改前端 UI 代码后，检查是否需要同步修改 E2E 测试文件
- 允许先批量完成前端修改，再统一修复 E2E 测试
- Windows 上使用 PowerShell 执行命令行操作
- 数据库文件位于 `~/.quantanote/quanta_note.sqlite`，开发时注意备份
