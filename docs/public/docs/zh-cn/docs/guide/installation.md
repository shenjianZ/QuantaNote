---
title: 安装 QuantaNote
description: QuantaNote 下载与安装指南，支持 Windows、macOS 和 Linux
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# 安装 QuantaNote

## 系统要求

在安装 QuantaNote 之前，请确保你的设备满足以下最低要求：

| 平台 | 最低版本 | 架构 |
|------|----------|------|
| Windows | Windows 10 (1803+) | x64 |
| macOS | macOS 10.15 (Catalina)+ | x64 / Apple Silicon |
| Linux | 主流发行版 (Ubuntu 20.04+, Fedora 36+ 等) | x64 |

> **磁盘空间**：安装包约 20-40 MB，安装后应用占用约 80-120 MB。随着使用过程中数据和附件的积累，磁盘占用会逐渐增加。

## 下载安装

QuantaNote 的所有发行版本均发布在 GitHub Releases 页面：

👉 [GitHub Releases 下载页面](https://github.com/shenjianZ/QuantaNote/releases)

### Windows

1. 在 Releases 页面下载最新的 `.msi` 安装包（推荐）或 `.exe` 安装程序。
2. 双击运行下载的安装包。
3. 如果 Windows SmartScreen 弹出安全提示，点击「更多信息」→「仍要运行」。
4. 按照安装向导完成安装。
5. 安装完成后，从开始菜单或桌面快捷方式启动 QuantaNote。

> **便携版**：如果需要免安装使用，可以下载 `.exe` 便携版，解压后直接运行即可，无需管理员权限。

### macOS

1. 在 Releases 页面下载最新的 `.dmg` 文件。
2. 双击打开 `.dmg` 文件。
3. 将 QuantaNote 图标拖拽到「应用程序」文件夹中。
4. 首次打开时，如果 macOS 提示「无法验证开发者」，请前往「系统设置」→「隐私与安全性」→ 点击「仍要打开」。

> **Apple Silicon (M1/M2/M3/M4)**：QuantaNote 已原生支持 Apple Silicon，无需通过 Rosetta 转译运行。

### Linux

**DEB 包（Ubuntu / Debian）：**

```bash
# 下载 .deb 包后安装
sudo dpkg -i quantanote_x.x.x_amd64.deb

# 如果提示缺少依赖，运行：
sudo apt-get install -f
```

**AppImage（通用）：**

```bash
# 下载 .AppImage 文件后添加执行权限
chmod +x quantanote_x.x.x_amd64.AppImage

# 运行
./quantanote_x.x.x_amd64.AppImage
```

## 首次启动

首次启动 QuantaNote 时，应用会自动完成以下初始化操作：

1. **创建数据目录** — 在用户主目录下创建 `~/.quantanote/` 目录：
   - Windows: `C:\Users\<你的用户名>\.quantanote\`
   - macOS: `/Users/<你的用户名>/.quantanote/`
   - Linux: `/home/<你的用户名>/.quantanote/`

2. **初始化数据库** — 自动创建 `quanta_note.sqlite` 数据库文件，并执行 Schema 初始化，创建所需的表和索引：
   - `items` — 笔记条目表
   - `tags` — 标签表
   - `item_tags` — 笔记与标签的多对多关联表
   - `attachments` — 附件表
   - `versions` — 版本历史表
   - `items_fts` — FTS5 全文搜索虚拟表

3. **设置数据库参数** — 自动配置 SQLite 的 WAL 日志模式和启用外键约束，确保数据完整性和高性能。

初始化完成后，你将看到 QuantaNote 的主界面，可以立即开始创建笔记。

## 卸载

如果需要卸载 QuantaNote，请按照以下步骤操作：

### Windows

- 通过「设置」→「应用」→ 找到 QuantaNote → 点击「卸载」
- 或通过控制面板的「程序和功能」卸载

### macOS

- 打开「应用程序」文件夹，将 QuantaNote 拖入废纸篓
- 或使用 Launchpad 长按图标后点击删除

### Linux

```bash
# DEB 包安装的卸载
sudo dpkg --remove quantanote

# AppImage 版本直接删除文件即可
rm quantanote_x.x.x_amd64.AppImage
```

> **数据保留**：卸载 QuantaNote **不会**删除你的数据。所有笔记、标签、附件和设置都保存在 `~/.quantanote/` 目录中。如果你希望彻底清除所有数据，请手动删除该目录：
>
> ```bash
> # 谨慎操作：删除所有 QuantaNote 数据
> rm -rf ~/.quantanote/
> ```
