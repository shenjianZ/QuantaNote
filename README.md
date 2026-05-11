<div align="center">

# QuantaNote

**🌐 Language**: [English](#) | [中文](./README_ZH.md)

![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri&logoColor=000000)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=000000)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=FFFFFF)
![Rust](https://img.shields.io/badge/Rust-1.70+-000000?logo=rust&logoColor=FFFFFF)
![Vite](https://img.shields.io/badge/Vite-7.0-646CFF?logo=vite&logoColor=FFFFFF)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-06B6D4?logo=tailwindcss&logoColor=FFFFFF)
![Zustand](https://img.shields.io/badge/Zustand-5.0-FFB84D?logoColor=FFFFFF)
![SQLite](https://img.shields.io/badge/SQLite-0.31-003B57?logo=sqlite&logoColor=FFFFFF)
![License](https://img.shields.io/badge/License-MIT-green)

A local-first desktop note management app with Markdown editing, full-text search, tag management, attachments, version history, and auto backup. All data stays on your machine.

**[Features](#-features)** • **[Screenshots](#-screenshots)** • **[Quick Start](#-quick-start)** • **[Tech Stack](#-tech-stack)** • **[Download](#-download)**

<img src="app-img/library.png" alt="Library" width="800" />

</div>

## Features

- **Markdown Editor** — Vditor IR mode with toolbar shortcuts, find & replace (`Ctrl+F` / `Ctrl+H`)
- **Full-Text Search** — FTS5 + trigram dual engine, Chinese substring search supported
- **Tag Management** — Create, edit, filter; many-to-many tag-item associations
- **Command Palette** — `Ctrl+K` global quick search
- **Version History** — Create, preview, restore versions; diff comparison between two versions
- **Attachments** — Preview images, audio, video, PDF, and text files
- **Import / Export** — JSON (with attachments) or ZIP (selectable: tags, attachments, version history)
- **Auto Backup** — Scheduled backups with configurable interval and retention
- **Themes** — Dark / light / system-follow, custom accent colors and fonts
- **System Tray** — Minimize or close to tray, context menu, auto-start on boot

## Screenshots

<div align="center">
<table>
  <tr>
    <td align="center"><img src="app-img/note-preview.png" alt="Note Preview" width="400" /><br /><b>Note Preview</b></td>
    <td align="center"><img src="app-img/note-edit.png" alt="Note Editing" width="400" /><br /><b>Note Editing</b></td>
  </tr>
  <tr>
    <td align="center"><img src="app-img/workspace.png" alt="Workspace" width="400" /><br /><b>Workspace</b></td>
    <td align="center"><img src="app-img/settings-appearance.png" alt="Settings" width="400" /><br /><b>Settings</b></td>
  </tr>
  <tr>
    <td align="center"><img src="app-img/search-cmd.png" alt="Command Palette" width="400" /><br /><b>Command Palette</b></td>
    <td align="center"><img src="app-img/note-version.png" alt="Version History" width="400" /><br /><b>Version History</b></td>
  </tr>
</table>

**[View all screenshots →](./SCREENSHOTS.md)**
</div>

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Zustand 5, TailwindCSS 4, Vditor 3 |
| Backend | Tauri 2, Rust, rusqlite 0.31 |
| Database | SQLite (WAL mode, FTS5 full-text search) |
| Testing | Vitest, WebDriverIO, cargo test |

## Quick Start

```bash
# Install dependencies
pnpm install

# Development mode (frontend + Rust backend)
pnpm tauri dev

# Frontend only (Vite, port 1420)
pnpm dev
```

## Build

```bash
# Production build (Windows: .msi + .exe, Linux: .deb + .AppImage, macOS: .dmg + .app)
pnpm tauri build

# Type check
pnpm build && cargo check --manifest-path src-tauri/Cargo.toml
```

## Download

Download installers for your platform from [GitHub Releases](https://github.com/shenjianZ/QuantaNote/releases).

## License

[MIT](./LICENSE)
