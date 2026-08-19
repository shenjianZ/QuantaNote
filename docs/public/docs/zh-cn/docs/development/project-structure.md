---
title: 项目结构
description: QuantaNote 的目录结构设计和代码组织方式
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-19
---

# 项目结构

本文介绍 QuantaNote 的目录结构设计，帮助你快速定位代码和理解项目组织方式。

## 根目录

```
QuantaNote/
├── package.json              # 前端依赖和脚本配置
├── pnpm-lock.yaml            # pnpm 依赖锁定文件
├── vite.config.ts            # Vite 构建配置
├── tsconfig.json             # TypeScript 配置
├── tsconfig.node.json        # Node 环境 TypeScript 配置
├── tailwind.config.ts        # TailwindCSS 配置
├── index.html                # 入口 HTML 文件
├── CLAUDE.md                 # Claude Code 项目指引
├── src/                      # 前端源码
├── src-tauri/                # Rust 后端源码
├── e2e-tests/                # WebdriverIO E2E 测试
└── docs/                     # 文档网站源码
```

## src/ — 前端源码

```
src/
├── main.tsx                  # 应用入口，挂载 React 根组件
├── App.tsx                   # 根组件（已废弃，逻辑迁移至 QuantaNoteApp）
├── app/
│   └── QuantaNoteApp.tsx     # 主应用组件（路由、全局快捷键、状态编排）
├── components/
│   ├── layout/               # 布局组件
│   │   ├── AppShell.tsx      # 应用外壳（TopBar + 内容区）
│   │   ├── TopBar.tsx        # 顶部导航栏
│   │   └── StatusBar.tsx     # 底部状态栏
│   ├── common/               # 通用组件
│   │   ├── Modal.tsx         # 基础弹窗组件
│   │   ├── Select.tsx        # 下拉选择组件
│   │   ├── ColorPickerModal.tsx    # 颜色选择器
│   │   ├── TagManagerModal.tsx     # 标签管理
│   │   ├── TagPickerModal.tsx      # 标签选择
│   │   ├── AttachmentManagerModal.tsx  # 附件管理
│   │   ├── VersionPreviewModal.tsx    # 版本预览
│   │   ├── BackupManagerModal.tsx     # 备份管理
│   │   ├── ExportModal.tsx           # 数据导出
│   │   ├── ImportModal.tsx           # 数据导入
│   │   └── ErrorBoundary.tsx         # 错误边界
│   ├── editor/               # 编辑器相关组件
│   │   ├── SearchReplaceBar.tsx   # 搜索替换栏
│   │   └── VersionPanel.tsx       # 版本面板
│   ├── auth/                 # 认证相关组件
│   │   ├── LoginModal.tsx        # 登录弹窗
│   │   ├── RegisterModal.tsx     # 注册弹窗
│   │   ├── ForgotPasswordModal.tsx  # 忘记密码
│   │   └── ResetPasswordModal.tsx   # 重置密码
│   ├── sync/                 # 同步相关组件
│   │   ├── SyncSettingsPanel.tsx    # 同步设置
│   │   ├── SyncStatusIndicator.tsx  # 同步状态指示
│   │   ├── ConflictResolutionModal.tsx  # 冲突解决
│   │   └── ConflictResolver.tsx     # 冲突解决器
│   ├── search/               # 搜索组件
│   │   └── CommandPalette.tsx  # Ctrl+K 全局搜索
│   └── version/              # 版本相关组件
│       └── VersionDiffModal.tsx  # 版本差异对比
├── pages/
│   ├── WorkspacePage.tsx     # 快速记录页（输入 + Markdown 预览）
│   ├── LibraryPage.tsx       # 记录库（搜索、筛选、阅读器抽屉）
│   ├── DocumentEditorPage.tsx # 全屏 Vditor 编辑器 + 版本记录
│   └── SettingsPage.tsx      # 设置页
├── stores/                   # Zustand 状态管理
│   ├── appStore.ts           # 导航、面板、主题
│   ├── itemStore.ts          # Item CRUD
│   ├── searchStore.ts        # FTS5 搜索
│   ├── tagStore.ts           # 标签管理
│   ├── attachmentStore.ts    # 附件管理
│   ├── settingsStore.ts      # 用户设置
│   └── syncStore.ts          # 同步状态
├── services/
│   └── tauriCommands.ts      # 封装所有 invoke() 调用
├── adapters/
│   └── itemAdapter.ts        # ItemDto → Item 视图模型转换
├── hooks/                    # 自定义 React Hooks
├── i18n/                     # 国际化资源
├── types/                    # TypeScript 类型定义
├── utils/                    # 工具函数
├── styles/
│   └── themes.css            # 亮色/暗色主题 CSS 变量
└── test/                     # 测试工具和配置
    └── test-utils.tsx        # 测试辅助函数
```

