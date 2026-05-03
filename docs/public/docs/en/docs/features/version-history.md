---
title: Version History
description: Track content changes over time with automatic versioning in QuantaNote.
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Version History

QuantaNote automatically tracks changes to your item content over time by creating version snapshots. This allows you to browse past revisions, compare differences between versions, and restore any previous state — providing a safety net against accidental edits or unwanted changes.

## Automatic Version Creation

Versions are created automatically in the following scenarios:

- **Content Changes** — When an item's content is modified and saved (either by auto-save or manual save), a new version snapshot is created if the content differs from the most recent version.
- **Debounced Creation** — Version creation is tied to the save cycle. Rapid consecutive edits within the debounce window are grouped into a single version, preventing version clutter from minor keystroke-by-keystroke changes.
- **Metadata** — Each version records:
  - A unique version ID (UUID)
  - The item ID it belongs to
  - The full content snapshot at the time of creation
  - A timestamp of when the version was created
  - Optional name and description fields (editable by the user)

You do not need to manually create versions — the system handles this transparently as you work.

## Version Panel

The **Version Panel** is a side panel accessible from the Document Editor:

1. Open the Document Editor for any item.
2. Click the **Version History** button in the toolbar.
3. The Version Panel slides in from the right side of the screen.

The panel displays:

- A **chronological list** of all versions for the current item, newest first.
- Each version entry shows:
  - **Timestamp** — When the version was created.
  - **Name** — An optional user-assigned name (e.g., "First draft", "Revised introduction").
  - **Description** — An optional longer description of what changed.
  - **Preview** — Click to preview the full content of that version.
  - **Select** — Check the checkbox to select two versions for diff comparison.

## Naming and Describing

You can personalize your version history by editing the name and description of any version:

- **Name** — A short label for the version (e.g., "Draft v2", "Before refactor"). Click the name field in the Version Panel to edit it inline.
- **Description** — A longer description of what changed in this version or why it was saved. Click the description field to add or edit it.

Named versions are easier to identify in the version list, especially for items with many revisions.

## Diff Comparison

QuantaNote provides a **diff comparison** tool for viewing the differences between any two versions:

1. In the Version Panel, select **two versions** by checking their checkboxes.
2. Click the **"Compare"** button.
3. A diff modal opens showing a side-by-side or inline comparison of the two versions:
   - **Added text** is highlighted in green.
   - **Removed text** is highlighted in red.
   - **Unchanged text** is displayed normally.

The diff view helps you understand exactly what changed between revisions, making it easy to track the evolution of your content over time.

## Restoring a Version

If you want to revert an item to a previous state:

1. Open the Version Panel in the Document Editor.
2. Find the version you want to restore.
3. Click the **"Restore"** button next to that version.
4. A confirmation dialog appears, explaining that the current content will be replaced with the selected version's content.
5. Confirm the restore action.

After restoring:

- The item's content is replaced with the restored version's content.
- A new version is automatically created to record the restore action, so you can always undo the restore if needed.
- The editor updates immediately to show the restored content.

> **Note:** Restoring a version does not delete any existing versions. All versions remain in the history, preserving a complete audit trail.
