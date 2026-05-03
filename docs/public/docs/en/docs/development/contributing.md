---
title: Contributing
description: How to contribute code, report issues, and participate in QuantaNote development
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Contributing

Thank you for your interest in QuantaNote! This guide will walk you through how to participate in QuantaNote development, including code contributions, issue reporting, and the development workflow.

## Getting Started

### Fork the Repository

1. Visit the [QuantaNote GitHub repository](https://github.com/shenjianZ/QuantaNote)
2. Click the **Fork** button in the top-right corner to fork the repository to your account
3. Clone your fork to your local machine:

```bash
git clone https://github.com/your-username/QuantaNote.git
cd QuantaNote
```

### Add the Upstream Remote

```bash
git remote add upstream https://github.com/shenjianZ/QuantaNote.git
```

Sync with upstream regularly:

```bash
git fetch upstream
git checkout master
git merge upstream/master
```

### Install Dependencies

```bash
pnpm install
```

For detailed development environment setup, see [Building from Source](/docs/development/building).

## Development Workflow

### Branch Naming Conventions

When creating branches for new features or fixes, follow these naming conventions:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feat/` | New feature | `feat/sync-enhancements` |
| `fix/` | Bug fix | `fix/search-crash` |
| `docs/` | Documentation update | `docs/api-reference` |
| `refactor/` | Code refactoring | `refactor/item-store` |
| `test/` | Test-related | `test/e2e-workspace` |
| `chore/` | Miscellaneous | `chore/update-deps` |

### Create a Feature Branch

```bash
# Create branch from latest master
git checkout master
git pull upstream master
git checkout -b feat/your-feature-name
```

### Commit Message Conventions

QuantaNote follows the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation update
- `style` — Code formatting (no logic changes)
- `refactor` — Code refactoring
- `test` — Test-related
- `chore` — Build or auxiliary tools

**Examples:**

```
feat(editor): add Markdown keyboard shortcuts

Add common Markdown shortcuts to the Vditor editor, including bold, italic, code blocks, etc.

Closes #123
```

```
fix(search): fix full-text search Chinese tokenization issue

FTS5 search was truncating Chinese content. Updated tokenizer configuration to fix the issue.

Fixes #456
```

## Code Conventions

### TypeScript

- **Strict mode** is enabled; implicit `any` is not allowed
- Use functional components and Hooks; do not use class components
- Prefer `interface` for type definitions
- Use string union types or `const enum` instead of `enum`

### CSS

- Use TailwindCSS utility classes; do not write custom CSS (except for theme variables)
- Theme CSS variable names follow the project convention:

```css
/* Core color variables */
--app-bg      /* Application background */
--paper       /* Paper/card background */
--text        /* Primary text color */
--muted       /* Secondary text color */
--line        /* Divider color */
--field       /* Input field background */
--hover       /* Hover state background */
--accent      /* Accent color */
--accent-soft /* Soft accent color */
--popover     /* Popover/overlay background */
```

### Package Manager

- **Strictly use pnpm** — npm and yarn are not supported
- Add new dependencies with `pnpm add <package>`
- Add dev dependencies with `pnpm add -D <package>`

### Rust

- Follow `cargo fmt` formatting standards
- Pass `cargo clippy` code quality checks
- Public APIs must have documentation comments (`///`)
- Use `Result<T, AppError>` for error handling; avoid `unwrap()`

## Submitting Changes

### Creating a Pull Request

1. Make sure all tests pass:

```bash
pnpm test:unit && pnpm test:rust
pnpm build && cargo check --manifest-path src-tauri/Cargo.toml
```

2. Format your code:

```bash
pnpm format:rust
```

3. Push your branch and create a PR:

```bash
git push origin feat/your-feature-name
```

4. Create a Pull Request on GitHub with the following information:
   - **Title** — Use the Conventional Commits format
   - **Description** — Detailed explanation of changes and rationale
   - **Linked Issues** — Use `Closes #123` or `Fixes #456`
   - **Screenshots** — Include screenshots for UI changes

### PR Review Process

1. A project maintainer will review your code
2. Make changes based on review feedback
3. Ensure all CI checks pass
4. A maintainer will merge your PR

## Reporting Issues

### Submitting Bug Reports

When filing a bug report on [GitHub Issues](https://github.com/shenjianZ/QuantaNote/issues), please include:

- **Description** — A clear description of the problem
- **Steps to reproduce** — Step-by-step instructions to reproduce the issue
- **Expected behavior** — What you expected to happen
- **Actual behavior** — What actually happened
- **Environment info** — Operating system, application version
- **Logs** — Error logs if available
- **Screenshots** — If applicable

### Feature Requests

When submitting a feature request, please include:

- **Background** — Why you need this feature
- **Description** — Detailed description of the desired feature
- **Use cases** — Specific scenarios where the feature would be useful
- **Alternatives** — Other solutions you have considered

### Issue Labels

| Label | Meaning |
|-------|---------|
| `bug` | Bug report |
| `enhancement` | Feature request |
| `good first issue` | Suitable for new contributors |
| `help wanted` | Needs community help |
| `documentation` | Documentation-related |
| `P0` - `P3` | Priority level |

## Development Tips

- After modifying frontend UI code, check if corresponding E2E test files need updating
- You may batch frontend changes first and then fix E2E tests in a separate step
- Use PowerShell for command-line operations on Windows
- The database file is at `~/.quantanote/quanta_note.sqlite` — back it up during development
