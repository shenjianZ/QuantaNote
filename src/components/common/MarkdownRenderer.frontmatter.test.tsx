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

  it("按语义为状态、优先级与逾期截止日期着色", () => {
    setup(
      <MarkdownRenderer
        content={`---
status: done
priority: high
due: 2020-01-01
---
# 正文`}
      />,
    );

    expect(screen.getByText("已完成").className).toContain("var(--ok)");
    expect(screen.getByText(/优先级: 高/).className).toContain("var(--danger)");
    const dueBadge = screen.getByText(/截止日期: 2020-01-01/);
    expect(dueBadge.className).toContain("var(--danger)");
    expect(dueBadge.textContent).toContain("已逾期");
  });

  it("在属性徽章区展示标签和描述", () => {
    setup(
      <MarkdownRenderer
        content="# 正文标题"
        tags={[{ name: "市井拾光", color: "blue" }, { name: "测试", color: "green" }]}
        summary="这是一段笔记描述。"
      />,
    );

    expect(screen.getByTestId("markdown-properties-tags")).toBeInTheDocument();
    expect(screen.getByText("#市井拾光")).toBeInTheDocument();
    expect(screen.getByText("#测试")).toBeInTheDocument();
    expect(screen.getByTestId("markdown-properties-summary")).toHaveTextContent("描述:这是一段笔记描述。");
    expect(screen.getByText("#市井拾光").className).toContain("tag-blue");
    expect(screen.getByText("#测试").className).toContain("tag-green");
    // jsdom 没有布局尺寸，短文本不会出现展开按钮
    expect(screen.queryByTestId("markdown-properties-summary-toggle")).not.toBeInTheDocument();
  });

  it("仅有标签或描述时也渲染属性区且不显示空内容占位", () => {
    const { rerender } = setup(<MarkdownRenderer content="" tags={[{ name: "只有标签", color: "blue" }]} />);
    expect(screen.getByTestId("markdown-properties-tags")).toBeInTheDocument();
    expect(screen.queryByText("暂无内容")).not.toBeInTheDocument();

    rerender(<MarkdownRenderer content="" summary="只有描述" />);
    expect(screen.getByTestId("markdown-properties-summary")).toBeInTheDocument();
    expect(screen.queryByText("暂无内容")).not.toBeInTheDocument();

    rerender(<MarkdownRenderer content="" />);
    expect(screen.getByText("暂无内容")).toBeInTheDocument();
  });
});
