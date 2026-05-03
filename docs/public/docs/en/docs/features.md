---
title: Features
description: Explore all the features QuantaNote offers for managing your notes, documents, and knowledge.
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Features

QuantaNote is a local-first desktop note-taking application built with Tauri 2.0. It combines a fast Rust backend with a modern React frontend to deliver a powerful, privacy-respecting note management experience. All data is stored locally on your machine in a SQLite database with full-text search capabilities.

Below is an overview of every major feature. Click each link to learn more.

## Core Features

- **[Workspace](./workspace.md)** — A quick capture page for instantly recording ideas, thoughts, and notes without interrupting your workflow.

- **[Library](./library.md)** — Browse, filter, search, and manage all your items in one place. Includes card-based views, tag filtering, sorting, and a side drawer for reading.

- **[Document Editor](./document-editor.md)** — A full-screen editing experience with a rich toolbar, auto-save, version history panel, and favorite toggling.

- **[Markdown Editor](./markdown-editor.md)** — Based on Vditor IR (Instant Rendering) mode, offering a WYSIWYG-like editing experience with full Markdown support, search and replace, and keyboard shortcuts.

## Organization

- **[Tags](./tags.md)** — Organize your items with colored labels. Create, assign, rename, recolor, and delete tags. Filter your library by any tag.

- **[Attachments](./attachments.md)** — Attach files to any item. Supports images, audio, video, PDF, and text files with inline preview capabilities.

- **[Version History](./version-history.md)** — Every content change is tracked. Browse past versions, compare diffs, name and describe versions, and restore any previous state.

## Search and Navigation

- **[Full-Text Search](./search.md)** — A dual-engine FTS5 search system that supports both English and Chinese text, including substring matching for CJK characters.

- **[Command Palette](./command-palette.md)** — Press `Ctrl+K` to instantly search and navigate across all items. A global quick-access tool for power users.

## Design Principles

- **Local-first** — All data lives on your machine. No cloud dependency, no accounts required for core functionality.
- **Fast and lightweight** — Built on Tauri 2.0 with a Rust backend, the app starts instantly and uses minimal system resources.
- **Privacy-focused** — Your notes never leave your device unless you explicitly export or sync them.
- **Markdown-native** — Everything is stored in Markdown, ensuring your data remains portable and future-proof.
