---
title: Attachments
description: Manage files associated with your notes and items in QuantaNote.
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-30
---

# Attachments

Attachments allow you to associate external files with your items. Whether it is an image, a PDF document, an audio recording, or a code snippet, QuantaNote lets you upload, preview, and manage file attachments directly alongside your notes.

## Uploading Files

To upload a file attachment to an item:

1. Open the **Attachment Manager Modal** from the Document Editor toolbar or the reader's attachment action.
2. Click **Add File** to open the system file picker.
3. Select files from the local filesystem.
4. Selected files are copied to the QuantaNote data directory and linked to the current item.

Inside the Document Editor, files can also be dropped directly into the editor. Images can be pasted from the clipboard; these actions create the attachment and insert an image or attachment link at the caret. The image toolbar button filters for images, while the attachment button supports multiple files.

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

- **Upload** — Add new files via the file picker. The Document Editor also supports file drag-and-drop.
- **Preview** — Click an attachment to open its preview (image, audio, video, PDF, or text).
- **Insert** — From the editor's manager, insert an image as Markdown media or another file as an attachment link.
- **Delete** — Remove an attachment from the item. The file is deleted from the QuantaNote data directory. A confirmation prompt prevents accidental deletion.
- **File Info** — Each attachment displays its filename, file size, and upload date.

### Duplicate Attachments

QuantaNote computes a SHA-256 hash from each attachment's content. Attachments with identical content reuse the same physical file while keeping separate attachment records and document references. Deleting one reference does not affect the other; the physical file is cleaned up only after the last reference is removed.

## Storage Location

All attachments are stored on your local filesystem in the QuantaNote data directory:

```
~/.quantanote/attachments/{item_id}/
```

On Windows, this resolves to:

```
%USERPROFILE%\.quantanote\attachments\{item_id}\
```

Attachments are grouped under item directories, but identical content may be shared by multiple attachment records. Documents refer to attachments with stable `attachment://<id>` references, and the reader resolves them to local asset URLs. When an item is deleted, a shared file is removed only when no remaining attachment record references it.

### Backup Considerations

Since attachments are stored as individual files in the data directory, they are included when you back up the `~/.quantanote/` directory. The built-in export and backup features handle attachment files alongside the SQLite database to ensure a complete backup.
