# QuantaNote

QuantaNote 是一个本地优先的桌面信息管理应用，基于 Tauri 2、React 19、Rust 和 SQLite 构建。

## 开发

```bash
pnpm install
pnpm dev
pnpm tauri dev
```

## 构建

```bash
pnpm build
pnpm tauri build
```

## 当前能力

- 本地笔记、文件记录、标签、附件和全文搜索
- 密码保险箱，使用 Argon2id 和 AES-256-GCM 加密
- 文档自动保存和版本历史
- JSON 备份与恢复

云同步仍处于开发中。
