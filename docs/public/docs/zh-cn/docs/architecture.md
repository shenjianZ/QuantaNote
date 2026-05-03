---
title: 架构
description: QuantaNote 架构文档目录页 — 深入了解 QuantaNote 的系统设计、前后端架构、数据库与通信机制
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# 架构

本章节深入介绍 QuantaNote 的系统架构设计。QuantaNote 基于 Tauri 2.0 构建，采用前后端分离的分层架构，前端使用 React + TypeScript，后端使用 Rust，通过 IPC（进程间通信）进行数据交换。

## 章节目录

1. **[架构概览](/docs/architecture/overview)**

   了解 QuantaNote 的整体架构设计，包括 Tauri 2.0 高层架构、分层设计模式、通信模型和数据流方向。

2. **[前端架构](/docs/architecture/frontend)**

   深入了解前端技术栈选型、页面组件设计、组件层级关系、Zustand 状态管理方案以及关键依赖库的使用。

3. **[后端架构](/docs/architecture/backend)**

   探索 Rust 后端的目录结构、Command/Service/Repository 三层架构设计、错误处理机制和同步引擎。

4. **[数据库设计](/docs/architecture/database)**

   详细了解 SQLite 数据库配置、表结构定义、FTS5 全文检索索引设计以及基于版本的 Schema 迁移系统。

5. **[IPC 通信](/docs/architecture/ipc)**

   理解前后端之间的通信机制，包括 invoke() 命令调用、JSON 序列化、完整命令参考和类型契约定义。

6. **[状态管理](/docs/architecture/state-management)**

   全面了解 8 个 Zustand Store 的设计理念、职责划分、跨 Store 通信方式以及 DTO 到视图模型的适配器模式。
