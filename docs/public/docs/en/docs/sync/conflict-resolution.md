---
title: Conflict Resolution
description: QuantaNote sync conflict resolution mechanism, including three-way diff, four resolution strategies, manual conflict resolution UI, and the tombstone mechanism
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Conflict Resolution

When multiple devices modify the same record simultaneously, a sync conflict occurs. QuantaNote provides comprehensive conflict detection and resolution mechanisms to ensure your data stays consistent across devices.

## How Conflicts Arise

Sync conflicts occur in the following typical scenario:

**Example scenario:**

1. You edit a note on Device A but haven't synced yet
2. You also edit the same note on Device B and sync it to the server
3. When Device A attempts to sync, the system discovers the same record has been modified both locally and remotely

**Three-way Diff:**

QuantaNote uses a three-way diff algorithm to accurately detect conflicts. This algorithm requires three versions:

| Version | Description |
|---------|-------------|
| Base (Baseline) | The snapshot from the last successful sync |
| Local | Modifications made locally since the baseline |
| Remote | Modifications made on the server since the baseline |

**Comparison logic:**

- If only the local version changed → Push the local version directly
- If only the remote version changed → Pull the remote version directly
- If both modified the same field → A conflict is detected

This three-way comparison is more precise than simple "last write wins" because it can distinguish between true conflicts and non-conflicting concurrent modifications.

For example, if you modified the note title on Device A and the note content on Device B, these changes can be automatically merged without conflict. Only when both devices modify the same field does the conflict resolution process trigger.

## Conflict Resolution Strategies

QuantaNote provides four conflict resolution strategies that you can configure in **Settings > Sync**:

### Auto (Automatic)

- **How it works** — Compares the modification timestamps of local and remote versions, automatically selecting the newer one
- **Best for** — Default choice for most situations
- **Advantages** — No manual intervention required, fully automated sync process
- **Disadvantages** — May lose older but more important modifications

### Local-wins

- **How it works** — Always keeps the local version on conflict, discarding the remote version
- **Best for** — When you're confident the local device has the most up-to-date data
- **Advantages** — Simple and direct, never loses local modifications
- **Disadvantages** — Remote device modifications get overwritten

### Remote-wins

- **How it works** — Always adopts the remote version on conflict, overwriting local modifications
- **Best for** — When you want server-side data to always be the authoritative version
- **Advantages** — Ensures all devices stay consistent with the server
- **Disadvantages** — Local unsynced modifications are lost

### Manual

- **How it works** — Each conflict triggers a resolution UI where you choose which version to keep for each record
- **Best for** — When data is critical and automatic decisions are unacceptable
- **Advantages** — Fully controllable, no accidental data loss
- **Disadvantages** — Requires more manual effort when many conflicts exist

**Strategy comparison:**

| Strategy | Automation level | Data safety | Best for |
|----------|-----------------|-------------|----------|
| Auto | High | Medium | Daily use |
| Local-wins | High | Medium (local priority) | Single-device primary |
| Remote-wins | High | Medium (server priority) | Server-primary |
| Manual | Low | High | Important data |

## Manual Conflict Resolution

When the Manual strategy is selected, every sync that detects conflicts will open the conflict resolution interface.

**Conflict resolution modal features:**

1. **Conflict list** — Displays all detected conflicting records
2. **Per-record review** — Click a conflict to view detailed comparison:
   - Local version content
   - Remote version content
   - Baseline version content (for reference)
3. **Choose which version to keep** — For each conflict, select:
   - Keep local version
   - Adopt remote version
4. **Bulk operations** — One-click to keep all local or all remote
5. **Confirm resolution** — After making all selections, click the "Apply" button

**Best practices:**

- Carefully compare differences between local and remote versions
- For important note content, don't rush to choose — consider copying both versions
- If there are many conflicts, consider using the Auto strategy to simplify operations

## Baselines and Tombstones

### Snapshot Baseline

The baseline is one of the core concepts in the sync engine:

- After each successful sync, the system generates a baseline snapshot
- The baseline snapshot records the data state at sync completion
- During the next sync, the system compares the current state against the baseline to determine changes
- Each device maintains its own independent baseline

Baseline purposes:

1. **Incremental sync** — Only sync changes since the last baseline, avoiding full data transfer
2. **Conflict detection** — Three-way comparison requires the baseline as a reference point
3. **Resumable sync** — If sync is interrupted, it can resume from the last baseline

### Tombstone Mechanism

The tombstone mechanism handles deletion operations correctly:

- When you delete a record, the system doesn't physically delete it immediately but marks it as a "tombstone"
- Tombstone records contain the deleted record's ID and deletion timestamp
- During sync, tombstones are synced to other devices
- Other devices receiving tombstones delete the corresponding records

**Why tombstones are necessary:**

Without tombstones, the following problem would occur:

1. You delete a note on Device A
2. Device B still has this note
3. When Device B syncs, it considers the note as a new local addition and pushes it to the server
4. Result: The deleted note reappears

The tombstone mechanism prevents deleted records from being "resurrected" by other devices by preserving deletion markers.

> **Tip:** Tombstone records occupy a small amount of storage space. QuantaNote automatically cleans up expired tombstone records at appropriate times.
