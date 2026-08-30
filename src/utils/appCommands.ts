export type AppCommandId =
    | "save-note"
    | "insert-image"
    | "manage-attachments"
    | "restore-version"
    | "copy-note";

export const APP_COMMAND_EVENT = "quantanote-command";

export function dispatchAppCommand(id: AppCommandId) {
    window.dispatchEvent(new CustomEvent(APP_COMMAND_EVENT, { detail: { id } }));
}

export function getAppCommandId(event: Event): AppCommandId | null {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id;
    if (
        id === "save-note"
        || id === "insert-image"
        || id === "manage-attachments"
        || id === "restore-version"
        || id === "copy-note"
    ) {
        return id;
    }
    return null;
}
