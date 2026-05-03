---
title: Technology Stack
description: Frontend and backend technology choices and core dependencies used by QuantaNote
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Technology Stack

QuantaNote uses a decoupled desktop application architecture based on the Tauri 2.0 framework, combining a web frontend with a Rust backend. Below is a detailed overview of the technologies and core dependencies used at each layer.

## Frontend

The frontend uses a modern React ecosystem with a focus on type safety and developer experience:

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19 | UI framework for building component-based interfaces |
| **TypeScript** | strict mode | Type-safe JavaScript superset |
| **Zustand** | 5 | Lightweight state management library |
| **TailwindCSS** | 4 (Vite plugin) | Utility-first CSS framework |
| **Vditor** | 3 | Markdown editor with WYSIWYG support |
| **Lucide React** | - | Icon library for consistent iconography |

### State Management

QuantaNote uses 6 Zustand stores to manage application state:

- `appStore` — Navigation, global panels, selected item, theme
- `itemStore` — Item CRUD operations, list and detail management
- `searchStore` — FTS5 full-text search queries and results
- `tagStore` — Tag CRUD, item associations
- `attachmentStore` — Attachment CRUD management
- `settingsStore` — Font, font size, theme color, and other preferences

### Frontend-Backend Communication

The frontend communicates with the backend through Tauri's `invoke()` API, with all parameters and return values serialized as JSON. All calls are encapsulated in `services/tauriCommands.ts` with complete type definitions.

## Backend

The backend is written in Rust, providing native desktop capabilities through the Tauri framework:

| Technology | Version | Purpose |
|------------|---------|---------|
| **Rust** | stable | Backend language ensuring memory safety and performance |
| **Tauri** | 2.0 | Desktop application framework connecting frontend and backend |
| **rusqlite** | 0.31 (bundled SQLite) | SQLite database bindings |
| **serde_json** | - | JSON serialization/deserialization |
| **chrono** | - | Date and time handling |
| **uuid** | v4 | UUID generation |

### Layered Architecture

The backend follows a strict layered architecture with clear separation of concerns:

```
Tauri Commands (commands/)     — Thin layer, parameter parsing and delegation
    ↓
Services (services/)           — Business logic layer
    ↓
Repositories (repositories/)   — Data access layer, raw SQL queries
    ↓
SQLite (db/)                   — Database connection and schema
```

## Database

QuantaNote uses SQLite as its local database for reliable data persistence:

| Feature | Description |
|---------|-------------|
| **SQLite** | Embedded relational database |
| **WAL mode** | Write-Ahead Logging for improved concurrent read/write performance |
| **FTS5** | Full-text search engine with tokenization support |
| **Foreign keys** | `foreign_keys=ON` enabled for data integrity |

### Core Data Tables

- `items` — Note entries
- `tags` — Tags
- `item_tags` — Item-tag many-to-many association
- `attachments` — Attachments
- `versions` — Version history
- `items_fts` — FTS5 full-text search virtual table

The database file is stored at `~/.quantanote/quanta_note.sqlite`. A WAL checkpoint is performed when the application closes.

## Testing

QuantaNote employs a three-tier testing strategy:

| Test Type | Tool | Scope |
|-----------|------|-------|
| **Frontend unit tests** | Vitest + jsdom | Components, stores, utility functions |
| **Frontend component tests** | @testing-library/react | Component interaction behavior |
| **Rust unit tests** | cargo test | Business logic, data access |
| **E2E tests** | WebdriverIO | Complete user workflows |

## Build Tools

| Tool | Purpose |
|------|---------|
| **Vite 7** | Frontend bundling and dev server |
| **pnpm** | Package manager (strictly used, npm/yarn not supported) |
| **cargo** | Rust compilation and package management |
| **tauri-cli** | Tauri build and development toolchain |

## Theme System

QuantaNote supports light and dark themes through CSS variables:

- `data-theme="light"` — Light theme
- `data-theme="dark"` — Dark theme
- System mode auto-adapts via `matchMedia`

Core CSS variables include: `--app-bg`, `--paper`, `--text`, `--muted`, `--line`, `--field`, `--hover`, `--accent`, `--accent-soft`, `--popover`.
