---
title: Frontend Architecture
description: QuantaNote frontend technology stack, page component design, component hierarchy, Zustand state management, and key libraries
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Frontend Architecture

QuantaNote's frontend is built on React 19 with TypeScript strict mode, using Zustand for state management and TailwindCSS for styling. The entire frontend runs as a single-page application inside Tauri's WebView.

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework, function components + Hooks |
| TypeScript | strict | Type-safe JavaScript superset |
| Zustand | 5 | Lightweight state management library |
| TailwindCSS | 4 (Vite plugin) | Utility-first CSS framework |
| Vite | 7 | Frontend build tool and dev server |
| Vditor | 3 | Markdown editor (WYSIWYG) |
| Lucide React | - | Icon library |
| i18next | - | Internationalization (Chinese/English) |
| @tauri-apps/api | 2.0 | Tauri frontend API (invoke, event, window) |

## Page Components

QuantaNote contains 4 core page components, each corresponding to a major functional area:

### WorkspacePage

Quick capture entry point, providing a text input area with real-time Markdown preview. Users can quickly create notes, and the system automatically extracts titles from content.

### LibraryPage

The main record management interface, supporting search, tag filtering, list display, and a side drawer reader. Integrates full-text search, tag filtering, and paginated loading.

### DocumentEditorPage

A full-screen Vditor Markdown editor supporting WYSIWYG editing mode. Integrates a version history panel for viewing, comparing, and restoring previous versions.

### SettingsPage

Application configuration interface, including appearance settings (font, font size, accent color), window behavior, data management (import/export/backup), SQL logging, and sync configuration.

## Component Hierarchy

Frontend components are organized in the following hierarchy:

```
App.tsx
  └── QuantaNoteApp.tsx          — Routing, global shortcuts, state orchestration
       └── ErrorBoundary         — Global error boundary
            └── AppShell         — Shell layout (TopBar + content area)
                 ├── TopBar      — Top navigation bar (page switch, search, status indicators)
                 ├── WorkspacePage     (currentPage === "workspace")
                 ├── LibraryPage      (currentPage === "library")
                 ├── DocumentEditorPage (currentPage === "document")
                 ├── SettingsPage     (currentPage === "settings")
                 ├── CommandPalette   — Ctrl+K global search palette
                 └── ToastContainer   — Global toast notifications
```

### QuantaNoteApp

The core orchestration component, responsible for:
- Listening to `currentPage` state to switch between pages
- Handling global keyboard shortcuts (Ctrl+K search, Ctrl+N new note)
- Listening to system tray command events
- Initializing all Stores (appStore, settingsStore, syncStore)
- Converting `ItemDto` to frontend `Item` view model via `adaptItem()`

### AppShell

The layout shell component, providing a unified layout framework with TopBar and content area. Receives the current page identifier and navigation callbacks.

## State Management

The frontend uses 8 Zustand Stores to manage application state, each with clear and independent responsibilities:

| Store | File | Key State |
|-------|------|-----------|
| appStore | `stores/appStore.ts` | currentPage, selectedItemId, theme, paletteOpen |
| itemStore | `stores/itemStore.ts` | items, selectedItem, pinnedItems, recentItems |
| tagStore | `stores/tagStore.ts` | tags, itemTags |
| searchStore | `stores/searchStore.ts` | query, results, searching |
| attachmentStore | `stores/attachmentStore.ts` | attachments |
| settingsStore | `stores/settingsStore.ts` | settings, dbSize, autoBackupConfig |
| syncStore | `stores/syncStore.ts` | config, state, history, pendingConflicts |
| toastStore | `stores/toastStore.ts` | toasts |

See the [State Management](/docs/architecture/state-management) chapter for detailed Store design.

## Key Libraries

### Tauri API

- `@tauri-apps/api/core` — `invoke()` function for calling Rust backend commands
- `@tauri-apps/api/event` — `listen()` function for listening to events emitted from Rust (e.g., sync state changes)
- `@tauri-apps/api/window` — Window control (always-on-top, minimize, etc.)
- `@tauri-apps/plugin-dialog` — Native file selection dialog
- `@tauri-apps/plugin-opener` — External link opener
- `@tauri-apps/plugin-autostart` — Auto-start management

### Vditor

The core Markdown editor, configured in WYSIWYG (What You See Is What You Get) mode. Resources are preloaded at application startup via `preloadVditorResources()` to reduce the delay when opening the editor for the first time.

### i18next

Internationalization framework supporting Chinese (zh-CN) and English (en) languages. Language files are located in the `src/i18n/` directory, with language switching handled through the `locale` setting in `settingsStore`.

## Service Layer

`src/services/tauriCommands.ts` wraps all Tauri `invoke()` calls, providing typed frontend-backend contracts:

```typescript
// Service layer wrapper examples
export async function createItem(title: string, itemType: string, content?: string) {
  return invoke("create_item", { title, itemType, content: content ?? null });
}

export async function searchItems(query: string, itemType?: string) {
  return invoke("search_items", { query, itemType: itemType ?? null });
}
```

All Stores communicate with the backend through this service layer rather than calling `invoke()` directly, ensuring consistency and maintainability of the calls.

## Adapter Pattern

`src/adapters/itemAdapter.ts` converts backend `ItemDto` to frontend `Item` view model:

```typescript
export function adaptItem(dto: ItemDto): Item {
  const itemType = (dto.item_type || "note") as ItemType;
  return {
    id: dto.id,
    type: itemType,
    title: dto.title,
    summary: dto.summary || dto.content?.slice(0, 60) || "",
    tags: [] as Tag[],
    time: formatRelativeTime(dto.updated_at || dto.created_at),
    icon: TYPE_TO_ICON[dto.item_type] ?? FileText,
    accent: TYPE_TO_ACCENT[dto.item_type] ?? "cyan",
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}
```

The adapter handles the following transformations:
- **Icon mapping**: Selects the corresponding Lucide icon based on `item_type`
- **Accent mapping**: Different record types use different accent colors
- **Relative time**: Converts ISO timestamps to friendly formats like "just now", "3 min ago"
- **Summary fallback**: Extracts the first 60 characters from `content` when `summary` is empty
