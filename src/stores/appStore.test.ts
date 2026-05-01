import { describe, expect, it, beforeEach } from "vitest";
import { useAppStore } from "./appStore";

describe("appStore", () => {
  beforeEach(() => {
    useAppStore.setState({
      currentPage: "workspace",
      paletteOpen: false,
      selectedItemId: null,
      theme: "system",
    });
  });

  it("persists page navigation", () => {
    useAppStore.getState().navigate("library");

    expect(useAppStore.getState().currentPage).toBe("library");
    expect(localStorage.getItem("quantanote-current-page")).toBe("library");
  });

  it("persists theme and applies it to the document", () => {
    useAppStore.getState().setTheme("dark");

    expect(useAppStore.getState().theme).toBe("dark");
    expect(localStorage.getItem("quantanote-theme")).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("opens and closes the command palette", () => {
    useAppStore.getState().openPalette();
    expect(useAppStore.getState().paletteOpen).toBe(true);

    useAppStore.getState().closePalette();
    expect(useAppStore.getState().paletteOpen).toBe(false);
  });
});
