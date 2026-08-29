import { describe, expect, it, vi } from "vitest";
import {
  buildAttachmentMarkdown,
  getAttachmentIdFromSource,
  getAttachmentReference,
  normalizeAttachmentReferences,
  removeAttachmentReferences,
  resolveAttachmentReferences,
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

  it("removes all image and link nodes for a deleted attachment", () => {
    const source = "前文\n\n![截图](attachment://att-1)\n\n[原文件](attachment://att-1)\n\n后文";
    expect(removeAttachmentReferences(source, "att-1")).toBe("前文\n\n后文");
  });
});
