---
title: Library
description: Browse, filter, and manage all your notes and items in the QuantaNote Library.
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-30
---

# Library

The Library is the central hub for browsing, filtering, and managing all your items. It provides a card-based layout with powerful filtering, sorting, and search capabilities, along with a side drawer for reading content without leaving the page.

## Item List

Items are displayed as cards in a responsive grid layout. Each card shows:

- **Title** — The item's title, extracted from the first line of content or set manually.
- **Summary** — A truncated preview of the item's content or summary field.
- **Tags** — Colored tag badges associated with the item.
- **Timestamps** — Relative time indicators for creation and last update (e.g., "2 hours ago", "3 days ago").
- **Type Icon** — An icon indicating the item type, derived from its content format.

Cards are clickable — click any card to open the Reader Drawer for a quick preview, or navigate to the Document Editor for full editing.

## Filter Tabs

The Library provides three filter tabs at the top of the item list:

| Tab | Description |
|-----|-------------|
| **All** | Shows every item in your collection, sorted by your chosen criteria. |
| **Pinned** | Shows only items that have been pinned to the top. Pinned items always appear first regardless of sort order. |
| **Favorites** | Shows only items marked with the favorite (star) indicator. |

Switch between tabs to quickly narrow down your view. The active tab is visually highlighted.

## Tag Filtering

In addition to the filter tabs, you can filter items by a specific tag. When a tag filter is active:

- Only items bearing the selected tag are displayed.
- A clear button appears next to the active tag filter so you can remove it.
- Tag filtering works in combination with the filter tabs (e.g., you can view "Pinned" items filtered by a specific tag).

## Note Property Filters

When a note has Frontmatter properties, the filter panel can also filter by status and priority. Property filters can be combined with the All, Pinned, Favorites, tag, and search conditions.

The filter panel also supports item type, updated-time, untagged, and attachment conditions. The **Incomplete** status excludes items marked as done or archived.

## Smart Collections and Saved Searches

The Library provides four built-in smart collections: Recently modified, Unclassified, Favorites, and Incomplete. These are dynamic conditions and are recalculated from the current items whenever applied.

Enter a name in the filter panel and choose **Save search** to persist the current query, tag, type, time, status, priority, attachment, and search-scope conditions. Saved searches are stored in app settings and remain available after restarting the app. Click a saved search to apply it again, or use its close button to delete it.

## Daily Notes and Calendar

Click the calendar icon in the Library toolbar to switch to the calendar view. The calendar counts active, non-deleted records by creation date and shows the count on dates that contain records. Use the arrow buttons to move between months.

Select a date and choose **Open daily note**. If that date already has a daily note, QuantaNote opens it; otherwise it creates one. The new note:

- Uses the built-in **Daily log** template, with the selected date materialized in the template
- Stores `daily_date: YYYY-MM-DD` in Frontmatter so it can be found reliably without creating duplicates
- Receives the `daily` tag automatically for quick filtering
- Remains a regular Markdown note, so it can use `[[Note title]]` links and participate in backlinks

Use the **List view** button to return to the regular Library list. Changing months does not alter the active search or filter conditions.

To activate tag filtering, click on any tag badge on an item card, or use the tag filter dropdown in the Library toolbar.

## Sorting

The Library supports three sorting modes to help you find items quickly:

| Sort Option | Description |
|-------------|-------------|
| **Updated** | Items sorted by last updated time, most recent first. This is the default sort. |
| **Created** | Items sorted by creation time, newest first. |
| **Title** | Items sorted alphabetically by title (A-Z). |
| **Priority** | High-priority items appear first. |
| **Due date** | Items with due dates are sorted from earliest to latest; items without a due date appear last. |

Change the sort mode using the sort dropdown in the Library toolbar.

## Reader Drawer

The Reader Drawer is a side panel that slides in from the right when you click an item card. It provides:

- **Rendered Markdown** — The item's content is rendered as formatted Markdown with proper styling for headings, lists, code blocks, links, and images.
- **Note links** — Click `[[Note title]]` links to navigate to another note, and use the panel below the content to inspect forward links, backlinks, and the relationship graph.
- **Metadata** — Tags, timestamps, and summary are displayed at the top of the drawer.
- **Actions** — Quick action buttons to edit, pin, favorite, or delete the item without closing the drawer.
- **Close** — Click the close button or press `Escape` to dismiss the drawer.

The Reader Drawer allows you to preview content without navigating away from the Library, keeping your browsing flow uninterrupted.

## Item Actions

Each item in the Library supports a set of actions accessible via the card's context menu or the Reader Drawer:

- **Edit** — Open the item in the full Document Editor.
- **Delete** — Remove the item permanently (with confirmation prompt).
- **Pin** — Pin the item to the top of the Library for quick access.
- **Favorite** — Toggle the favorite (star) status of the item.
- **Copy Content** — Copy the item's Markdown content to the system clipboard and show the result.
- **Manage Tags** — Open the Tag Picker modal to add or remove tags.
- **Manage Attachments** — Open the Attachment Manager modal to upload or remove files.

## Create New Item

A prominent **New Note** button is available in the Library toolbar. Clicking it opens the template picker, where you can choose a blank note, a built-in template, or one of your custom templates before entering the Document Editor.

Alternatively, you can create items quickly from the Workspace using the quick capture flow.
