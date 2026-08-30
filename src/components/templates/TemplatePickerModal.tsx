import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Modal } from "../common/Modal";
import {
    createTemplate,
    deleteTemplate,
    getTemplates,
    updateTemplate,
    type TemplateDto,
} from "../../services/tauriCommands";
import { useToastStore } from "../../stores/toastStore";
import { getBuiltInTemplates } from "../../templates/builtInTemplates";

interface TemplateDraft {
    name: string;
    description: string;
    content: string;
}

interface TemplatePickerModalProps {
    open: boolean;
    onClose: () => void;
    onSelect: (template: TemplateDto | null) => Promise<void>;
}

const EMPTY_DRAFT: TemplateDraft = { name: "", description: "", content: "" };

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function TemplatePickerModal({ open, onClose, onSelect }: TemplatePickerModalProps) {
    const { t } = useTranslation(["templates", "common"]);
    const [view, setView] = useState<"pick" | "manage">("pick");
    const [templates, setTemplates] = useState<TemplateDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectingId, setSelectingId] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<TemplateDto | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [draft, setDraft] = useState<TemplateDraft>(EMPTY_DRAFT);
    const [saving, setSaving] = useState(false);
    const [copyingId, setCopyingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const builtInTemplates = useMemo(() => getBuiltInTemplates(t), [t]);
    const userTemplates = useMemo(
        () => templates.filter((template) => !template.built_in),
        [templates],
    );

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setTemplates(await getTemplates());
        } catch (loadError) {
            setError(t("templates:loadFailed"));
            console.error("Failed to load templates", getErrorMessage(loadError));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (!open) return;
        setView("pick");
        setEditingTemplate(null);
        setFormOpen(false);
        setDraft(EMPTY_DRAFT);
        setDeletingId(null);
        void loadTemplates();
    }, [loadTemplates, open]);

    async function handleSelect(template: TemplateDto | null) {
        const id = template?.id ?? "blank";
        setSelectingId(id);
        setError(null);
        try {
            await onSelect(template);
        } catch (selectError) {
            setError(getErrorMessage(selectError));
        } finally {
            setSelectingId(null);
        }
    }

    function startCreate() {
        setError(null);
        setEditingTemplate(null);
        setFormOpen(true);
        setDraft(EMPTY_DRAFT);
    }

    function startEdit(template: TemplateDto) {
        setError(null);
        setEditingTemplate(template);
        setFormOpen(true);
        setDraft({
            name: template.name,
            description: template.description,
            content: template.content,
        });
    }

    async function handleSave() {
        if (!draft.name.trim()) {
            setError(t("templates:nameRequired"));
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const saved = editingTemplate
                ? await updateTemplate(
                      editingTemplate.id,
                      draft.name,
                      draft.description,
                      draft.content,
                  )
                : await createTemplate(draft.name, draft.description, draft.content);
            setTemplates((current) => {
                const remaining = current.filter((template) => template.id !== saved.id);
                return [saved, ...remaining];
            });
            setEditingTemplate(null);
            setFormOpen(false);
            setDraft(EMPTY_DRAFT);
            useToastStore.getState().addToast("success", t("templates:saved"));
        } catch (saveError) {
            setError(t("templates:saveFailed"));
            console.error("Failed to save template", getErrorMessage(saveError));
        } finally {
            setSaving(false);
        }
    }

    async function handleCopy(template: TemplateDto) {
        setCopyingId(template.id);
        setError(null);
        try {
            const copied = await createTemplate(
                `${template.name} · ${t("templates:copySuffix")}`,
                template.description,
                template.content,
            );
            setTemplates((current) => [copied, ...current]);
            useToastStore.getState().addToast("success", t("templates:saved"));
        } catch (copyError) {
            setError(t("templates:saveFailed"));
            console.error("Failed to copy template", getErrorMessage(copyError));
        } finally {
            setCopyingId(null);
        }
    }

    async function handleDelete(template: TemplateDto) {
        if (deletingId !== template.id) {
            setDeletingId(template.id);
            return;
        }
        setDeletingId(null);
        setError(null);
        try {
            await deleteTemplate(template.id);
            setTemplates((current) => current.filter((item) => item.id !== template.id));
            if (editingTemplate?.id === template.id) {
                setEditingTemplate(null);
                setFormOpen(false);
                setDraft(EMPTY_DRAFT);
            }
            useToastStore.getState().addToast("success", t("templates:deleted"));
        } catch (deleteError) {
            setError(t("templates:deleteFailed"));
            console.error("Failed to delete template", getErrorMessage(deleteError));
        }
    }

    function renderTemplateOption(template: TemplateDto) {
        return (
            <div
                key={template.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--field)] p-4"
                data-testid={`template-option-${template.id}`}
            >
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                        <h4 className="truncate text-sm font-semibold text-[var(--text)]">{template.name}</h4>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{template.description}</p>
                </div>
                <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    data-testid={`template-use-${template.id}`}
                    disabled={selectingId !== null}
                    onClick={() => void handleSelect(template)}
                >
                    {selectingId === template.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t("templates:use")}
                </button>
            </div>
        );
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={view === "pick" ? t("templates:title") : t("templates:manageTitle")}
            maxWidth="max-w-3xl"
        >
            <div data-testid="template-picker-modal" className="space-y-5">
                {error && (
                    <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                        {error}
                    </p>
                )}

                {view === "pick" ? (
                    <>
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-sm leading-relaxed text-[var(--muted)]">{t("templates:selectHint")}</p>
                            <button
                                type="button"
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                                data-testid="template-manage-btn"
                                onClick={() => setView("manage")}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                {t("templates:manage")}
                            </button>
                        </div>

                        <button
                            type="button"
                            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-[var(--accent)] bg-[var(--accent-soft)] p-4 text-left hover:opacity-90 disabled:opacity-50"
                            data-testid="template-blank-btn"
                            disabled={selectingId !== null}
                            onClick={() => void handleSelect(null)}
                        >
                            {selectingId === "blank" ? (
                                <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
                            ) : (
                                <Plus className="h-5 w-5 text-[var(--accent)]" />
                            )}
                            <span>
                                <span className="block text-sm font-semibold text-[var(--text)]">{t("templates:blank")}</span>
                                <span className="mt-0.5 block text-xs text-[var(--muted)]">{t("templates:blankDescription")}</span>
                            </span>
                        </button>

                        {loading ? (
                            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--muted)]">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t("templates:loading")}
                            </div>
                        ) : (
                            <>
                                <section className="space-y-2">
                                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{t("templates:builtIn")}</h3>
                                    <div className="grid gap-2 sm:grid-cols-2">{builtInTemplates.map(renderTemplateOption)}</div>
                                </section>
                                <section className="space-y-2">
                                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{t("templates:user")}</h3>
                                    {userTemplates.length > 0 ? (
                                        <div className="grid gap-2 sm:grid-cols-2">{userTemplates.map(renderTemplateOption)}</div>
                                    ) : (
                                        <p className="rounded-xl border border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)]">{t("templates:emptyUser")}</p>
                                    )}
                                </section>
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-between gap-3">
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)]"
                                data-testid="template-back-btn"
                                onClick={() => setView("pick")}
                            >
                                <ArrowLeft className="h-4 w-4" />
                                {t("templates:backToPicker")}
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                                data-testid="template-create-btn"
                                onClick={startCreate}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                {t("templates:create")}
                            </button>
                        </div>

                        <section className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{t("templates:builtIn")}</h3>
                            <div className="space-y-2">
                                {builtInTemplates.map((template) => (
                                    <div key={template.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3 py-2.5">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-[var(--text)]">{template.name}</p>
                                            <p className="truncate text-xs text-[var(--muted)]">{template.description}</p>
                                        </div>
                                        <button
                                            type="button"
                                            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
                                            data-testid={`template-copy-${template.id}`}
                                            disabled={copyingId !== null}
                                            onClick={() => void handleCopy(template)}
                                        >
                                            {copyingId === template.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                                            {t("templates:copy")}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{t("templates:user")}</h3>
                            {userTemplates.length > 0 ? (
                                <div className="space-y-2">
                                    {userTemplates.map((template) => (
                                        <div key={template.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3 py-2.5">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-[var(--text)]">{template.name}</p>
                                                <p className="truncate text-xs text-[var(--muted)]">{template.description}</p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <button
                                                    type="button"
                                                    className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                                                    aria-label={t("templates:edit")}
                                                    data-testid={`template-edit-${template.id}`}
                                                    onClick={() => startEdit(template)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
                                                    aria-label={t("templates:copy")}
                                                    data-testid={`template-copy-${template.id}`}
                                                    disabled={copyingId !== null}
                                                    onClick={() => void handleCopy(template)}
                                                >
                                                    {copyingId === template.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`grid h-8 w-8 place-items-center rounded-full ${deletingId === template.id ? "bg-rose-500/15 text-rose-300" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-rose-300"}`}
                                                    aria-label={deletingId === template.id ? t("templates:confirmDelete") : t("templates:delete")}
                                                    data-testid={`template-delete-${template.id}`}
                                                    onClick={() => void handleDelete(template)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="rounded-xl border border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)]">{t("templates:emptyUser")}</p>
                            )}
                        </section>

                        {formOpen && (
                            <section className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--field)] p-4" data-testid="template-editor-form">
                                <h3 className="text-sm font-semibold text-[var(--text)]">{editingTemplate ? t("templates:edit") : t("templates:create")}</h3>
                                <label className="block text-xs text-[var(--muted)]" htmlFor="template-name-input">
                                    {t("templates:name")}
                                    <input
                                        id="template-name-input"
                                        data-testid="template-name-input"
                                        className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--popover)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                        value={draft.name}
                                        onChange={(event) => {
                                            const { value } = event.currentTarget;
                                            setDraft((current) => ({ ...current, name: value }));
                                        }}
                                        placeholder={t("templates:namePlaceholder")}
                                        maxLength={100}
                                    />
                                </label>
                                <label className="block text-xs text-[var(--muted)]" htmlFor="template-description-input">
                                    {t("templates:description")}
                                    <input
                                        id="template-description-input"
                                        data-testid="template-description-input"
                                        className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--popover)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                        value={draft.description}
                                        onChange={(event) => {
                                            const { value } = event.currentTarget;
                                            setDraft((current) => ({ ...current, description: value }));
                                        }}
                                        placeholder={t("templates:descriptionPlaceholder")}
                                        maxLength={500}
                                    />
                                </label>
                                <label className="block text-xs text-[var(--muted)]" htmlFor="template-content-input">
                                    {t("templates:content")}
                                    <textarea
                                        id="template-content-input"
                                        data-testid="template-content-input"
                                        className="mt-1 min-h-48 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--popover)] px-3 py-2 font-mono text-sm leading-relaxed text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                        value={draft.content}
                                        onChange={(event) => {
                                            const { value } = event.currentTarget;
                                            setDraft((current) => ({ ...current, content: value }));
                                        }}
                                        placeholder={t("templates:contentPlaceholder")}
                                    />
                                </label>
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                                        data-testid="template-cancel-edit-btn"
                                        onClick={() => {
                                            setEditingTemplate(null);
                                            setFormOpen(false);
                                            setDraft(EMPTY_DRAFT);
                                        }}
                                    >
                                        {t("templates:cancel")}
                                    </button>
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                                        data-testid="template-save-btn"
                                        disabled={saving}
                                        onClick={() => void handleSave()}
                                    >
                                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        {t("templates:save")}
                                    </button>
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
}
