import { describe, expect, it } from "vitest";
import {
    eventToShortcut,
    findShortcutConflicts,
    normalizeShortcut,
    normalizeShortcutBindings,
    shortcutMatches,
} from "./shortcutRegistry";

describe("shortcutRegistry", () => {
    it("normalizes platform aliases and special keys", () => {
        expect(normalizeShortcut("Ctrl+Shift+s")).toBe("Mod+Shift+S");
        expect(normalizeShortcut("Command+," )).toBe("Mod+," );
        expect(normalizeShortcut("Control+Return")).toBe("Mod+Enter");
    });

    it("converts keyboard events to the cross-platform representation", () => {
        const event = { key: "s", ctrlKey: true, metaKey: false, altKey: false, shiftKey: true };
        expect(eventToShortcut(event)).toBe("Mod+Shift+S");
        expect(shortcutMatches(event, "Mod+Shift+S")).toBe(true);
        expect(eventToShortcut({ ...event, ctrlKey: false, shiftKey: false })).toBe("");
    });

    it("reports duplicate bindings", () => {
        const conflicts = findShortcutConflicts({
            "global.openPalette": "Mod+K",
            "global.newNote": "Ctrl+K",
            "editor.save": "Mod+S",
        });

        expect(conflicts.get("Mod+K")).toEqual(["global.openPalette", "global.newNote"]);
        expect(conflicts.has("Mod+S")).toBe(false);
    });

    it("preserves an explicitly cleared shortcut while filling missing defaults", () => {
        const bindings = normalizeShortcutBindings({ "global.openPalette": "" });
        expect(bindings["global.openPalette"]).toBe("");
        expect(bindings["global.newNote"]).toBe("Mod+N");
    });
});
