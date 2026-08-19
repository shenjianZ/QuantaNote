import { describe, expect, it, vi } from "vitest";
import { screen, setup, waitFor } from "../../test/test-utils";
import { DocumentOutline } from "./DocumentOutline";

const headings = [
  { index: 0, level: 1 as const, text: "项目标题" },
  { index: 1, level: 2 as const, text: "计划" },
];

describe("DocumentOutline", () => {
  it("renders nested headings and selects an item", async () => {
    const onSelect = vi.fn();
    const { user } = setup(
      <DocumentOutline headings={headings} visible={true} onToggle={vi.fn()} onSelect={onSelect} />,
    );

    expect(screen.getByRole("heading", { name: "目录" })).toBeInTheDocument();
    expect(screen.getByTestId("document-outline-item-1")).toHaveTextContent("计划");
    await user.click(screen.getByTestId("document-outline-item-1"));

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("keeps the toggle available while hidden", async () => {
    const onToggle = vi.fn();
    const { user } = setup(
      <DocumentOutline headings={headings} visible={false} onToggle={onToggle} onSelect={vi.fn()} />,
    );

    expect(screen.queryByTestId("document-outline-item-0")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("document-outline-toggle"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("scrolls the active item inside the outline list", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const { rerender } = setup(
      <DocumentOutline headings={headings} visible={true} activeIndex={0} onToggle={vi.fn()} onSelect={vi.fn()} />,
    );

    rerender(
      <DocumentOutline headings={headings} visible={true} activeIndex={1} onToggle={vi.fn()} onSelect={vi.fn()} />,
    );

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "auto",
        block: "nearest",
        inline: "nearest",
      });
    });
  });
});
