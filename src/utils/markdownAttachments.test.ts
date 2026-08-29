import { describe, expect, it, vi } from "vitest";
import {
  buildAttachmentMarkdown,
  getAttachmentImageOptions,
  getAttachmentIdFromSource,
  getAttachmentReference,
  getAttachmentImageStyle,
  normalizeAttachmentReferences,
  removeAttachmentReferences,
  resolveAttachmentReferences,
  withAttachmentImageOptions,
} from "./markdownAttachments";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}));

const attachment = {
  id: "att-1",
  filename: "截图 [最终].png",
  file_path: "C:/QuantaNote/attachments/att-1.png",
  mime_type: "image/png",
};

describe("markdownAttachments", () => {
  it("builds stable references and decodes their IDs", () => {
    const reference = getAttachmentReference(attachment.id);
    expect(reference).toBe("attachment://att-1");
    expect(getAttachmentIdFromSource(`${reference}?size=large`)).toBe("att-1");
    expect(buildAttachmentMarkdown(attachment, true)).toContain("![截图 \\[最终\\].png](attachment://att-1)");
  });

  it("resolves stable references for rendering and normalizes them back for saving", () => {
    const source = "![截图](attachment://att-1)\n\n[原文件](attachment://att-1)";
    const resolved = resolveAttachmentReferences(source, [attachment]);
    expect(resolved).toContain("asset://C:/QuantaNote/attachments/att-1.png");
    expect(normalizeAttachmentReferences(resolved, [attachment])).toBe(source);
  });

  it("round-trips image presentation metadata without exposing the file path", () => {
    const source = withAttachmentImageOptions(getAttachmentReference(attachment.id), {
      width: 640,
      align: "center",
    });
    expect(source).toBe("attachment://att-1#qn-width=640&qn-align=center");
    expect(getAttachmentImageOptions(source)).toEqual({ width: 640, align: "center" });
    expect(resolveAttachmentReferences(`![截图](${source})`, [attachment])).toContain(
      "asset://C:/QuantaNote/attachments/att-1.png#qn-width=640&qn-align=center",
    );
    expect(normalizeAttachmentReferences(
      `![截图](asset://C:/QuantaNote/attachments/att-1.png#qn-width=640&qn-align=center)`,
      [attachment],
    )).toBe(`![截图](${source})`);
    expect(getAttachmentImageStyle({ width: 640, align: "center" })).toMatchObject({
      width: "640px",
      maxWidth: "100%",
      display: "block",
      marginLeft: "auto",
      marginRight: "auto",
    });
  });

  it("removes all image and link nodes for a deleted attachment", () => {
    const source = "前文\n\n![截图](attachment://att-1)\n\n[原文件](attachment://att-1)\n\n后文";
    expect(removeAttachmentReferences(source, "att-1")).toBe("前文\n\n后文");
  });
});
