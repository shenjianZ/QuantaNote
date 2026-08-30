---
title: State Management
description: QuantaNote's Zustand Store design — 8 Stores with their responsibilities, cross-store communication, and DTO-to-view-model adapter pattern
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# State Management

QuantaNote uses Zustand 5 as its frontend state management solution. Zustand is a lightweight, boilerplate-free state management library that fits perfectly with Tauri desktop application architecture. The application uses 8 Stores in total, each with clear responsibilities, communicating with the backend through the service layer.

## Store Overview

| Store | File | Responsibility |
|-------|------|----------------|
| appStore | `stores/appStore.ts` | Global app state (navigation, theme, window behavior) |
| itemStore | `stores/itemStore.ts` | Record CRUD and list management |
| tagStore | `stores/tagStore.ts` | Tag management and associations |
| searchStore | `stores/searchStore.ts` | Full-text search queries and results |
| attachmentStore | `stores/attachmentStore.ts` | Attachment management |
| settingsStore | `stores/settingsStore.ts` | App settings, data management, backup configuration |
| syncStore | `stores/syncStore.ts` | Sync configuration, auth, state, and conflicts |
| toastStore | `stores/toastStore.ts` | Global toast notifications |

## Store Responsibilities

### appStore

Manages application-level global state, serving as the central control point for navigation and theming.

| Key State | Type | Description |
|-----------|------|-------------|
| currentPage | AppPage | Current page (workspace/library/document/settings) |
| selectedItemId | string \| null | Currently selected record ID |
| theme | ThemeMode | Theme mode (light/dark/system) |
| paletteOpen | boolean | Whether the search palette is open |
| alwaysOnTop | boolean | Whether window is always on top |

| Key Operations | Description |
|----------------|-------------|
| init() | Loads saved theme, page, and window behavior settings from SQLite |
| navigate(page) | Switches page and persists current page to settings |
| selectItem(id) | Selects the specified record |
| setTheme(theme) | Switches theme and persists the change |
| setAlwaysOnTop(value) | Sets the window always-on-top state |

### itemStore

Manages the complete lifecycle of records — the most frequently used Store in the application.

| Key State | Type | Description |
|-----------|------|-------------|
| items | ItemDto[] | Record list |
| selectedItem | ItemDto \| null | Currently selected record detail |
| itemTagNames | Record<string, string[]> | Item-to-tag-names mapping |
| pinnedItems | ItemDto[] | Pinned records |
| recentItems | ItemDto[] | Recent records |
| loading | boolean | Loading state |

| Key Operations | Description |
|----------------|-------------|
| fetchItems(itemType?) | Get record list (supports type filtering) |
| fetchLibraryData() | Get complete library data (items + tags + mappings) |
| getItem(id) | Get single record detail |
| createItem(title, type, content?) | Create record and append to list |
| updateItem(id, updates) | Update record and sync to list |
| deleteItem(id) | Delete record and remove from list |
| fetchPinned() / fetchRecent() | Get pinned/recent records |

### tagStore

Manages tag CRUD and record-tag associations.

| Key State | Type | Description |
|-----------|------|-------------|
| tags | TagDto[] | All tags |
| itemTags | TagDto[] | Tags for the current record |

| Key Operations | Description |
|----------------|-------------|
| fetchTags() | Get all tags |
| createTag(name, color) | Create tag |
| removeTag(name) | Delete tag |
| updateItemTags(itemId, tagNames) | Set item's tags |
| renameTag(oldName, newName) | Rename tag |
| updateTagColor(name, color) | Update tag color |

### searchStore

Manages full-text search queries and results, with a built-in sequence-based debounce mechanism.

| Key State | Type | Description |
|-----------|------|-------------|
| query | string | Search keyword |
| results | SearchResultDto[] | Search results |
| total | number | Full number of matches for the current query |
| searching | boolean | Whether currently searching |
| loadingMore | boolean | Whether the next page is loading |
| hasMore | boolean | Whether another page is available |

| Key Operations | Description |
|----------------|-------------|
| setQuery(q) | Set search keyword |
| search(q, itemType?, options?) | Execute normal or advanced search (built-in race condition protection) |
| loadMore(itemType?, options?) | Load the next result page |

The search Store uses a `_searchSeq` sequence number mechanism to prevent stale results from overwriting newer ones:

```typescript
let _searchSeq = 0;

search: async (q, itemType, options) => {
  const seq = ++_searchSeq;
  const page = await invoke("search_items", { query: q, ...options });
  if (seq !== _searchSeq) return; // Discard stale results
  set({ results: page.results, total: page.total });
}
```

### attachmentStore

Manages files attached to records.

| Key State | Type | Description |
|-----------|------|-------------|
| attachments | AttachmentDto[] | Attachment list for current record |

