---
title: 测试指南
description: QuantaNote 的三层测试策略和最佳实践
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# 测试指南

QuantaNote 采用三层测试策略，从前端单元测试、后端单元测试到端到端测试，全面覆盖应用功能。本文介绍每种测试类型的工具、编写方式和运行方法。

## 前端单元测试

### 技术栈

- **Vitest** — 快速的单元测试框架，兼容 Jest API
- **jsdom** — 模拟浏览器 DOM 环境
- **@testing-library/react** — React 组件测试工具

### 测试文件组织

测试文件与源文件同目录放置，使用 `.test.tsx` 或 `.test.ts` 后缀命名：

```
src/
├── stores/
│   ├── appStore.ts
│   └── appStore.test.ts       # 对应的测试文件
├── components/
│   └── common/
│       ├── Modal.tsx
│       └── Modal.test.tsx     # 对应的测试文件
└── test/
    └── test-utils.tsx          # 测试辅助函数
```

### 编写示例

```tsx
// stores/itemStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useItemStore } from './itemStore';

describe('itemStore', () => {
  beforeEach(() => {
    // 重置 store 状态
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

### 测试工具

`src/test/test-utils.tsx` 提供了常用的测试辅助函数：

- 渲染组件的包装函数（包含 Provider）
- Mock Tauri invoke 调用
- 常用的查询和断言工具

### 运行测试

```bash
# 运行所有前端单元测试
pnpm test:unit

# 运行特定文件
pnpm test:unit -- src/stores/itemStore.test.ts

# 监听模式
pnpm test:unit -- --watch

# 查看覆盖率
pnpm test:unit -- --coverage
```

## Rust 单元测试

### 测试组织

Rust 测试通常写在同一个源文件中，使用 `#[cfg(test)]` 模块：

```rust
// src-tauri/src/repositories/item_repository.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_item() {
        // 在内存数据库中测试
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

### 测试约定

- 使用内存 SQLite 数据库进行测试，避免影响真实数据
- 每个 `#[test]` 函数应独立运行，不依赖其他测试的状态
- 测试数据库应在测试 setup 时初始化 Schema

### 运行测试

```bash
# 运行所有 Rust 单元测试
pnpm test:rust

# 运行特定模块的测试
cargo test --manifest-path src-tauri/Cargo.toml -- item_repository

# 显示标准输出
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture

# 运行单个测试函数
cargo test --manifest-path src-tauri/Cargo.toml -- test_create_item
```

## E2E 测试

### 技术栈

- **WebdriverIO** — 浏览器自动化测试框架
- **Page Object Model** — 页面对象设计模式，提高测试可维护性
- **串行模式** — 测试按顺序执行，避免并发导致的稳定性问题

### 测试文件组织

```
test/
├── wdio.conf.ts              # WebdriverIO 配置
├── pageobjects/              # 页面对象
│   ├── workspace.page.ts     # 工作台页面
│   ├── library.page.ts       # 记录库页面
│   └── settings.page.ts      # 设置页面
├── specs/                    # 测试规格
│   ├── workspace.spec.ts     # 工作台测试
│   ├── library.spec.ts       # 记录库测试
│   └── settings.spec.ts      # 设置测试
└── helpers/                  # 测试辅助工具
```

### 编写示例

```typescript
// test/pageobjects/workspace.page.ts
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
// test/specs/workspace.spec.ts
import { expect } from '@wdio/globals';
import { WorkspacePage } from '../pageobjects/workspace.page';

describe('Workspace', () => {
  const workspace = new WorkspacePage();

  beforeEach(async () => {
    await workspace.open();
  });

  it('should add a quick note', async () => {
    await workspace.addQuickNote('Test note content');
    // 验证笔记已添加
  });
});
```

### 运行测试

```bash
# 运行所有 E2E 测试
pnpm test:e2e

# 运行特定测试文件
pnpm test:e2e -- --spec test/specs/workspace.spec.ts

# 指定浏览器
pnpm test:e2e -- --capabilities.browserName chrome
```

> **注意**：E2E 测试需要先构建应用（`pnpm tauri build`），确保测试环境与生产环境一致。

## 测试最佳实践

### 通用原则

1. **测试行为，而非实现** — 关注组件/函数的外部行为
2. **保持测试独立** — 每个测试应能独立运行
3. **命名清晰** — 测试名称应描述预期行为
4. **覆盖边界情况** — 不仅测试正常路径，也要测试异常路径

### 提交前检查

在提交代码前，建议运行完整的测试套件：

```bash
# 运行所有测试
pnpm test:unit && pnpm test:rust

# 类型检查
pnpm build && cargo check --manifest-path src-tauri/Cargo.toml
```
