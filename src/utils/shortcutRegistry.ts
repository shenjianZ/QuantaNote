export type ShortcutScope = "global" | "workspace" | "editor";

export type ShortcutId =
    | "global.openPalette"
    | "global.newNote"
    | "global.openSettings"
    | "workspace.save"
    | "editor.save"
    | "editor.find"
    | "editor.replace";

export type ShortcutBindings = Record<ShortcutId, string>;

export interface ShortcutDefinition {
    id: ShortcutId;
    scope: ShortcutScope;
    defaultShortcut: string;
    labelKey: string;
    descriptionKey: string;
}

export const SHORTCUT_DEFINITIONS: readonly ShortcutDefinition[] = [
    {
        id: "global.openPalette",
        scope: "global",
        defaultShortcut: "Mod+K",
        labelKey: "settings:shortcuts.commands.openPalette",
        descriptionKey: "settings:shortcuts.commands.openPaletteDesc",
    },
    {
        id: "global.newNote",
        scope: "global",
        defaultShortcut: "Mod+N",
        labelKey: "settings:shortcuts.commands.newNote",
        descriptionKey: "settings:shortcuts.commands.newNoteDesc",
    },
    {
        id: "global.openSettings",
        scope: "global",
        defaultShortcut: "Mod+,",
        labelKey: "settings:shortcuts.commands.openSettings",
        descriptionKey: "settings:shortcuts.commands.openSettingsDesc",
    },
    {
        id: "workspace.save",
        scope: "workspace",
        defaultShortcut: "Mod+Enter",
        labelKey: "settings:shortcuts.commands.workspaceSave",
        descriptionKey: "settings:shortcuts.commands.workspaceSaveDesc",
    },
    {
        id: "editor.save",
        scope: "editor",
        defaultShortcut: "Mod+S",
        labelKey: "settings:shortcuts.commands.editorSave",
        descriptionKey: "settings:shortcuts.commands.editorSaveDesc",
    },
    {
        id: "editor.find",
        scope: "editor",
        defaultShortcut: "Mod+F",
        labelKey: "settings:shortcuts.commands.editorFind",
        descriptionKey: "settings:shortcuts.commands.editorFindDesc",
    },
    {
        id: "editor.replace",
        scope: "editor",
        defaultShortcut: "Mod+H",
        labelKey: "settings:shortcuts.commands.editorReplace",
        descriptionKey: "settings:shortcuts.commands.editorReplaceDesc",
    },
];

export const DEFAULT_SHORTCUTS: ShortcutBindings = Object.fromEntries(
    SHORTCUT_DEFINITIONS.map((definition) => [definition.id, definition.defaultShortcut]),
) as ShortcutBindings;

const MODIFIER_ALIASES: Record<string, "Mod" | "Alt" | "Shift"> = {
    cmd: "Mod",
    command: "Mod",
    control: "Mod",
    ctrl: "Mod",
    meta: "Mod",
    mod: "Mod",
    option: "Alt",
    alt: "Alt",
    shift: "Shift",
};

const KEY_ALIASES: Record<string, string> = {
    esc: "Escape",
    escape: "Escape",
    return: "Enter",
    spacebar: "Space",
    " ": "Space",
};

function normalizeKey(key: string) {
    const trimmed = key.trim();
    if (!trimmed) return "";
    const alias = KEY_ALIASES[trimmed.toLowerCase()];
    if (alias) return alias;
    if (trimmed.length === 1 && /[a-z]/i.test(trimmed)) return trimmed.toUpperCase();
    if (/^f\d{1,2}$/i.test(trimmed)) return trimmed.toUpperCase();
    return trimmed;
}

/** 将用户输入或配置中的快捷键归一化为跨平台的 Mod+... 形式。 */
export function normalizeShortcut(shortcut: string | null | undefined) {
    if (!shortcut) return "";

    const modifiers = new Set<"Mod" | "Alt" | "Shift">();
    let key = "";
    shortcut.split("+").forEach((part) => {
        const token = part.trim();
        const modifier = MODIFIER_ALIASES[token.toLowerCase()];
        if (modifier) {
            modifiers.add(modifier);
        } else if (!key) {
            key = normalizeKey(token);
        }
    });

    if (!key) return "";
    return [
        modifiers.has("Mod") ? "Mod" : "",
        modifiers.has("Alt") ? "Alt" : "",
        modifiers.has("Shift") ? "Shift" : "",
        key,
    ].filter(Boolean).join("+");
}

export function normalizeShortcutBindings(
    bindings?: Partial<Record<ShortcutId, string>> | null,
): ShortcutBindings {
    const normalized = { ...DEFAULT_SHORTCUTS };
    SHORTCUT_DEFINITIONS.forEach((definition) => {
        if (!bindings || !Object.prototype.hasOwnProperty.call(bindings, definition.id)) return;
        const rawValue = bindings[definition.id];
        normalized[definition.id] = typeof rawValue === "string"
            ? normalizeShortcut(rawValue)
            : definition.defaultShortcut;
    });
    return normalized;
}

export function eventToShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">) {
    const key = normalizeKey(event.key);
    if (!key || ["Control", "Meta", "Alt", "Shift"].includes(key)) return "";

    const modifiers = [
        event.ctrlKey || event.metaKey ? "Mod" : "",
        event.altKey ? "Alt" : "",
        event.shiftKey ? "Shift" : "",
    ].filter(Boolean);
    if (modifiers.length === 0) return "";
    return [...modifiers, key].join("+");
}

export function shortcutMatches(
    event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">,
    shortcut: string | null | undefined,
) {
    const actual = eventToShortcut(event);
    return Boolean(actual) && actual === normalizeShortcut(shortcut);
}

export function findShortcutConflicts(bindings: Partial<Record<string, string>>) {
    const byShortcut = new Map<string, string[]>();
    Object.entries(bindings).forEach(([id, shortcut]) => {
        const normalized = normalizeShortcut(shortcut);
        if (!normalized) return;
        const ids = byShortcut.get(normalized) ?? [];
        ids.push(id);
        byShortcut.set(normalized, ids);
    });
    return new Map([...byShortcut].filter(([, ids]) => ids.length > 1));
}

export function getShortcutLabel(shortcut: string | null | undefined) {
    const normalized = normalizeShortcut(shortcut);
    if (!normalized) return "—";
    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
    return normalized.replace(/^Mod/, isMac ? "⌘" : "Ctrl");
}
