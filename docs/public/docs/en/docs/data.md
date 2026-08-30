---
title: Data Management
description: Overview of QuantaNote data management features, including import/export and backup capabilities
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Data Management

QuantaNote provides comprehensive data management features to help you safely import, export, and back up all your note data. The active data is stored locally in SQLite, while built-in automatic and manual backups create logical ZIP files that can be imported and migrated.

## Feature Overview

The data management module includes the following core capabilities:

- **Import & Export** — Support for both JSON and ZIP formats with flexible content selection
- **Auto Backup** — Configurable scheduled backup strategy to protect your data
- **Manual Backup** — One-click instant backup, create data snapshots at any time
- **Backup Management** — View backup history and manage disk space usage

## Why Data Management Matters

As a local-first application, QuantaNote stores all your data on your local device. This means:

1. **Data Sovereignty** — Your data always stays on your device, never forcefully uploaded to the cloud
2. **Offline Access** — All features work without a network connection
3. **Privacy Protection** — Your data is never processed through third-party servers

At the same time, data management becomes especially important. Regular backups and flexible import/export mechanisms can:

- Prevent data loss from device failures
- Facilitate data migration between devices
- Archive and preserve important notes long-term

## Quick Navigation

| Topic | Description |
|-------|-------------|
| [Import & Export](./import-export) | JSON/ZIP format data import and export operations |
| [Backup](./backup) | Auto backup configuration and manual backup management |

## Data Storage Location

All QuantaNote local data is stored in the following directory:

```
~/.quantanote/
├── quanta_note.sqlite    # Main database file
├── backups/              # Backup file directory
└── attachments/          # Attachment file directory
```

On Windows, the default path is `%USERPROFILE%\.quantanote\`.

> **Tip:** If you are also using the sync feature, local data will be kept in sync with the remote server, but backups are always local operations.

> **Distinction:** `quanta_note.sqlite` is the active database used by the app. **Backup Now** and automatic backup create verified logical ZIP files under `backups/`. These serve different purposes; see the [backup guide](./backup) for details.
