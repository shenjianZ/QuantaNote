import { describe, expect, it } from "vitest";
import { getSelectedText, shouldPreventGlobalShortcut } from "./keyboardShortcuts";

describe("getSelectedText", () => {
    it("reads text selected in an input", () => {
        const input = document.createElement("input");
        input.value = "选择的文本";
        document.body.appendChild(input);
        input.setSelectionRange(0, 5);

        expect(getSelectedText(input)).toBe("选择的文本");

        input.remove();
    });
});

describe("shouldPreventGlobalShortcut", () => {
    it("always allows native copy and cut shortcuts", () => {
        expect(shouldPreventGlobalShortcut("c", false)).toBe(false);
        expect(shouldPreventGlobalShortcut("x", false)).toBe(false);
        expect(shouldPreventGlobalShortcut("C", false)).toBe(false);
    });

    it("keeps editor shortcuts available inside editable elements", () => {
        expect(shouldPreventGlobalShortcut("a", true)).toBe(false);
        expect(shouldPreventGlobalShortcut("z", true)).toBe(false);
        expect(shouldPreventGlobalShortcut("v", true)).toBe(false);
    });

    it("blocks browser shortcuts outside editable elements", () => {
        expect(shouldPreventGlobalShortcut("a", false)).toBe(true);
        expect(shouldPreventGlobalShortcut("v", false)).toBe(true);
        expect(shouldPreventGlobalShortcut("p", false)).toBe(true);
    });
});
