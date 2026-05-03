---
title: Development Commands
description: Quick reference for common QuantaNote development commands
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Development Commands

This page lists the common commands used during QuantaNote development. All commands use pnpm as the package manager and should be run from the project root directory.

## Frontend Development

### Start Dev Server

```bash
pnpm dev
```

Starts the Vite development server on port **1420**. This includes only the frontend portion, suitable for pure frontend development (no Rust changes). Supports hot module replacement (HMR) — the browser will automatically update when code changes.

### Frontend Build

```bash
pnpm build
```

Runs TypeScript type checking and bundles frontend assets with Vite. Build output goes to the `dist/` directory. Use this command to verify that frontend code has no type errors or build issues.

### Preview Build Output

```bash
pnpm preview
```

Starts a local server to preview the `pnpm build` output. Useful for verifying that the production build works correctly.

## Tauri Development

### Development Mode

```bash
pnpm tauri dev
```

Starts both the frontend dev server and Rust backend compilation, opening a Tauri desktop window. This is the most commonly used command for daily development:

- Frontend changes trigger Vite HMR hot reload
- Rust code changes trigger automatic recompilation
- First launch requires compiling Rust dependencies (takes longer)
- Subsequent launches use incremental compilation for faster startup

### Production Build

```bash
pnpm tauri build
```

Builds a production version of the installer. This command will:

1. Run TypeScript type checking
2. Bundle frontend with Vite
3. Compile Rust in Release mode
4. Generate platform-specific installers

Build artifacts are located at `src-tauri/target/release/bundle/`.

## Testing

### Frontend Unit Tests

```bash
# Run all frontend unit tests
pnpm test:unit

# Run a specific test file
pnpm test:unit -- path/to/test.test.ts

# Watch mode (auto-rerun on file changes)
pnpm test:unit -- --watch
```

Uses Vitest + jsdom environment with @testing-library/react for component testing.

### Rust Unit Tests

```bash
# Run all Rust unit tests
pnpm test:rust

# Run tests for a specific module
cargo test --manifest-path src-tauri/Cargo.toml -- module_name

# Show test output
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
```

### E2E Tests

```bash
# Run all E2E tests (serial mode)
pnpm test:e2e

# Run a specific test file
pnpm test:e2e -- --spec test/specs/example.spec.ts
```

Uses WebdriverIO for end-to-end testing, executed in serial mode for stability.

## Formatting

### Rust Code Formatting

```bash
# Format Rust code
pnpm format:rust

# Check formatting only (do not modify files)
pnpm format:rust:check
```

Uses `cargo fmt` for Rust code formatting to ensure consistent code style.

## Type Checking

### Full Project Type Check

```bash
# Frontend build check + Rust type check
pnpm build && cargo check --manifest-path src-tauri/Cargo.toml
```

This is the recommended check command to run before committing code, ensuring both frontend and backend have no type errors.

### Rust Type Check Only

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Checks only the Rust backend types — faster than a full compilation.

### Frontend Type Check Only

```bash
pnpm build
```

The frontend build process includes TypeScript type checking.

## Command Reference

| Command | Purpose | Use Case |
|---------|---------|----------|
| `pnpm dev` | Frontend dev server | Frontend-only development |
| `pnpm build` | Frontend build + type check | Verify frontend code |
| `pnpm tauri dev` | Full-stack dev mode | Daily development |
| `pnpm tauri build` | Production build | Release version |
| `pnpm test:unit` | Frontend unit tests | Verify component logic |
| `pnpm test:rust` | Rust unit tests | Verify backend logic |
| `pnpm test:e2e` | E2E tests | Verify complete workflows |
| `pnpm format:rust` | Format Rust code | Before code commits |
| `pnpm format:rust:check` | Check Rust formatting | CI checks |
| `cargo check` | Rust type check | Quick Rust code verification |
