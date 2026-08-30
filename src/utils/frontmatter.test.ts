import { describe, expect, it } from "vitest";
import {
  parseNoteProperties,
  stripFrontmatter,
  updateNoteProperties,
} from "./frontmatter";

describe("frontmatter", () => {
  it("解析状态、优先级、截止日期和别名", () => {
    const content = `---
status: in_progress
priority: high
due: 2026-09-12
aliases:
  - 搜索
  - Search
---
# 正文`;

    expect(parseNoteProperties(content)).toEqual({
      status: "in-progress",
      priority: "high",
      dueDate: "2026-09-12",
      aliases: ["搜索", "Search"],
    });
    expect(stripFrontmatter(content)).toBe("# 正文");
  });

  it("不会把普通水平线误判为 Frontmatter", () => {
    const content = "---\n正文";
    expect(parseNoteProperties(content).status).toBe("inbox");
    expect(stripFrontmatter(content)).toBe(content);
  });

  it("更新属性时保留未管理字段并替换旧属性", () => {
    const content = `---
custom: keep
status: inbox
aliases:
  - old
---
正文`;
    expect(updateNoteProperties(content, { status: "done", aliases: ["new"] })).toBe(`---
custom: keep
status: "done"
aliases:
  - "new"
---
正文`);
  });

  it("恢复默认属性时移除受管理字段", () => {
    const content = `---
status: done
priority: high
due: 2026-09-12
---
正文`;
    expect(updateNoteProperties(content, {
      status: "inbox",
      priority: "none",
      dueDate: null,
      aliases: [],
    })).toBe("正文");
  });
});
