import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { setup } from "../../test/test-utils";
import { FloatingBall } from "./FloatingBall";

const mocks = vi.hoisted(() => {
    let movedHandler:
        | ((event: { payload: { x: number; y: number } }) => void)
        | undefined;
    let settingsChangedHandler:
        | ((event: { payload: { key: string; value: unknown } }) => void)
        | undefined;

    return {
        emit: vi.fn(() => Promise.resolve()),
        listen: vi.fn((event: string, handler: typeof settingsChangedHandler) => {
            if (event === "quantanote-settings-changed") {
                settingsChangedHandler = handler;
            }
            return Promise.resolve(() => {});
        }),
        loadAllSettings: vi.fn(() => Promise.resolve({
            "quantanote-settings": JSON.stringify({ accentColor: "#2563eb" }),
        })),
        startDragging: vi.fn(() => Promise.resolve()),
        setSize: vi.fn(() => Promise.resolve()),
        setPosition: vi.fn(() => Promise.resolve()),
        setBackgroundColor: vi.fn(() => Promise.resolve()),
        onMoved: vi.fn((handler: typeof movedHandler) => {
            movedHandler = handler;
            return Promise.resolve(() => {});
        }),
        getMovedHandler: () => movedHandler,
        resetMovedHandler: () => {
            movedHandler = undefined;
        },
        getSettingsChangedHandler: () => settingsChangedHandler,
        resetSettingsChangedHandler: () => {
            settingsChangedHandler = undefined;
        },
    };
});

vi.mock("@tauri-apps/api/event", () => ({
    emit: mocks.emit,
    listen: mocks.listen,
}));

vi.mock("../../services/tauriCommands", () => ({
    loadAllSettings: mocks.loadAllSettings,
}));

vi.mock("@tauri-apps/api/window", () => ({
    getCurrentWindow: () => ({
        setBackgroundColor: mocks.setBackgroundColor,
        onMoved: mocks.onMoved,
        outerPosition: () => Promise.resolve({
            x: 100,
            y: 100,
            toLogical: () => ({ x: 100, y: 100 }),
        }),
        scaleFactor: () => Promise.resolve(1),
        innerSize: () => Promise.resolve({
            toLogical: () => ({ width: 64, height: 64 }),
        }),
        setSize: mocks.setSize,
        setPosition: mocks.setPosition,
        startDragging: mocks.startDragging,
        close: vi.fn(() => Promise.resolve()),
    }),
}));

vi.mock("@tauri-apps/api/dpi", () => ({
    LogicalSize: class LogicalSize {
        constructor(public width: number, public height: number) {}
    },
    LogicalPosition: class LogicalPosition {
        constructor(public x: number, public y: number) {}
    },
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
    WebviewWindow: class WebviewWindow {
        static getByLabel = vi.fn(() => Promise.resolve(null));

        setFocus = vi.fn(() => Promise.resolve());
        show = vi.fn(() => Promise.resolve());
    },
}));

describe("FloatingBall", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mocks.resetMovedHandler();
        mocks.resetSettingsChangedHandler();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("does not persist programmatic window moves", async () => {
        setup(<FloatingBall />);

        await act(async () => {});
        expect(mocks.getMovedHandler()).toBeTruthy();

        act(() => {
            mocks.getMovedHandler()?.({ payload: { x: 320, y: 240 } });
            vi.advanceTimersByTime(250);
        });

        expect(mocks.emit).not.toHaveBeenCalledWith(
            "quantanote-floating-ball-position-changed",
            expect.anything(),
        );
    });

    it("persists position after user drag moves the window", async () => {
        setup(<FloatingBall />);
        const button = screen.getByRole("button", { name: "Floating Ball Menu" });

        fireEvent.mouseDown(button, { screenX: 10, screenY: 10 });
        fireEvent.mouseMove(button, { screenX: 32, screenY: 36 });

        expect(mocks.startDragging).toHaveBeenCalled();

        act(() => {
            mocks.getMovedHandler()?.({ payload: { x: 321.4, y: 240.6 } });
            vi.advanceTimersByTime(250);
        });

        expect(mocks.emit).toHaveBeenCalledWith(
            "quantanote-floating-ball-position-changed",
            { x: 321, y: 241 },
        );
    });

    it("applies saved accent color and reacts to accent updates", async () => {
        setup(<FloatingBall />);

        await act(async () => {});

        expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#2563eb");

        act(() => {
            mocks.getSettingsChangedHandler()?.({
                payload: { key: "accentColor", value: "#d97706" },
            });
        });

        expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#d97706");
        expect(document.documentElement.style.getPropertyValue("--accent-rgb")).toBe("217, 119, 6");
    });
});
