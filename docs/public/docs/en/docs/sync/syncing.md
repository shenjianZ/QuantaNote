---
title: Syncing Your Data
description: QuantaNote data sync operations guide, including manual sync, auto sync, sync status monitoring, and sync history
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Syncing Your Data

After completing authentication, you can start syncing data between devices. QuantaNote provides both manual and automatic sync methods, with real-time status and progress display.

## Manual Sync

Manual sync is useful in the following scenarios:

- Initial sync after first configuring sync
- After making important changes on another device
- When auto sync is disabled
- Immediately after network recovery

**Steps:**

1. Make sure you are logged in to your sync account
2. In the **Settings > Sync** page, click the "Sync Now" button
3. Or click the sync icon in the top status bar to trigger sync

**Sync Process:**

QuantaNote's sync process consists of the following stages:

1. **Calculate local diff** — Detect records that have been added, modified, or deleted locally since the last sync baseline
2. **Push to server** — Upload local changes to the sync server
3. **Pull from server** — Retrieve the latest changes from the server
4. **Conflict detection** — Compare local and remote changes to detect conflicts
5. **Conflict resolution** — Resolve conflicts based on the configured strategy (if any)
6. **Apply changes** — Merge remote changes into the local database
7. **Update baseline** — Record a new sync snapshot as the baseline for the next sync

**Progress Display:**

During sync, the status bar shows real-time progress:
- Current sync stage name (e.g., "Pushing", "Pulling")
- Records processed / total records
- Estimated time remaining (optional)

## Auto Sync

The auto sync feature automatically executes sync operations at a configured time interval.

**Configuring auto sync:**

1. In the **Settings > Sync** page, find the "Auto Sync" option
2. Toggle the auto sync switch on
3. Set the sync interval (in minutes)

**Recommended configuration:**

| Use case | Suggested interval | Description |
|----------|--------------------|-------------|
| Single user | 10-30 minutes | Moderate frequency, balancing timeliness and performance |
| Team collaboration | 1-5 minutes | High-frequency sync, reducing conflict probability |
| Light usage | 60 minutes | Minimize unnecessary network requests |

**Auto sync behavior:**

- Only works while the application is running
- Does not trigger if the previous sync hasn't completed
- Silently skips when network is unavailable, without errors
- Displays error notifications in the status bar on sync failure

## Sync Status

QuantaNote provides a real-time sync status indicator in the status bar:

| Status | Icon | Description |
|--------|------|-------------|
| Idle | Green checkmark | Logged in, no pending changes |
| Syncing | Spinning icon | Sync operation in progress |
| Pending | Blue dot | Local changes awaiting sync |
| Error | Red exclamation mark | Sync failed, attention needed |
| Not logged in | Gray icon | Sync not configured or logged out |

**Error handling:**

When a sync error occurs:

- The status bar displays a red error icon
- Click the icon to view detailed error information
- Common errors include network timeouts, server unreachable, and authentication failures
- Most temporary errors are automatically retried on the next auto sync

## Sync Content

The sync engine handles the following five data types:

### Items (Note Entries)

- Note title and body content
- Creation and modification timestamps
- Pin status and other flags

### Tags

- Tag names and colors
- Tag unique identifiers (UUID)

### ItemTags (Associations)

- Many-to-many relationships between notes and tags

### Attachments

- Attachment metadata (filename, size, MIME type)
- Attachment file content (transferred in chunks)

### Versions (Version History)

- Version snapshot at each save point
- Version creation timestamp and content summary

> **Tip:** Attachments and version history typically account for the largest data volume. If sync is slow, check the attachment file sizes.

## Sync History

QuantaNote records detailed information for each sync operation.

**Viewing sync history:**

1. In the **Settings > Sync** page, find the "Sync History" section
2. Recent sync records are displayed in reverse chronological order

**History record information:**

| Field | Description |
|-------|-------------|
| Sync time | Timestamp when this sync completed |
| Snapshot ID | Baseline snapshot identifier generated after sync |
| Pushed count | Number of changes uploaded in this sync |
| Pulled count | Number of changes downloaded in this sync |
| Conflict count | Number of conflicts detected and resolved |
| Sync status | Success / Partial success / Failed |

Sync history helps you:

- Track the timeline of data changes
- Understand sync frequency across devices
- Diagnose sync issues

## Token Expiration

QuantaNote uses a dual-token mechanism for authentication:

- **Access Token** — Short-lived, used for API requests
- **Refresh Token** — Long-lived, used to refresh the Access Token

**Token expiration behavior:**

1. When the Access Token expires, the system automatically uses the Refresh Token to obtain a new Access Token
2. If the Refresh Token has also expired, the system automatically performs a logout
3. After logout, you need to re-enter your email and password to log in
4. Logging out does not affect local data

> **Tip:** If you haven't used QuantaNote for a long time (exceeding the Refresh Token lifetime), you may need to log in again when you next open the application.
