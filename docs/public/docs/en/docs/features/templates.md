---
title: Templates
description: Use built-in and custom Markdown templates to start new QuantaNote notes faster.
author: QuantaNote Team
createdAt: 2026-08-30
lastUpdated: 2026-08-30
---

# Templates

Templates save repeated Markdown structures so you can start a new note quickly. QuantaNote includes built-in templates and lets you create templates for your own workflows.

## Choose a template

After choosing New Note from the Library, the top-level new-note action, the command palette, or the system tray, QuantaNote opens the template picker:

- **Blank note** creates a note with empty content.
- **Built-in templates** include daily logs, meeting notes, reading notes, and project logs.
- **My templates** contains your saved custom templates.

Selecting a template creates the note and opens the editor. The template name becomes the initial note title, while `{{date}}` and `{{time}}` in the body are replaced with the current date and time.

Workspace quick capture still saves the entered text directly so that rapid capture is not interrupted.

## Manage custom templates

Click **Manage templates** in the picker to:

1. Click **New template** and enter a name, description, and Markdown body.
2. Edit an existing custom template and save the changes.
3. Copy a built-in or custom template to create an editable copy.
4. Delete a custom template. Deletion requires a second confirmation click.

Built-in templates are read-only application resources. Copy one before editing it.

## Storage scope

Custom templates are stored in the local `templates` table and remain with the application's local data. Built-in templates come from the localized application resources, so they do not consume user-template storage and cannot be accidentally deleted. Templates are currently local authoring aids and are not included in note-body synchronization.
