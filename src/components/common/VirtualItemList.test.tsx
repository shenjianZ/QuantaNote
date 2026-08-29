import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VirtualItemList } from "./VirtualItemList";

describe("VirtualItemList", () => {
  it("only mounts the visible window for a large collection", () => {
    const items = Array.from({ length: 100 }, (_, index) => ({ id: `item-${index}` }));

    render(
      <VirtualItemList
        items={items}
        itemHeight={100}
        itemKey={(item) => item.id}
        renderItem={(item) => <button type="button">{item.id}</button>}
      />,
    );

    expect(screen.getAllByRole("button").length).toBeLessThan(items.length);
    expect(screen.getByText("item-0")).toBeInTheDocument();
  });

  it("requests the next page near the end of the scroll container", () => {
    const onLoadMore = vi.fn();
    const items = Array.from({ length: 20 }, (_, index) => ({ id: `item-${index}` }));

    render(
      <VirtualItemList
        items={items}
        itemHeight={100}
        itemKey={(item) => item.id}
        renderItem={(item) => <button type="button">{item.id}</button>}
        hasMore
        onLoadMore={onLoadMore}
      />,
    );

    const container = screen.getByTestId("virtual-item-list");
    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 600 },
      scrollHeight: { configurable: true, value: 2000 },
      scrollTop: { configurable: true, writable: true, value: 1450 },
    });
    fireEvent.scroll(container);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
