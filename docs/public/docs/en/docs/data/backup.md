---
title: Backup
description: QuantaNote backup features including automatic scheduled backups and manual instant backups with configurable intervals, retention limits, and expiration policies
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Backup

QuantaNote provides a flexible backup mechanism, including automatic scheduled backups and manual instant backups. Backup data is saved as SQLite database copies, ensuring your note data can be recovered in any unexpected situation.

## Auto Backup

The auto backup feature automatically creates database backups at configured time intervals without manual intervention.

**Enabling auto backup:**

1. Open the **Settings > Data Management** page
2. Find the "Auto Backup" option
3. Toggle the auto backup switch on
4. Configure backup parameters (see "Backup Configuration" below)

Once enabled, QuantaNote will automatically create backups at the configured interval while the application is running. If the application is not running, backup tasks will not be triggered.

> **Note:** Auto backup only works while the application is running. If you rarely open QuantaNote, consider performing manual backups regularly as well.

## Backup Configuration

Auto backup provides the following configurable parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| Backup interval | 7 days | Time between automatic backups |
| Maximum backups | 10 | Maximum number of backup files to retain |
| Expiration days | 30 days | Backups older than this are automatically cleaned up |

**Backup interval:** Can be set to any value between 1-30 days. Shorter intervals mean more frequent backups but use more disk space.

**Maximum backups:** When the number of backup files exceeds this limit, the system automatically deletes the oldest backup files.

**Expiration days:** Even if the backup count hasn't reached the limit, backups older than the expiration period are automatically cleaned up.

> **Tip:** Adjust these parameters based on your usage frequency and data importance. For heavy daily users, an interval of 1-3 days and maximum of 15-20 backups is recommended.

## Manual Backup

In addition to auto backup, you can create a backup manually at any time:

1. Open the **Settings > Data Management** page
2. Click the "Backup Now" button
3. The system will immediately create a backup file

Manual backups are not subject to auto backup interval limits or count limits. They execute immediately and are saved with a timestamp-based filename.

Manual backups are useful in the following scenarios:

- Before performing bulk editing operations
- As a safety measure before importing data
- Before system updates or migrations
- Any important moment when you feel extra protection is needed

## Backup Manager

The backup manager provides a visual interface for managing all backup files.

**Features:**

- **View backup list** — Display all backups in reverse chronological order, newest first
- **View details** — Each backup shows creation time, file size, and other information
- **Delete backups** — Manually delete unnecessary backup files to free up disk space
- **Bulk cleanup** — One-click cleanup of expired or redundant backups

**Backup list information:**

| Field | Description |
|-------|-------------|
| Filename | Auto-generated with timestamp, e.g., `backup_20260503_143022.db` |
| Created | Exact time the backup was created |
| File size | Disk space occupied by the backup file |
| Actions | Delete button |

> **Note:** Deleting backups is irreversible. Confirm that you no longer need a backup before deleting it.

## Storage Location

All backup files are saved in the following directory:

```
~/.quantanote/backups/
```

On Windows, the full path is:

```
%USERPROFILE%\.quantanote\backups\
```

**Backup file naming convention:**

```
backup_YYYYMMDD_HHmmss.db
```

For example: `backup_20260503_143022.db` represents a backup created on May 3, 2026 at 14:30:22.

**Backup file details:**

- Backup files are complete SQLite database copies
- They can be used directly to replace the main database for data recovery
- File size depends on actual data volume, typically smaller than exported ZIP files
- The backup process uses SQLite's backup API and does not lock the database, so it doesn't affect normal usage

> **Recommendation:** For particularly important data, consider copying backup files to external storage devices or cloud storage to prevent losing both the backup and original data in case of device failure.
