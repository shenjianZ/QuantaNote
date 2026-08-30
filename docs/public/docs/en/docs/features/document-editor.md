---
title: Document Editor
description: Use the QuantaNote document editor for titles, summaries, Markdown formatting, table adjustments, auto-save, and version history
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-30
---

# Document Editor

The Document Editor provides a focused, full-screen editing experience. Open an item from the Library to edit it in the full editor.

The editor uses Vditor's IR (Instant Rendering) mode, keeping Markdown editable while showing the formatted result as you type.

## Title and Summary

The top of the editor contains item metadata:

- **Title**: Click the title to edit it; changes are synchronized with the Library.
- **Summary**: Enter a short description for Library cards and search result previews.
- **Fixed size**: The summary field keeps a fixed size. Put long content in the document body instead of expanding the summary.

Title and summary changes are included in auto-save. The application shows a status toast when saving succeeds or fails.

### Summary Modes

- **Automatic**: Extracts the first 10 characters from the body. The summary updates when the body changes and is saved.
- **Manual**: Editing the summary or switching to manual mode protects the custom text from later body changes.
- **Regenerate summary**: Clicking “Regenerate summary” creates a summary from the current body and switches back to automatic mode.

The summary mode is stored with the item and survives closing and reopening the editor. During migration, a non-empty legacy summary that differs from the first 10 characters of the body is treated as manual.

## Toolbar

The toolbar provides headings, bold, italic, strikethrough, lists, indentation, quotes, code, links, horizontal rules, images, attachments, and tables. Clicking a button inserts the syntax at the current caret position.

### Inserting Images and Attachments

- Click the image button and choose a file from the system picker. The image is copied into the current item's attachment directory and inserted at the caret.
- The attachment button can choose one or more files for insertion as attachment links, or open the Attachment Manager.
- Drop an image into the editor, or paste a screenshot from the clipboard, to create an image attachment and insert it automatically.
- Documents store stable `attachment://...` references. The reader resolves those references by attachment ID, so local paths do not need to be maintained manually.

Use the attachment button at the top of the editor when you only want to manage files without inserting a link.

### Insert a Table

1. Place the caret where the table should be inserted.
2. Click the table toolbar button.
3. Choose the row and column counts in the table panel.
4. Confirm to insert the table at the original caret position.

Opening the table panel preserves the editor selection. Clicking the panel does not lose the insertion location.

### Adjust an Existing Table

Place the caret inside an existing table and the table button changes its tooltip to **Adjust table**. The panel can:

- add or remove rows;
- add or remove columns;
- set the active column to left, center, or right alignment.

Reducing the row or column count removes cells from the end, so check the content before confirming. Existing cell content and alignment settings are preserved whenever possible.

Markdown table alignment uses these separator forms:

| Syntax | Result |
|--------|--------|
| `---` | Left aligned |
| `:---:` | Center aligned |
| `---:` | Right aligned |

## Live Rendering

The editor supports common Markdown, GFM, math, and chart syntax. Use the correct language markers for chart blocks:

````markdown
```mermaid
flowchart TD
    A[Start] --> B[Done]
```

```flowchart
st=>start: Start
e=>end: Done
st->e
```
````

Supported content includes:

- headings, lists, task lists, blockquotes, and horizontal rules;
- bold, italic, strikethrough, inline code, and fenced code blocks;
- links, images, attachments, and HTML;
- GFM tables, footnotes, and definition lists;
- KaTeX inline and block formulas;
- Mermaid and Flowchart diagrams.

Scrolling does not recreate the entire preview. After scrolling stops, charts should remain stable without flicker or repeated initialization.

## Search and Replace

- `Ctrl + F`: open search for the current document.
- `Ctrl + H`: open search and replace.
- Use the arrow buttons to move between matches.
- Replace one match at a time or replace all matches.
- Press `Esc` to close the search bar.

## Copy and Paste

Select text and press `Ctrl + C` to copy, or `Ctrl + V` to paste. The editor handles copy natively. Pasting a screenshot creates an image attachment; ordinary text paste displays the paste feedback toast.

The packaged Windows desktop application writes to the native system clipboard first. When Windows Clipboard History is enabled, copied text can be viewed with `Win + V`. macOS and Linux do not provide the same Windows panel, so QuantaNote uses the clipboard APIs available on those platforms.

## Auto-Save

The editor uses debounced saving:

- continuous typing is grouped instead of saved on every keystroke;
- content is saved automatically after changes settle;
- failed saves preserve the edited content and show an error toast;
- leaving the editor waits for the final save to finish; when saving fails, the editor stays open so the content is not silently hidden.
- `Ctrl + S` is not required because the editor saves automatically.

## Version Panel

Use the Version Panel to review, compare, and restore previous versions:

1. Open the Version Panel on the right side of the editor.
2. Browse versions in reverse chronological order.
3. Select two versions for a diff comparison.
4. Select a historical version and confirm the restore.

Restoring creates a new snapshot, so the previous state remains recoverable. See [Version History](./version-history) for details.

## Outline and Reading Width

The document outline lets you jump between headings while reading or previewing a document. The content-width control in Settings provides comfortable, wide, and custom widths for normal notes and wide tables.

## Leaving the Editor

Click the back button to return to the Library. The editor performs a save check before leaving; if saving fails, resolve the error before deleting any local data directory.
