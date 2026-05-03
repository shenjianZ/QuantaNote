---
title: Attachments
description: Manage files associated with your notes and items in QuantaNote.
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Attachments

Attachments allow you to associate external files with your items. Whether it is an image, a PDF document, an audio recording, or a code snippet, QuantaNote lets you upload, preview, and manage file attachments directly alongside your notes.

## Uploading Files

To upload a file attachment to an item:

1. Open the **Attachment Manager Modal** — accessible from the Document Editor toolbar or an item's context menu in the Library.
2. Click the **"Upload"** button or drag and drop files onto the modal.
3. A file picker dialog opens, allowing you to select one or more files from your local filesystem.
4. Selected files are copied to the QuantaNote data directory and linked to the current item.

### Supported Formats

QuantaNote supports a wide range of file types for attachment:

| Category | Extensions |
|----------|------------|
| Images | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp` |
| Audio | `.mp3`, `.wav`, `.ogg`, `.m4a` |
| Video | `.mp4`, `.webm`, `.mov` |
| Documents | `.pdf` |
| Text | `.txt`, `.md`, `.json`, `.csv`, `.xml`, `.html`, `.css`, `.js`, `.ts`, `.py`, `.rs`, `.go` |
| Archives | `.zip`, `.tar`, `.gz` |

There is no strict file size limit imposed by QuantaNote, but very large files may affect performance during preview.

## Supported Preview Types

QuantaNote provides inline previews for certain file types directly in the Attachment Manager:

- **Images** — Displayed as thumbnails with the option to view at full size. Supported formats include PNG, JPEG, GIF, WebP, SVG, and BMP.
- **Audio** — An embedded audio player allows you to play audio files directly in the modal without opening an external application.
- **Video** — An embedded video player supports MP4, WebM, and MOV playback.
- **PDF** — PDF files can be previewed inline using the built-in PDF viewer.
- **Text** — Plain text and code files are displayed with syntax highlighting where applicable.

File types that do not support inline preview show a file icon and a button to open the file in your system's default application.

## Managing Attachments

The **Attachment Manager Modal** is the primary interface for managing an item's attachments:

- **Upload** — Add new files via the file picker or drag-and-drop.
- **Preview** — Click an attachment to open its preview (image, audio, video, PDF, or text).
- **Download** — Save a copy of the attachment to a custom location on your filesystem.
- **Delete** — Remove an attachment from the item. The file is deleted from the QuantaNote data directory. A confirmation prompt prevents accidental deletion.
- **File Info** — Each attachment displays its filename, file size, and upload date.

## Storage Location

All attachments are stored on your local filesystem in the QuantaNote data directory:

```
~/.quantanote/attachments/{item_id}/
```

On Windows, this resolves to:

```
%USERPROFILE%\.quantanote\attachments\{item_id}\
```

Each item has its own subdirectory named after the item's UUID. Files are stored with their original filenames. When an item is deleted, its attachment directory and all contained files are removed automatically.

### Backup Considerations

Since attachments are stored as individual files in the data directory, they are included when you back up the `~/.quantanote/` directory. The built-in export and backup features handle attachment files alongside the SQLite database to ensure a complete backup.
