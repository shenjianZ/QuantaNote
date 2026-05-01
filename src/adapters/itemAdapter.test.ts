import { describe, expect, it, vi, beforeEach } from "vitest";
import { adaptItem } from "./itemAdapter";
import type { ItemDto } from "../stores/itemStore";
import { FileText, Link, Folder, Image, Braces, BookOpen } from "lucide-react";

const baseDto: ItemDto = {
  id: "item-1",
  title: "Test",
  item_type: "note",
  content: "Some content here",
  summary: "A summary",
  pinned: false,
  favorite: false,
  encrypted: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("adaptItem", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("maps note type to FileText icon", () => {
    const result = adaptItem(baseDto);
    expect(result.icon).toBe(FileText);
    expect(result.type).toBe("note");
  });

  it("uses summary or content fallback", () => {
    const withSummary = adaptItem(baseDto);
    expect(withSummary.summary).toBe("A summary");

    const noSummary = adaptItem({ ...baseDto, summary: "" });
    expect(noSummary.summary).toBe("Some content here".slice(0, 60));

    const empty = adaptItem({ ...baseDto, summary: "", content: "" });
    expect(empty.summary).toBe("");
  });

  it("formats relative time", () => {
    const now = new Date();
    const result = adaptItem({ ...baseDto, updated_at: now.toISOString() });
    expect(result.time).toBe("刚刚");

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const hourResult = adaptItem({ ...baseDto, updated_at: oneHourAgo.toISOString() });
    expect(hourResult.time).toContain("小时前");
  });

  it("maps pinned and favorite flags", () => {
    const result = adaptItem({ ...baseDto, pinned: true, favorite: true });
    expect(result.pinned).toBe(true);
    expect(result.favorite).toBe(true);
  });

  it("maps all item types to correct accent", () => {
    expect(adaptItem({ ...baseDto, item_type: "note" }).accent).toBe("cyan");
    expect(adaptItem({ ...baseDto, item_type: "link" }).accent).toBe("blue");
    expect(adaptItem({ ...baseDto, item_type: "file" }).accent).toBe("yellow");
    expect(adaptItem({ ...baseDto, item_type: "image" }).accent).toBe("purple");
    expect(adaptItem({ ...baseDto, item_type: "code" }).accent).toBe("cyan");
    expect(adaptItem({ ...baseDto, item_type: "task" }).accent).toBe("green");
  });
});
