---
title: Diagnostics
description: QuantaNote diagnostics tools including SQL logging configuration, log file management, database info display, and VACUUM optimization
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Diagnostics

The Diagnostics section provides runtime debugging and database management tools. These tools are primarily intended for development debugging, performance troubleshooting, and data maintenance.

## SQL Logging

The SQL logging feature records all SQL queries executed by the QuantaNote backend, helping developers understand database operations and troubleshoot issues.

### Enable/Disable

Use the toggle switch to control SQL logging. By default, SQL logging is disabled. When enabled, all SQL operations are recorded.

| Option | Description |
|--------|-------------|
| **On** | Starts recording all SQL query statements |
| **Off** (default) | Stops recording SQL queries |

> **Note**: Enabling SQL logging incurs additional I/O overhead. It is recommended to keep it disabled during normal use and only enable it when debugging.

### Output to Console

When enabled, SQL logs are written to the application's console (standard output). Useful for real-time SQL query monitoring during development.

### Output to File

When enabled, SQL logs are written to a log file on disk. This is enabled by default. The log file path is displayed on the Settings page.

### Pretty Format

When enabled, SQL query statements are output with formatting including indentation and line breaks for readability. When disabled, queries are output in a compact single-line format.

### Log Configuration

#### Maximum Log Entry Length

Controls the maximum number of characters per SQL log entry. Content exceeding this limit is truncated. Available options:

| Option | Description |
|--------|-------------|
| **1,000** | Suitable for overview-only query monitoring |
| **4,000** (default) | Suitable for most debugging scenarios |
| **10,000** | Suitable for viewing complete queries in complex scenarios |
| **50,000** | Suitable for deep debugging requiring full logs |

## Log File Location

The Settings page displays the full path to the SQL log file.

### Actions

| Action | Description |
|--------|-------------|
| **Copy Path** | Click the path button to copy the log file path to your clipboard |
| **Open Log Directory** | Click the "Open Log Directory" button to open the log folder in your file manager |

### Default Paths

Log files are typically located at:

- **Windows**: `%USERPROFILE%\.quantanote\logs\`
- **macOS**: `~/.quantanote/logs/`
- **Linux**: `~/.quantanote/logs/`

## Clear SQL Log

Click the "Clear SQL Log" button to empty the log file contents. This action is irreversible; we recommend backing up valuable logs before clearing.

**Use cases:**

- The log file has grown too large and needs disk space freed
- Starting a new debugging session with a clean slate
- The log contains sensitive information that should be securely removed

## Database Info

The database information area shows the current state of the QuantaNote local database.

### Database Size

Displays the current size of the database file. This information is automatically refreshed each time you open the Settings page.

**Factors affecting size:**

- Number of records and content length
- Attachment data (if stored in the database)
- Version history count
- FTS5 full-text search index
- WAL (Write-Ahead Logging) journal files

### Database Path

Displays the full path to the database file. Click the path button to copy it to your clipboard.

Default database paths:

- **Windows**: `%USERPROFILE%\.quantanote\quanta_note.sqlite`
- **macOS**: `~/.quantanote/quanta_note.sqlite`
- **Linux**: `~/.quantanote/quanta_note.sqlite`

## Optimize Database

### VACUUM Operation

Click the "Optimize" button to execute SQLite's `VACUUM` operation, which:

1. **Rebuilds the database file**: Eliminates fragmentation and optimizes storage
2. **Clears the WAL journal**: Merges the WAL log back into the main database file
3. **Reduces file size**: Reclaims space occupied by deleted data
4. **Improves query performance**: Rebuilds indexes for faster queries

**Recommended when:**

- After deleting a large number of records
- The database file is noticeably large but contains little actual data
- Query performance has degraded
- As periodic maintenance (e.g., once a month)

> **Note**: The VACUUM operation may take some time and the application may be briefly unresponsive during execution. For large databases, consider running it during idle periods.
