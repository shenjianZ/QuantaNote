---
title: Project Structure
description: QuantaNote directory layout and codebase organization
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-19
---

# Project Structure

This document describes QuantaNote's directory layout to help you quickly navigate the codebase and understand the project organization.

## Root Directory

```
QuantaNote/
├── package.json              # Frontend dependencies and script configuration
├── pnpm-lock.yaml            # pnpm dependency lock file
├── vite.config.ts            # Vite build configuration
├── tsconfig.json             # TypeScript configuration
├── tsconfig.node.json        # Node environment TypeScript configuration
├── tailwind.config.ts        # TailwindCSS configuration
├── index.html                # Entry HTML file
├── CLAUDE.md                 # Claude Code project instructions
├── src/                      # Frontend source code
├── src-tauri/                # Rust backend source code
├── e2e-tests/                # WebdriverIO E2E tests
└── docs/                     # Documentation website source
```

## src/ — Frontend Source Code

```
src/
├── main.tsx                  # Application entry point, mounts React root
├── App.tsx                   # Root component (deprecated, logic moved to QuantaNoteApp)
├── app/
│   └── QuantaNoteApp.tsx     # Main app component (routing, global shortcuts, state orchestration)
├── components/
│   ├── layout/               # Layout components
│   │   ├── AppShell.tsx      # Application shell (TopBar + content area)
│   │   ├── TopBar.tsx        # Top navigation bar
│   │   └── StatusBar.tsx     # Bottom status bar
│   ├── common/               # Shared components
│   │   ├── Modal.tsx         # Base modal component
│   │   ├── Select.tsx        # Dropdown select component
│   │   ├── ColorPickerModal.tsx      # Color picker
│   │   ├── TagManagerModal.tsx       # Tag management
│   │   ├── TagPickerModal.tsx        # Tag picker
│   │   ├── AttachmentManagerModal.tsx  # Attachment management
│   │   ├── VersionPreviewModal.tsx    # Version preview
│   │   ├── BackupManagerModal.tsx     # Backup management
│   │   ├── ExportModal.tsx           # Data export
│   │   ├── ImportModal.tsx           # Data import
│   │   └── ErrorBoundary.tsx         # Error boundary
│   ├── editor/               # Editor-related components
│   │   ├── SearchReplaceBar.tsx   # Search and replace bar
│   │   └── VersionPanel.tsx       # Version panel
│   ├── auth/                 # Authentication components
│   │   ├── LoginModal.tsx        # Login modal
│   │   ├── RegisterModal.tsx     # Registration modal
│   │   ├── ForgotPasswordModal.tsx  # Forgot password
│   │   └── ResetPasswordModal.tsx   # Reset password
│   ├── sync/                 # Sync-related components
│   │   ├── SyncSettingsPanel.tsx    # Sync settings
│   │   ├── SyncStatusIndicator.tsx  # Sync status indicator
│   │   ├── ConflictResolutionModal.tsx  # Conflict resolution
│   │   └── ConflictResolver.tsx     # Conflict resolver
│   ├── search/               # Search components
│   │   └── CommandPalette.tsx  # Ctrl+K global search
│   └── version/              # Version-related components
│       └── VersionDiffModal.tsx  # Version diff comparison
├── pages/
│   ├── WorkspacePage.tsx     # Quick notes (input + Markdown preview)
│   ├── LibraryPage.tsx       # Note library (search, filter, reader drawer)
│   ├── DocumentEditorPage.tsx # Full-screen Vditor editor + version history
│   └── SettingsPage.tsx      # Settings page
├── stores/                   # Zustand state management
│   ├── appStore.ts           # Navigation, panels, theme
│   ├── itemStore.ts          # Item CRUD
│   ├── searchStore.ts        # FTS5 search
│   ├── tagStore.ts           # Tag management
│   ├── attachmentStore.ts    # Attachment management
│   ├── settingsStore.ts      # User settings
│   └── syncStore.ts          # Sync state
├── services/
│   └── tauriCommands.ts      # Encapsulates all invoke() calls
├── adapters/
│   └── itemAdapter.ts        # ItemDto → Item view model conversion
├── hooks/                    # Custom React Hooks
├── i18n/                     # Internationalization resources
├── types/                    # TypeScript type definitions
├── utils/                    # Utility functions
├── styles/
│   └── themes.css            # Light/dark theme CSS variables
└── test/                     # Test utilities and configuration
    └── test-utils.tsx        # Test helper functions
```

## src-tauri/ — Rust Backend Source Code

```
src-tauri/
├── Cargo.toml                # Rust dependencies and build configuration
├── tauri.conf.json           # Tauri application configuration
├── icons/                    # Application icon assets
├── src/
│   ├── lib.rs                # Application entry, registers all Tauri commands
│   ├── main.rs               # Main function entry point
│   ├── error.rs              # AppError error enum
│   ├── commands/             # Tauri Command layer (thin layer)
│   │   ├── item.rs           # Item-related commands
│   │   ├── search.rs         # Search commands
│   │   ├── tag.rs            # Tag commands
│   │   ├── attachment.rs     # Attachment commands
│   │   ├── version.rs        # Version commands
│   │   ├── data_io.rs        # Data import/export commands
│   │   └── sync.rs           # Sync commands
│   ├── services/             # Business logic layer
│   │   ├── item_service.rs   # Item business logic
│   │   ├── tag_service.rs    # Tag business logic
│   │   ├── attachment_service.rs  # Attachment business logic
│   │   ├── version_service.rs     # Version business logic
│   │   └── data_io_service.rs     # Import/export logic
│   ├── repositories/         # Data access layer (raw SQL)
│   │   ├── item_repository.rs     # Item SQL queries
│   │   ├── tag_repository.rs      # Tag SQL queries
│   │   ├── attachment_repository.rs  # Attachment SQL queries
│   │   └── version_repository.rs     # Version SQL queries
│   ├── models/               # DTOs and Payload structs
│   │   ├── item.rs           # ItemDto, ItemPayload, etc.
│   │   ├── tag.rs            # TagDto
│   │   ├── attachment.rs     # AttachmentDto
│   │   ├── version.rs        # VersionDto
│   │   └── sync.rs           # Sync-related DTOs
│   ├── sync/                 # Sync module
│   │   ├── mod.rs            # Sync entry point
│   │   ├── diff.rs           # Diff calculation
│   │   └── transport.rs      # Network transport
│   ├── db/
│   │   └── mod.rs            # Database connection, Schema DDL, WAL checkpoint
│   ├── config/               # Configuration module
│   └── utils/                # Utility functions
│       ├── paths.rs          # Data directory paths
│       ├── ids.rs            # UUID generation
│       └── logging.rs        # SQL logging and tracing
```

## e2e-tests/ — E2E Tests

```
e2e-tests/
├── wdio.conf.js              # WebdriverIO configuration
├── helpers/                  # Page objects and test helpers
└── specs/                    # Test specifications
```

## docs/ — Documentation Website

```
docs/
├── public/
│   └── docs/
│       ├── zh-cn/            # Chinese documentation
│       │   └── docs/
│       │       ├── guide/    # User guide
│       │       ├── features/ # Feature descriptions
│       │       ├── data/     # Data management
│       │       └── development/  # Development docs
│       └── en/               # English documentation
│           └── docs/
│               ├── guide/
│               ├── features/
│               └── development/
└── ...                       # Doc site configuration and build files
```
