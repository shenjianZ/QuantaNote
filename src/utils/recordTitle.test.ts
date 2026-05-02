import { describe, expect, it } from "vitest";
import { deriveRecordTitle } from "./recordTitle";

describe("deriveRecordTitle", () => {
    it("uses the first h1 heading without truncation", () => {
        expect(
            deriveRecordTitle("## 二级标题\n# 这是一个很长很长的一级标题不应该被截断\n正文"),
        ).toBe("这是一个很长很长的一级标题不应该被截断");
    });

    it("falls back to h2 when h1 is missing", () => {
        expect(deriveRecordTitle("普通内容\n## 会议纪要\n### 小节")).toBe("会议纪要");
    });

    it("falls back through h3 to h6 by heading level", () => {
        expect(deriveRecordTitle("###### 六级\n#### 四级\n正文")).toBe("四级");
    });

    it("uses the first 10 content characters when there are no headings", () => {
        expect(deriveRecordTitle("这是没有标题的正文内容")).toBe("这是没有标题的正文内");
    });
});
