---
title: Testing Guide
description: QuantaNote's three-tier testing strategy and best practices
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-19
---

# Testing Guide

QuantaNote employs a three-tier testing strategy covering frontend unit tests, backend unit tests, and end-to-end tests. This document covers the tools, writing conventions, and execution methods for each test type.

## Frontend Unit Tests

### Tech Stack

- **Vitest** — Fast unit test framework, compatible with the Jest API
- **jsdom** — Simulated browser DOM environment
- **@testing-library/react** — React component testing utilities

### Test File Organization

Test files are co-located with source files, using the `.test.tsx` or `.test.ts` suffix:

```
src/
├── stores/
│   ├── appStore.ts
│   └── appStore.test.ts       # Corresponding test file
├── components/
│   └── common/
│       ├── Modal.tsx
│       └── Modal.test.tsx     # Corresponding test file
└── test/
    └── test-utils.tsx          # Test helper functions
```

### Writing Tests

```tsx
// stores/itemStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useItemStore } from './itemStore';

describe('itemStore', () => {
  beforeEach(() => {
    // Reset store state
    useItemStore.setState({
      items: [],
      currentItem: null,
    });
  });

  it('should add a new item', () => {
    const { addItem } = useItemStore.getState();
    addItem({ title: 'Test', content: 'Content' });
    const { items } = useItemStore.getState();
    expect(items).toHaveLength(1);
  });
});
```

### Test Utilities

`src/test/test-utils.tsx` provides commonly used test helper functions:

- Wrapper functions for rendering components (including Providers)
- Mock Tauri invoke calls
- Common query and assertion utilities

### Running Tests

```bash
# Run all frontend unit tests
pnpm test:unit

# Run a specific file
pnpm test:unit -- src/stores/itemStore.test.ts

# Watch mode
pnpm test:unit -- --watch

# View coverage
pnpm test:unit -- --coverage
```

## Rust Unit Tests

### Test Organization

Rust tests are typically written in the same source file using `#[cfg(test)]` modules:

```rust
// src-tauri/src/repositories/item_repository.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_item() {
        // Test with an in-memory database
        let conn = create_test_connection();
        let repo = ItemRepository::new(conn);
        let result = repo.create("Test Title", "Test Content");
        assert!(result.is_ok());
    }

    #[test]
    fn test_find_by_id() {
        let conn = create_test_connection();
        let repo = ItemRepository::new(conn);
        let item = repo.create("Title", "Content").unwrap();
        let found = repo.find_by_id(&item.id);
        assert!(found.is_some());
    }
}
```

### Testing Conventions

- Use in-memory SQLite databases for testing to avoid affecting real data
- Each `#[test]` function should run independently without depending on other tests' state
- The test database should initialize the schema during test setup

### Running Tests

```bash
# Run all Rust unit tests
pnpm test:rust

# Run tests for a specific module
cargo test --manifest-path src-tauri/Cargo.toml -- item_repository

# Show standard output
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture

# Run a single test function
cargo test --manifest-path src-tauri/Cargo.toml -- test_create_item
```

## E2E Tests

### Tech Stack

- **WebdriverIO** — Browser automation test framework
- **Page Object Model** — Design pattern for improved test maintainability
- **Serial mode** — Tests run sequentially to avoid concurrency-related stability issues

### Test File Organization

```
e2e-tests/
├── wdio.conf.js              # WebdriverIO configuration
├── helpers/                  # Page objects and test helpers
└── specs/                    # Test specifications
    ├── document-editor.e2e.js
    ├── library-reader.e2e.js
    ├── search-replace.e2e.js
    └── settings.e2e.js
```

### Writing Tests

```typescript
// e2e-tests/helpers/page-objects/DocumentEditorPage.js
import { Page } from './base.page';

export class WorkspacePage extends Page {
  get quickInput() {
    return $('textarea[data-testid="quick-input"]');
  }

  get submitButton() {
    return $('button[data-testid="submit-btn"]');
  }

  async addQuickNote(content: string) {
    await this.quickInput.setValue(content);
    await this.submitButton.click();
  }
}
```

```typescript
// e2e-tests/specs/document-editor.e2e.js
import { expect } from '@wdio/globals';
import { WorkspacePage } from '../pageobjects/workspace.page';

describe('Workspace', () => {
  const workspace = new WorkspacePage();

  beforeEach(async () => {
    await workspace.open();
  });

  it('should add a quick note', async () => {
    await workspace.addQuickNote('Test note content');
    // Verify the note was added
  });
});
```

### Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run release regression tests serially
pnpm test:e2e:serial

# Run a specific test file
pnpm test:e2e -- --spec e2e-tests/specs/document-editor.e2e.js

# Specify browser
pnpm test:e2e -- --capabilities.browserName chrome
```

> **Note:** E2E tests require building the application first (`pnpm tauri build`) to ensure the test environment matches production.

### v0.4.0 Release Regression Focus

Before release, cover table insertion and adjustment, Markdown chart and formula rendering, scroll stability, fixed summary size, copy/paste feedback, native Windows clipboard behavior, content width, and the document outline.

## Testing Best Practices

### General Principles

1. **Test behavior, not implementation** — Focus on the external behavior of components/functions
2. **Keep tests independent** — Each test should be able to run on its own
3. **Clear naming** — Test names should describe the expected behavior
4. **Cover edge cases** — Test not only the happy path but also error scenarios

### Pre-Commit Checks

Before committing code, we recommend running the full test suite:

```bash
# Run all tests
pnpm test:unit && pnpm test:rust

# Type check
pnpm build && cargo check --manifest-path src-tauri/Cargo.toml
```
