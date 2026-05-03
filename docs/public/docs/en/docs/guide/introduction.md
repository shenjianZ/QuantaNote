---
title: Introduction to QuantaNote
description: Learn about QuantaNote — a local-first desktop information management tool, its design philosophy and core features
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Introduction to QuantaNote

## What is QuantaNote

QuantaNote is a **local-first** desktop information management tool built on the [Tauri 2.0](https://tauri.app/) framework. It combines the performance of a Rust backend with the flexibility of a React frontend to deliver a lightweight, fast, and secure note-taking and knowledge management experience.

Unlike most note-taking apps that require cloud accounts and internet connectivity, QuantaNote stores all data in a local SQLite database on your device. This means you have complete control over your data, with no concerns about privacy leaks or service outages.

QuantaNote's data directory is located at `~/.quantanote/` (on Windows: `%USERPROFILE%\.quantanote\`), and the core database file is `quanta_note.sqlite`, running in WAL mode for high-performance read and write operations.

## Why Local-First

"Local-first" is more than a technical choice — it is a data philosophy:

- **Data Ownership** — Your notes, thoughts, and knowledge belong entirely to you. No third-party server can access or control your data. You can export, back up, or migrate at any time.

- **Offline Capability** — Regardless of where you are or your network conditions, QuantaNote is always available. On an airplane, on the subway, or in an area with unstable connectivity, you can record and edit as usual.

- **Privacy Protection** — Data is never transmitted through or stored on third-party servers, eliminating the risk of data breaches at the source. Your privacy is in your hands.

- **Blazing Speed** — The local SQLite database delivers millisecond-level read and write performance. Combined with the FTS5 full-text search index, QuantaNote stays responsive even with large volumes of data.

## Core Features

QuantaNote provides a complete set of note-taking and information management capabilities:

### Markdown Editing

Powered by the [Vditor](https://github.com/Vanessa219/vditor) editor, QuantaNote offers a WYSIWYG Markdown editing experience with live preview, code syntax highlighting, math formulas (KaTeX), flowcharts, tables, and more. Whether you are writing a quick memo or a complex technical document, the editor handles it with ease.

### Full-Text Search

Built on the SQLite FTS5 engine, the full-text search system supports Chinese and English tokenization and can find what you need from thousands of records in milliseconds. Press `Ctrl+K` at any time to bring up the search panel.

### Tag Management

Create tags with color identifiers for your notes, and use them to categorize and filter. Supports multi-tag associations for flexible knowledge organization.

### Version History

Automatically records history for every edit, with diff comparison between versions and one-click rollback. Mistakes are no longer a concern — you can restore any previous state at any time.

### Attachment Management

Embed images, files, and other attachments in your notes. Attachments are stored in association with their notes for easy management and retrieval.

### Multi-Device Sync

Sync data across multiple devices with a built-in three-way diff algorithm and conflict resolution mechanism, ensuring data consistency in multi-device editing scenarios.

### Automatic Backup

Regular automatic backups keep your data safe. Manual import and export are also supported for complete data security.

## Use Cases

QuantaNote is suitable for a wide range of personal knowledge and information management scenarios:

- **Personal Notes** — Daily records, idea capture, meeting minutes, study notes. The quick capture page lets you record thoughts anytime, anywhere.
- **Knowledge Management** — Build and manage a personal knowledge base using the tag system and full-text search. Supports Markdown format for structured knowledge documentation.
- **Task Tracking** — Combine pinned items, favorites, and tags to manage to-do items and track project progress.
- **Code Snippets** — Use Markdown code blocks with syntax highlighting to collect and organize commonly used code snippets and technical references.
