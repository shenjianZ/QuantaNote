import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { setup } from "../../test/test-utils";
import { MarkdownRenderer } from "./MarkdownRenderer";

describe("MarkdownRenderer Frontmatter", () => {
  it("隐藏原始 Frontmatter 并展示笔记属性", () => {
    setup(
      <MarkdownRenderer
        content={`---
status: done
priority: high
due: 2026-09-12
aliases: [搜索, Search]
---
# 正文标题

正文内容`}
      />,
    );

    expect(screen.getByTestId("markdown-properties")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.getByText(/优先级: 高/)).toBeInTheDocument();
    expect(screen.getByText(/截止日期: 2026-09-12/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /正文标题/ })).toBeInTheDocument();
    expect(screen.queryByText("status: done")).not.toBeInTheDocument();
  });
});
