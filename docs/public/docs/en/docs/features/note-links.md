---
title: Note Links
description: Connect QuantaNote notes with wiki links and explore forward links, backlinks, and the relationship graph
author: QuantaNote Team
createdAt: 2026-08-30
lastUpdated: 2026-08-30
---

# Note Links

QuantaNote supports wiki links for connecting notes. Relationships are resolved from the current content of active notes, so no manual relationship maintenance is required.

## Link syntax

Type either form in Markdown:

```markdown
[[Target note]]
[[Target note|Custom label]]
```

The first form displays the note title. The second uses a custom label while still targeting **Target note**. Examples inside fenced or inline code are not treated as links.

## Reading and navigation

Open a note from the Library to use wiki links in the reader:

- If the target exists, clicking the link switches the reader to that note.
- If the target does not exist, clicking a forward link creates and opens an empty note with that title.
- The **Note Links** panel below the content lists forward links and backlinks.
- Click a backlink to return to the note that references the current note.

Unresolved forward links use a dashed style and a plus marker so they are easy to distinguish from existing targets.

## Relationship graph

Click **Graph** in the Note Links panel to view all active notes and their resolved connections. Arrows show the direction of references in note content; unresolved references are summarized below the graph.

The graph is generated from the current database contents. Reopen it after changing a title, content, or trash state to see the latest relationships.
