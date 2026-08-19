---
title: Workspace
description: The quick capture page for instantly recording ideas, thoughts, and notes in QuantaNote.
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-19
---

# Workspace

The Workspace is your quick capture page — designed for those moments when you need to write something down fast without breaking your train of thought. It provides a streamlined interface for capturing ideas instantly and saving them as items in your library.

## Quick Capture

The core of the Workspace is the quick capture editor. Simply start typing your content in the editor area. The editor supports full Markdown formatting so you can structure your thoughts as you write.

To save your note, press **Ctrl+Enter**. This will:

1. Extract a title from the first line of your content (see Auto Title Extraction below).
2. Save the item to your local SQLite database.
3. Clear the editor, readying it for your next note.

The quick capture flow is intentionally minimal — no dialogs, no required fields, no extra clicks. Just type and save.

## Editor Toolbar

The Workspace includes a formatting toolbar above the editor with the following options:

| Button | Action | Shortcut |
|--------|--------|----------|
| **H1 / H2 / H3** | Insert heading levels 1 through 3 | `Ctrl+1` / `Ctrl+2` / `Ctrl+3` |
| **B** | Bold text | `Ctrl+B` |
| **I** | Italic text | `Ctrl+I` |
| **List** | Insert bulleted or numbered list | — |
| **Code** | Inline code or code block | `Ctrl+`` |
| **Link** | Insert hyperlink | `Ctrl+K` |
| **Table** | Insert a table | — |

These toolbar buttons insert Markdown syntax directly into the editor, which is rendered in real time.

The Workspace table button inserts a table template. In the Document Editor, placing the caret inside an existing table changes the same button to “Adjust table”, where you can change rows, columns, and alignment.

## Save Status

After pressing **Ctrl+Enter**, the Workspace provides visual feedback to confirm that your note has been saved successfully. A brief status message appears near the editor, indicating that the item was created and added to your Library.

If a save fails (for example, due to a database error), an error message will be displayed so you can retry.

## Auto Title Extraction

When you save a note from the Workspace, QuantaNote automatically extracts a title from your content using the following rules:

1. If the first line is a Markdown heading (`# Title`), the heading text is used as the item title.
2. If the first line is plain text, it is used as the item title directly.
3. If the content is empty, a default title such as "Untitled" is assigned.

The extracted title appears in your Library alongside the item. You can always edit the title later in the Document Editor.

## Tips for Effective Quick Capture

- **Keep it short** — The Workspace is ideal for fleeting ideas, meeting notes, or quick reminders. For longer documents, use the Document Editor.
- **Use Markdown** — Structure your notes with headings and lists to make them easier to find later.
- **Tag later** — Items saved from the Workspace start without tags. You can assign tags from the Library or Document Editor at any time.