| Key Operations | Description |
|----------------|-------------|
| fetchAttachments(itemId) | Get item's attachments |
| addAttachment(itemId, path) | Add attachment |
| deleteAttachment(id) | Delete attachment |

### settingsStore

Manages application settings and system administration functions — the most feature-rich Store.

| Key State | Type | Description |
|-----------|------|-------------|
| settings | AppSettings | App settings (font, font size, accent color, etc.) |
| dbSize | string | Database size |
| dbPath | string | Database path |
| autoBackupConfig | AutoBackupConfig \| null | Auto backup configuration |
| backupFiles | BackupFileInfo[] | Backup file list with type, size, and integrity status |
| sqlLogging | SqlLogSettings | SQL log settings |

| Key Operations | Description |
|----------------|-------------|
| init() | Load settings from SQLite and apply to DOM |
| updateSetting(key, value) | Update a single setting and persist |
| refreshDbSize() | Refresh database size |
| exportDataWithOptions(options) | ZIP data export |
| importDataWithOptions(options) | ZIP data import |
| triggerBackupNow() | Execute backup immediately |
| verifyBackup(filename) | Verify the integrity of a selected ZIP backup |
| updateSqlLogging(partial) | Update SQL log configuration |

### syncStore

Manages the complete lifecycle of multi-device synchronization, including authentication, sync scheduling, and conflict resolution.

| Key State | Type | Description |
|-----------|------|-------------|
| config | SyncConfig | Sync configuration (server, auth, interval, etc.) |
| state | SyncState | Sync runtime state |
| history | SyncHistoryEntry[] | Sync history records |
| pendingConflicts | ConflictInfo[] \| null | Pending conflict list |

| Key Operations | Description |
|----------------|-------------|
| init() | Load config and state, register event listeners, start auto-sync |
| login(serverUrl, email, password) | Sync service login |
| register(serverUrl, email, password) | Sync service registration |
| logout() | Logout and stop auto-sync |
| triggerSync() | Execute sync, refresh itemStore and tagStore on success |
| resolveConflicts(resolutions) | Manually resolve conflicts |
| updateConfig(partial) | Update sync configuration |

### toastStore

A lightweight global toast notification Store.

| Key State | Type | Description |
|-----------|------|-------------|
| toasts | Toast[] | Currently displayed toast list |

| Key Operations | Description |
|----------------|-------------|
| addToast(type, message) | Add toast (auto-dismisses after 3.5 seconds) |
| removeToast(id) | Manually remove toast |

## Cross-Store Communication

Zustand Stores communicate with each other through direct references, eliminating the need for an additional event bus:

### Data Refresh After Sync

When `syncStore.triggerSync()` succeeds and has pulled data, it actively triggers data refresh in `itemStore` and `tagStore`:

```typescript
triggerSync: async () => {
  const result = await triggerSync();
  // Refresh app data after successful sync
  if (result.pulled > 0) {
    await useItemStore.getState().fetchItems();
    await useTagStore.getState().fetchTags();
  }
}
```

### Unified Error Reporting

All Store error handling uses `toastStore` for user-facing notifications:

```typescript
// Error handling in itemStore
deleteItem: async (id) => {
  try {
    await invoke("delete_item", { id });
  } catch (e) {
    useToastStore.getState().addToast("error", "Failed to delete record");
    throw e;
  }
}
```

### Refresh After Import

`settingsStore` triggers `itemStore` refresh after completing data import:

```typescript
importDataWithOptions: async (options) => {
  await importDataZip(path, options);
  await useItemStore.getState().fetchItems();
  await get().refreshDbSize();
}
```

### Token Expiration Handling

When `syncStore` detects an expired token, it automatically logs out and stops the sync timer:

```typescript
if (msg.includes("TokenExpired") || msg.includes("login expired")) {
  stopAutoSync();
  await get().logout();
  set({ error: "Login expired, please log in again" });
}
```

## Adapter

`src/adapters/itemAdapter.ts` implements the DTO-to-view-model conversion, transforming backend `ItemDto` into the frontend `Item` type used by the UI:

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

### Transformations

| Transform | Description |
|-----------|-------------|
| Icon mapping | Selects Lucide icon component based on `item_type` |
| Accent mapping | Assigns accent color by type (note=cyan, link=blue, file=yellow, etc.) |
| Relative time | Converts ISO timestamps to "just now", "3 min ago", "2 days ago" format |
| Summary fallback | Extracts first 60 characters from `content` when `summary` is empty |

### Icon Mapping Table

| item_type | Icon | Accent |
|-----------|------|--------|
| note | FileText | cyan |
| link | Link | blue |
| file | Folder | yellow |
| image | Image | purple |
| code | Braces | cyan |
| task | BookOpen | green |

The adapter is called in batch in `QuantaNoteApp.tsx` via `useMemo`, converting `ItemDto[]` to `Item[]`, ensuring recalculation only happens when data changes.
