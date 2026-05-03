import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { Item } from "../types";
import "../i18n";

export * from "@testing-library/react";

export function setup(ui: ReactElement) {
  return {
    user: userEvent.setup(),
    ...render(ui),
  };
}

export function createMockItem(overrides?: Partial<Item>): Item {
  return {
    id: "item-1",
    type: "note",
    title: "Test Note",
    summary: "Test summary",
    tags: [],
    time: "刚刚",
    icon: vi.fn(),
    accent: "cyan",
    pinned: false,
    favorite: false,
    ...overrides,
  };
}