## src-tauri/ — Rust 后端源码

```
src-tauri/
├── Cargo.toml                # Rust 依赖和构建配置
├── tauri.conf.json           # Tauri 应用配置
├── icons/                    # 应用图标资源
├── src/
│   ├── lib.rs                # 应用入口，注册所有 Tauri commands
│   ├── main.rs               # 主函数入口
│   ├── error.rs              # AppError 错误枚举
│   ├── commands/             # Tauri Command 层（薄层）
│   │   ├── item.rs           # Item 相关命令
│   │   ├── search.rs         # 搜索命令
│   │   ├── tag.rs            # 标签命令
│   │   ├── attachment.rs     # 附件命令
│   │   ├── version.rs        # 版本命令
│   │   ├── data_io.rs        # 数据导入/导出命令
│   │   └── sync.rs           # 同步命令
│   ├── services/             # 业务逻辑层
│   │   ├── item_service.rs   # Item 业务逻辑
│   │   ├── tag_service.rs    # 标签业务逻辑
│   │   ├── attachment_service.rs  # 附件业务逻辑
│   │   ├── version_service.rs     # 版本业务逻辑
│   │   └── data_io_service.rs     # 导入导出逻辑
│   ├── repositories/         # 数据访问层（原始 SQL）
│   │   ├── item_repository.rs     # Item SQL 查询
│   │   ├── tag_repository.rs      # 标签 SQL 查询
│   │   ├── attachment_repository.rs  # 附件 SQL 查询
│   │   └── version_repository.rs     # 版本 SQL 查询
│   ├── models/               # DTO 和 Payload 结构体
│   │   ├── item.rs           # ItemDto, ItemPayload 等
│   │   ├── tag.rs            # TagDto
│   │   ├── attachment.rs     # AttachmentDto
│   │   ├── version.rs        # VersionDto
│   │   └── sync.rs           # 同步相关 DTO
│   ├── sync/                 # 同步模块
│   │   ├── mod.rs            # 同步入口
│   │   ├── diff.rs           # 差异计算
│   │   └── transport.rs      # 网络传输
│   ├── db/
│   │   └── mod.rs            # 数据库连接、Schema DDL、WAL checkpoint
│   ├── config/               # 配置模块
│   └── utils/                # 工具函数
│       ├── paths.rs          # 数据目录路径
│       ├── ids.rs            # UUID 生成
│       └── logging.rs        # SQL 日志追踪
```

## e2e-tests/ — E2E 测试

```
e2e-tests/
├── wdio.conf.js              # WebdriverIO 配置
├── helpers/                  # Page Object 和测试辅助工具
└── specs/                    # 测试用例
```

## docs/ — 文档网站

```
docs/
├── public/
│   └── docs/
│       ├── zh-cn/            # 中文文档
│       │   └── docs/
│       │       ├── guide/    # 使用指南
│       │       ├── features/ # 功能介绍
│       │       ├── data/     # 数据管理
│       │       └── development/  # 开发文档
│       └── en/               # 英文文档
│           └── docs/
│               ├── guide/
│               ├── features/
│               └── development/
└── ...                       # 文档站点配置和构建文件
```
