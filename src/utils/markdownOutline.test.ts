import { describe, expect, it } from "vitest";
import { parseMarkdownOutline } from "./markdownOutline";

describe("parseMarkdownOutline", () => {
  it("extracts heading levels and preserves duplicate order", () => {
    expect(parseMarkdownOutline("# 项目\n## 相同\n### 相同\n## 相同")).toEqual([
      { index: 0, level: 1, text: "项目" },
      { index: 1, level: 2, text: "相同" },
      { index: 2, level: 3, text: "相同" },
      { index: 3, level: 2, text: "相同" },
    ]);
  });

  it("ignores headings inside fenced code and cleans markdown decoration", () => {
    expect(parseMarkdownOutline("```md\n# 代码标题\n```\n# **正文标题** #\n")).toEqual([
      { index: 0, level: 1, text: "正文标题" },
    ]);
  });

  it("supports setext headings and skips empty headings", () => {
    expect(parseMarkdownOutline("标题一\n===\n\n##\n\n标题二\n---")).toEqual([
      { index: 0, level: 1, text: "标题一" },
      { index: 1, level: 2, text: "标题二" },
    ]);
  });
});
