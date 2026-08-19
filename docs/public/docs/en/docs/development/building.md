---
title: Building from Source
description: Learn how to set up a local development environment, clone the repository, and build QuantaNote from source
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-19
---

# Building from Source

This guide will walk you through building QuantaNote from source. Before you begin, make sure your system meets all the prerequisites.

## Prerequisites

Before building QuantaNote, you need to install the following tools:

- **Node.js 20.19+ (CI uses Node.js 22)** — Frontend runtime and package management foundation
  ```bash
  # Recommended: use nvm to manage Node.js versions
  nvm install 22
  nvm use 22
  node --version  # Confirm version >= 20.19
  ```

- **pnpm 10.33.2** — Package manager (QuantaNote only supports pnpm)
  ```bash
  corepack enable
  corepack prepare pnpm@10.33.2 --activate
  pnpm --version  # Confirm version 10.33.2
  ```

- **Rust toolchain** — Required for backend compilation
  ```bash
  # Install Rust via rustup
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  rustc --version  # Confirm installation
  cargo --version
  ```

- **Tauri 2.0 dependencies** — Install platform-specific dependencies:
  - **Windows**: Visual Studio C++ Build Tools, WebView2
  - **Linux**: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, etc.
  - **macOS**: Xcode Command Line Tools

## Clone and Install

```bash
# Clone the repository
git clone https://github.com/shenjianZ/QuantaNote.git
cd QuantaNote

# Install frontend dependencies
pnpm install
```

After installation, dependencies are locked in `pnpm-lock.yaml` to ensure consistent dependency versions across the team.

## Development Mode

Development mode starts both the frontend Vite dev server (port 1420) and the Rust backend:

```bash
# Start Tauri development mode
pnpm tauri dev
```

This command will:

1. Start the Vite dev server with hot module replacement (HMR)
2. Compile the Rust backend and launch the Tauri window
3. Automatically hot-reload when frontend code changes
4. Automatically recompile when Rust code changes

If you only need to develop the frontend (without Rust changes), you can start it separately:

```bash
pnpm dev
```

## Production Build

```bash
# Build production version
pnpm tauri build
```

Release builds also run in GitHub Actions for Windows, macOS Intel/Apple Silicon, Linux, and Android ARM64. Production releases require signing Secrets; local private-key files must not replace CI Secrets.

This command will:

1. Run TypeScript type checking
2. Bundle frontend assets with Vite
3. Compile the Rust backend in Release mode
4. Generate platform-specific installers

To check only the frontend build:

```bash
pnpm build
```

To check only the Rust compilation:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## Build Artifacts

After a successful production build, installers are located in `src-tauri/target/release/bundle/`:

| Platform | Artifacts |
|----------|-----------|
| **Windows** | `.msi` installer, `.exe` executable |
| **Linux** | `.deb` Debian package, `.AppImage` portable |
| **macOS** | `.dmg` disk image, `.app` application bundle |
| **Android** | ARM64 `.apk` |

Build artifact path example:

```
src-tauri/target/release/
├── quantanote.exe          # Windows executable
└── bundle/
    ├── msi/                # Windows MSI installer
    │   └── QuantaNote_0.1.0_x64_en-US.msi
    └── nsis/               # Windows NSIS installer
        └── QuantaNote_0.1.0_x64-setup.exe
```

## Troubleshooting

### Rust Compilation Fails

Make sure your Rust toolchain is up to date:

```bash
rustup update stable
```

### Frontend Dependency Installation Fails

Try clearing the cache and reinstalling:

```bash
pnpm store prune
rm -rf node_modules
pnpm install
```

### Missing WebView2 (Windows)

On Windows, Tauri depends on the WebView2 runtime. Most Windows 11 systems have it pre-installed. If missing, download it from the [Microsoft website](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).
