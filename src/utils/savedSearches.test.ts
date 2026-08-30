import { describe, expect, it } from "vitest";
import { DEFAULT_SMART_COLLECTIONS, normalizeSavedSearches } from "./savedSearches";

describe("saved searches", () => {
  it("normalizes persisted values and drops invalid or duplicate entries", () => {
    const searches = normalizeSavedSearches([
      {
        id: "one",
        name: "  本周待处理  ",
        type: "task",
        timeRange: "7d",
        searchScopes: ["content", "invalid", "content"],
        untagged: true,
      },
      { id: "one", name: "重复" },
      { id: "missing-name" },
      null,
    ]);

    expect(searches).toEqual([
      expect.objectContaining({
        id: "one",
        name: "本周待处理",
        type: "task",
        timeRange: "7d",
        searchScopes: ["content"],
        untagged: true,
        hasAttachments: false,
      }),
    ]);
  });

  it("provides the four built-in smart collections", () => {
    expect(DEFAULT_SMART_COLLECTIONS.map((collection) => collection.id)).toEqual([
      "recently-modified",
      "unclassified",
      "favorites",
      "incomplete",
    ]);
    expect(DEFAULT_SMART_COLLECTIONS.find((collection) => collection.id === "unclassified")?.untagged).toBe(true);
    expect(DEFAULT_SMART_COLLECTIONS.find((collection) => collection.id === "incomplete")?.status).toBe("incomplete");
  });
});
