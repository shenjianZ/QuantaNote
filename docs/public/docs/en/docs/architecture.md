---
title: Architecture
description: QuantaNote Architecture documentation index — system design, frontend and backend architecture, database, and communication
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Architecture

This section provides an in-depth look at QuantaNote's system architecture. Built on Tauri 2.0, QuantaNote uses a layered architecture with a React + TypeScript frontend and a Rust backend, communicating through IPC (Inter-Process Communication).

## Chapter Index

1. **[Architecture Overview](/docs/architecture/overview)**

   Learn about QuantaNote's overall architecture design, including the Tauri 2.0 high-level structure, layered design pattern, communication model, and data flow direction.

2. **[Frontend Architecture](/docs/architecture/frontend)**

   Dive into the frontend technology stack, page component design, component hierarchy, Zustand state management approach, and key dependency libraries.

3. **[Backend Architecture](/docs/architecture/backend)**

   Explore the Rust backend directory structure, the Command/Service/Repository three-layer architecture, error handling, and the sync engine.

4. **[Database Design](/docs/architecture/database)**

   Detailed look at SQLite database configuration, table structure definitions, FTS5 full-text search indexing, and the version-based schema migration system.

5. **[IPC Communication](/docs/architecture/ipc)**

   Understand the communication mechanism between frontend and backend, including invoke() command calls, JSON serialization, the complete command reference, and type contract definitions.

6. **[State Management](/docs/architecture/state-management)**

   Comprehensive overview of the 8 Zustand Stores — their design philosophy, responsibilities, cross-store communication, and the DTO-to-view-model adapter pattern.
