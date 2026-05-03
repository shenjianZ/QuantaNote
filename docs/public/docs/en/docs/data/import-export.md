---
title: Import & Export
description: QuantaNote data import and export features supporting JSON and ZIP formats with selective export of tags, attachments, and version history
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Import & Export

QuantaNote supports two data formats for import and export: **JSON** and **ZIP**. The JSON format is suitable for programmatic processing and data exchange, while the ZIP format packages everything (including attachment files) for complete backup and migration.

You can access the import/export features from the **Settings > Data Management** page.

## Export as ZIP

The ZIP format is the recommended export method. It packages all your data into a single compressed file, including note content, attachments, tags, and version history.

**Steps:**

1. Open the Settings page and navigate to the "Data Management" section
2. Click the "Export" button to open the export options modal
3. In the modal, select the export scope and options:
   - **Include Attachments** — Whether to export attachment files (images, documents, etc.)
   - **Include Version History** — Whether to export note version history records
   - **Include Tags** — Whether to export tags and their associations
4. The system will automatically calculate the estimated export size
5. Confirm and click "Export", then choose a save location

**ZIP File Structure:**

```
quantanote_export_20260503.zip
├── data.json              # All notes and metadata
├── attachments/           # Attachment files
│   ├── abc123.pdf
│   └── def456.png
└── meta.json              # Export metadata (version, timestamps, etc.)
```

> **Note:** For large datasets, the export process may take several seconds to tens of seconds. Do not close the application during export.

## Export as JSON

JSON format export contains only structured data without the actual attachment files. This is suitable for:

- Data analysis and statistics
- Migration to other note-taking tools
- Integration with third-party programs

**Export contents:**

- All notes (Items): title, content, creation and modification timestamps
- All tags (Tags) and their names
- Note-tag associations (ItemTags)
- Attachment metadata (filename, size, type, etc.)
- Version history records

The JSON export data structure matches the database table structure, using UTF-8 encoding.

## Import from ZIP

Importing from a ZIP file restores previously exported complete data.

**Steps:**

1. In Settings > Data Management, click the "Import" button
2. Select a ZIP file (only `.zip` format is accepted)
3. After parsing, the system displays an import preview:
   - Number of notes included
   - Number of attachments included
   - Number of tags included
4. Select import options:
   - **Overwrite existing data** — When checked, replaces local records with matching IDs; when unchecked, skips existing records
5. Confirm to start the import

**Import conflict handling:**

| Overwrite toggle | Existing records | Non-existing records |
|------------------|-----------------|---------------------|
| Enabled | Overwrite local data | Create new records |
| Disabled | Skip, keep local | Create new records |

> **Recommendation:** Create a manual backup before importing, so you can revert if the import results are not as expected.

## Import from JSON

The JSON import flow is similar to ZIP import, but does not import attachment files (since the JSON export does not include them).

1. Select a `.json` file
2. Review the import preview
3. Choose whether to overwrite existing data
4. Confirm the import

JSON import is useful for migrating data from other tools. You need to ensure the JSON file format is compatible with QuantaNote's data structure.

## Data Size Estimation

Before executing an export, QuantaNote automatically calculates and displays the estimated export size, helping you:

- Evaluate whether the export file will be too large
- Decide whether to exclude attachments or version history to reduce file size
- Plan storage space in advance

**Size breakdown includes:**

| Category | Description |
|----------|-------------|
| Note content | Size of all Item text content |
| Attachment files | Original size of all attachment files |
| Version history | Size of all version records |
| Metadata | Size of tags, associations, and other meta information |
| **Total** | Estimated total size before compression (ZIP format provides compression) |

> **Tip:** The ZIP format automatically compresses data, so the actual file size is typically smaller than the estimate. Image attachments have lower compression ratios, while text content compresses well.
