import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { setup } from "../../test/test-utils";
import { MarkdownRenderer } from "./MarkdownRenderer";
import Vditor from "vditor";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("vditor", () => ({
  default: {
    mermaidRender: vi.fn(),
    flowchartRender: vi.fn(),
  },
}));

describe("MarkdownRenderer", () => {
  it("renders reading-oriented headings, task lists, tables and callouts", () => {
    setup(
      <MarkdownRenderer
        theme="light"
        lang="zh_CN"
        content={`# 项目标题

## 今日计划

- [x] 完成预览设计
- [ ] 补充测试

> [!TIP]
> 这是一个阅读提示。

| 项目 | 状态 |
| --- | --- |
| 预览 | 完成 |`}
      />,
    );

    expect(screen.getByTestId("markdown-preview")).toHaveAttribute("data-theme", "light");
    expect(screen.getByRole("heading", { name: /项目标题/ })).toHaveAttribute("id", "项目标题");
    expect(screen.getByText("完成预览设计")).toBeInTheDocument();
    expect(document.querySelector(".markdown-task-box.is-checked")).toBeInTheDocument();
    expect(document.querySelector(".markdown-table-wrap")).toBeInTheDocument();
    expect(document.querySelector(".markdown-callout--tip")).toBeInTheDocument();
    expect(screen.getByText("技巧")).toBeInTheDocument();
  });

  it("renders highlighted code with a copy action", () => {
    setup(
      <MarkdownRenderer
        lang="zh_CN"
        content={`\`\`\`typescript
const answer: number = 42;
\`\`\``}
      />,
    );

    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制代码" })).toBeInTheDocument();
    expect(document.querySelector(".markdown-code-block .hljs-keyword")).toBeInTheDocument();
  });

  it("renders math and strips unsafe HTML", () => {
    setup(
      <MarkdownRenderer
        content={`公式：$x^2 + y^2 = z^2$

<script>alert('unsafe')</script>`}
      />,
    );

    expect(document.querySelector(".katex")).toBeInTheDocument();
    expect(document.querySelector("script")).not.toBeInTheDocument();
    expect(screen.queryByText("unsafe")).not.toBeInTheDocument();
  });

  it("keeps native disclosure, footnotes, media and preformatted HTML readable", () => {
    setup(
      <MarkdownRenderer
        content={`说明[^1]

[^1]: 这是脚注内容。

<details>
<summary>展开补充说明</summary>
<p>补充内容</p>
</details>

<audio src="/sample.mp3"></audio>

<pre>preserved text</pre>`}
      />,
    );

    expect(document.querySelector("[data-footnotes]")).toBeInTheDocument();
    expect(screen.getByText("展开补充说明")).toBeInTheDocument();
    expect(document.querySelector(".markdown-audio-frame audio")).toHaveAttribute("controls");
    expect(document.querySelector("pre")?.textContent).toContain("preserved text");
  });

  it("renders definition lists and delegates diagram blocks to Vditor", () => {
    setup(
      <MarkdownRenderer
        theme="light"
        content={`Markdown
: 一种轻量级标记语言。

QuantaNote
: 一个支持 **Markdown** 的笔记应用。
: 第二条定义。

\`\`\`mermaid
graph TD
  A[开始] --> B[结束]
\`\`\`

\`\`\`flowchart
st=>start: 开始
e=>end: 结束
st->e
\`\`\``}
      />,
    );

    expect(document.querySelector("dl")).toBeInTheDocument();
    expect(document.querySelectorAll("dl dt")).toHaveLength(2);
    expect(document.querySelectorAll("dl dd")).toHaveLength(3);
    expect(document.querySelector("dl dd strong")).toHaveTextContent("Markdown");
    expect(document.querySelector(".markdown-diagram-block[data-language='mermaid'] code")).toHaveTextContent("graph TD");
    expect(document.querySelector(".markdown-diagram-block[data-language='flowchart'] code")).toHaveTextContent("st=>start: 开始");
    expect(Vditor.mermaidRender).toHaveBeenCalledWith(expect.any(HTMLElement), "/vditor", "light");
    expect(Vditor.flowchartRender).toHaveBeenCalledWith(expect.any(HTMLElement), "/vditor");
  });

  it("does not rerender diagrams when the parent rerenders with the same props", () => {
    const view = setup(
      <div>
        <MarkdownRenderer
          theme="dark"
          content={`\`\`\`mermaid
graph TD
  A[开始] --> B[结束]
\`\`\``}
        />
      </div>,
    );

    expect(Vditor.mermaidRender).toHaveBeenCalledTimes(1);

    view.rerender(
      <div data-render="after-scroll">
        <MarkdownRenderer
          theme="dark"
          content={`\`\`\`mermaid
graph TD
  A[开始] --> B[结束]
\`\`\``}
        />
      </div>,
    );

    expect(Vditor.mermaidRender).toHaveBeenCalledTimes(1);
  });

  it("loads preview images eagerly instead of showing lazy placeholders", () => {
    setup(
      <MarkdownRenderer content="![预览图片](https://example.com/image.png)" />,
    );

    expect(document.querySelector(".markdown-image-frame img")).toHaveAttribute("loading", "eager");
  });
});
