---
title: Full-Text Search
description: QuantaNote search with normal and advanced modes, CJK substring matching, highlighting, and selectable search scopes.
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-29
---

# Full-Text Search

QuantaNote features a powerful full-text search system built on SQLite's **FTS5** (Full-Text Search 5) extension. It uses a dual-engine approach to support both English and Chinese text, including substring matching for CJK characters — ensuring fast and accurate retrieval across your entire note collection.

## How It Works

QuantaNote's search uses two complementary FTS5 tokenizers:

### Unicode61 Tokenizer

The `unicode61` tokenizer handles standard Western language text:

- Splits words on whitespace and punctuation boundaries.
- Applies Unicode case folding for case-insensitive matching.
- Supports basic query syntax including prefix searches (`term*`) and boolean operators (`AND`, `OR`, `NOT`).

### Trigram Tokenizer

The `trigram` tokenizer is designed for CJK (Chinese, Japanese, Korean) text:

- Splits text into overlapping 3-character sequences (trigrams).
- Enables **substring matching** — you can find Chinese text by typing any contiguous portion of the phrase, even without word boundaries.
- This is essential for Chinese, where words are not separated by spaces and substring search is the expected behavior.

### Dual-Engine Strategy

Both tokenizers index the same content. When you perform a search, the query engine selects the appropriate tokenizer based on the input, or uses both in parallel to deliver the most relevant results regardless of the language you are searching in.

## Searching

To perform a search:

1. Navigate to the **Library** page.
2. Click the **search bar** at the top of the page.
3. Type your search query. Results update in real time as you type.
4. Wait for the debounced results to load. Use the filter panel to switch between normal and advanced search.

### Query Syntax

Normal search is intended for everyday lookup. Multiple terms separated by spaces must all be present, and CJK text can be searched by typing any contiguous substring. Operators are treated as ordinary text in normal mode.

Advanced search parses the following syntax and converts it into a safe query:

| Syntax | Description | Example |
|--------|-------------|---------|
| Simple term | Match items containing the term | `meeting` |
| Multiple terms | Match items containing all terms (implicit AND) | `project status` |
| Phrase search | Match an exact phrase in quotes | `"project status"` |
| Prefix search | Put an asterisk at the end of a term | `proj*` |
| Boolean OR | Match items containing either term | `meeting OR call` |
| Negation | Exclude a term with `-` or `NOT` | `meeting -cancelled` |

In advanced mode, terms around `OR` form an optional group and spaces imply `AND`. Unclosed quotes and incomplete operators are rejected.

For Chinese text, simply type any portion of the phrase. The trigram engine will find all items containing that substring.

## Search Results

Search results are displayed in the Library's item card layout with the following features:

- **Matched fields** — Each result identifies whether the match is in the title, summary, content, tag, attachment, or version.
- **Context snippet** — Each result shows text near the match, preferring note content or the related field.
- **Keyword highlighting** — Matching terms are highlighted in the title and context.
- **Type Icon** — An icon indicating the item type.
- **Tags and Timestamps** — Standard metadata is shown on each result card.
- **Stable ordering** — Results default to last-updated order and can be switched to created-time or title order in the Library filter panel.
- **Result Count** — The total number of matching items is displayed above the results.

Click any result to open it in the Reader Drawer or Document Editor.

## What Gets Indexed

The FTS5 index covers the following fields for each item:

| Field | Description |
|-------|-------------|
| **Title** | The item's title text. |
| **Content** | The full Markdown content of the item. |
| **Summary** | The item's optional summary or description. |

The index is kept in sync with the database through SQLite triggers. When an item is created, updated, or deleted, the corresponding FTS5 entries are automatically updated. This means the search index is always current — there is no delay between saving a note and it appearing in search results.

### Not Indexed

The following data is not included in the full-text search index:

### Optional Search Scopes

The Library filter panel can also search the following scopes:

| Scope | Matched data |
|-------|--------------|
| Tags | Names of tags assigned to the note |
| Attachments | Attachment filenames (file contents are not read) |
| Versions | Version names, descriptions, change summaries, and version content |

The `Ctrl+K` Command Palette always uses normal mode and the content scope for fast navigation. Use the Library search bar for advanced syntax or related-data searches.
