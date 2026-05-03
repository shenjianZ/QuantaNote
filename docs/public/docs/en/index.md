---
title: QuantaNote
description: QuantaNote — A local-first desktop information management tool built with Tauri 2.0
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# QuantaNote

A **local-first** desktop information management tool. Your data stays on your device — no internet required, no subscriptions, complete control.

QuantaNote is built with Tauri 2.0, combining the performance of a Rust backend with the flexibility of a React frontend to deliver a lightweight, fast, and secure note-taking and knowledge management experience. All data is stored in a local SQLite database, with multi-device sync and conflict resolution support.

## Core Features

- ✍️ **Markdown Editing** — WYSIWYG editor powered by Vditor, with live preview, syntax highlighting, math formulas, and flowcharts
- 🔍 **Full-Text Search** — Millisecond-level full-text search powered by SQLite FTS5, supporting Chinese and English tokenization
- 🏷️ **Tag Management** — Assign colorful tags to notes, quickly filter and categorize by tag
- 📜 **Version History** — Automatically save edit history, compare versions, and rollback with one click
- 📎 **Attachment Management** — Embed and manage images, files, and other attachments
- 🔄 **Multi-Device Sync** — Sync data between devices with built-in three-way diff and conflict resolution
- 💾 **Data Security** — Automatic backup, manual import/export, you have full control over your data
- 🌙 **Theme Switching** — Light and dark themes, follow system preference or switch manually

## Why QuantaNote

Unlike cloud-based note-taking apps, QuantaNote puts your data first:

- **Fully Offline** — No internet connection needed, record and edit anytime, anywhere
- **Privacy First** — Data never passes through third-party servers, your notes belong to you alone
- **Blazing Performance** — Local SQLite database delivers millisecond responses with zero network latency
- **Open & Transparent** — Open source project, code fully public, welcoming community review and contributions

## Quick Start

Download the latest installer from GitHub Releases:

- [Download Windows version (.msi / .exe)](https://github.com/shenjianZ/QuantaNote/releases)
- [Download macOS version (.dmg)](https://github.com/shenjianZ/QuantaNote/releases)
- [Download Linux version (.deb / .AppImage)](https://github.com/shenjianZ/QuantaNote/releases)

On first launch, QuantaNote automatically creates the database file `quanta_note.sqlite` in the `~/.quantanote/` directory. No additional configuration is needed to start using it.

## Links

- **[Documentation](/docs)** — Browse the complete usage guide and feature documentation
- **[Quick Start](/docs/guide/quick-start)** — Learn to use QuantaNote in 5 minutes
- **[GitHub](https://github.com/shenjianZ/QuantaNote)** — View source code, submit issues, or contribute
