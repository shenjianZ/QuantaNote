---
title: Data Sync
description: Overview of QuantaNote data synchronization features, including multi-device sync, conflict resolution, and sync server configuration
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Data Sync

QuantaNote provides optional data synchronization features that let you keep your note data consistent across multiple devices. The sync feature is built on a self-hosted sync server, using snapshot baseline and three-way diff algorithms to ensure data accuracy and integrity.

## Sync Architecture Overview

QuantaNote's sync engine employs the following core technologies:

- **Snapshot Baseline** — Records a baseline snapshot after each successful sync, used as the reference for calculating differences during the next sync
- **Three-way Diff** — Compares local changes, remote changes, and the baseline version to accurately detect conflicts
- **SHA256 Content Hashing** — Uses SHA256 algorithm to hash content, quickly determining whether data has changed
- **Tombstone Mechanism** — Marks deleted records with tombstones, preventing them from being re-synced on other devices

## Synced Data Types

QuantaNote syncs the following types of data:

| Data Type | Description |
|-----------|-------------|
| Items | Note entries, including title, content, and creation/modification timestamps |
| Tags | Tag definitions, including name and color |
| ItemTags | Many-to-many associations between notes and tags |
| Attachments | Attachment metadata (filename, size, type) and attachment file content |
| Versions | Version history records, including snapshot content for each version |

## Conflict Resolution

When multiple devices edit the same record simultaneously, the sync engine detects conflicts. QuantaNote provides four conflict resolution strategies:

- **Auto** — Automatically selects the newest version based on timestamps
- **Local-wins** — Always keeps the local version on conflict
- **Remote-wins** — Always adopts the remote version on conflict
- **Manual** — Manually choose which version to keep for each conflict

For detailed conflict resolution information, see the [Conflict Resolution](./conflict-resolution) chapter.

## Security

Security guarantees during synchronization:

- **Authentication** — Email/password registration and login
- **Token Management** — Dual token mechanism with Access Token + Refresh Token
- **Device Identity** — Each device has a unique Device ID for tracking change sources
- **Transport Security** — HTTPS is recommended for the sync server

## Quick Navigation

| Topic | Description |
|-------|-------------|
| [Server Setup](./server-setup) | Configure your self-hosted sync server |
| [Authentication](./authentication) | Registration, login, and password management |
| [Syncing Your Data](./syncing) | Manual sync, auto sync, and sync status |
| [Conflict Resolution](./conflict-resolution) | Conflict detection and resolution strategies |

> **Tip:** Sync is an optional feature. If you only use QuantaNote on a single device, there is no need to configure synchronization.
