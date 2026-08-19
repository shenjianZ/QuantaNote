import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { setup } from "../../test/test-utils";
import { useSettingsStore } from "../../stores/settingsStore";
import { ContentWidthControl } from "./ContentWidthControl";

describe("ContentWidthControl", () => {
  beforeEach(() => {
    useSettingsStore.setState((state) => ({
      settings: {
        ...state.settings,
        contentWidthProgress: 0,
      },
    }));
  });

  it("supports all three presets", async () => {
    const { user } = setup(<ContentWidthControl testId="content-width" />);

    await user.click(screen.getByTestId("content-width-preset-comfortable"));
    expect(useSettingsStore.getState().settings.contentWidthProgress).toBe(25);

    await user.click(screen.getByTestId("content-width-preset-immersive"));
    expect(useSettingsStore.getState().settings.contentWidthProgress).toBe(50);

    await user.click(screen.getByTestId("content-width-preset-default"));
    expect(useSettingsStore.getState().settings.contentWidthProgress).toBe(0);
  });

  it("uses underline highlighting without a filled preset background", () => {
    setup(<ContentWidthControl testId="content-width" />);

    expect(screen.getByRole("group")).not.toHaveClass("bg-[var(--field)]");
    expect(screen.getByTestId("content-width-preset-default")).toHaveClass("border-b-2", "border-[var(--accent)]");
    expect(screen.getByTestId("content-width-preset-comfortable")).toHaveClass("border-transparent");
  });

  it("accepts every integer value from the range slider", () => {
    setup(<ContentWidthControl testId="content-width" />);
    const slider = screen.getByTestId("content-width-slider");
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "100");
    expect(slider).toHaveAttribute("step", "1");
    fireEvent.change(slider, {
      target: { value: "74" },
    });

    expect(useSettingsStore.getState().settings.contentWidthProgress).toBe(37);
  });

  it("shows the internal maximum width as 100% in the control", () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, contentWidthProgress: 50 },
    }));
    setup(<ContentWidthControl testId="content-width" />);

    expect(screen.getByText("100%")).toBeInTheDocument();
    expect((screen.getByTestId("content-width-slider") as HTMLInputElement).value).toBe("100");
  });

  it("renders a compact popover trigger", () => {
    setup(<ContentWidthControl compact testId="content-width" />);
    const trigger = screen.getByRole("button", { name: "调整内容宽度" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveClass("bg-[var(--field)]");
  });

  it("keeps the compact panel fixed while the shared width changes", async () => {
    const { user } = setup(<ContentWidthControl compact testId="content-width" />);
    await user.click(screen.getByRole("button", { name: "调整内容宽度" }));

    const panel = screen.getByTestId("content-width-panel");
    const top = panel.style.top;
    expect(panel).toHaveStyle({ position: "fixed" });

    await act(async () => {
      await useSettingsStore.getState().updateSetting("contentWidthProgress", 37);
    });

    expect(panel.style.top).toBe(top);
    expect((screen.getByTestId("content-width-slider") as HTMLInputElement).value).toBe("74");
  });
});
