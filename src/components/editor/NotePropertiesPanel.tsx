import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "../common/Select";
import type { NotePriority, NoteProperties, NotePropertyUpdates } from "../../utils/frontmatter";

interface NotePropertiesPanelProps {
  properties: NoteProperties;
  onChange: (updates: NotePropertyUpdates) => void;
  /** 预览态：禁用全部编辑控件 */
  readOnly?: boolean;
}

export function NotePropertiesPanel({ properties, onChange, readOnly = false }: NotePropertiesPanelProps) {
  const { t } = useTranslation(["common"]);
  const [aliasesText, setAliasesText] = useState(properties.aliases.join(", "));

  useEffect(() => {
    setAliasesText(properties.aliases.join(", "));
  }, [properties.aliases]);

  const statusOptions = [
    { value: "inbox", label: t("common:noteProperties.statuses.inbox") },
    { value: "in-progress", label: t("common:noteProperties.statuses.inProgress") },
    { value: "done", label: t("common:noteProperties.statuses.done") },
    { value: "archived", label: t("common:noteProperties.statuses.archived") },
    ...(properties.status !== "inbox"
      && properties.status !== "in-progress"
      && properties.status !== "done"
      && properties.status !== "archived"
      ? [{ value: properties.status, label: properties.status }]
      : []),
  ];
  const priorityOptions = [
    { value: "none", label: t("common:noteProperties.priorities.none") },
    { value: "low", label: t("common:noteProperties.priorities.low") },
    { value: "medium", label: t("common:noteProperties.priorities.medium") },
    { value: "high", label: t("common:noteProperties.priorities.high") },
  ];

  function commitAliases() {
    onChange({
      aliases: aliasesText.split(",").map((alias) => alias.trim()).filter(Boolean),
    });
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col p-3" data-testid="doc-note-properties">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-[var(--text)]">{t("common:noteProperties.title")}</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{t("common:noteProperties.hint")}</p>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-[var(--muted)]">
            <span className="mb-1 block">{t("common:noteProperties.status")}</span>
            <span data-testid="doc-property-status">
              <Select
                value={properties.status}
                onChange={(value) => onChange({ status: value })}
                options={statusOptions}
                disabled={readOnly}
              />
            </span>
          </label>
          <label className="block text-xs text-[var(--muted)]">
            <span className="mb-1 block">{t("common:noteProperties.priority")}</span>
            <span data-testid="doc-property-priority">
              <Select
                value={properties.priority}
                onChange={(value) => onChange({ priority: value as NotePriority })}
                options={priorityOptions}
                disabled={readOnly}
              />
            </span>
          </label>
        </div>
        <label className="block text-xs text-[var(--muted)]" htmlFor="doc-property-due-date">
          <span className="mb-1 block">{t("common:noteProperties.due")}</span>
          <input
            id="doc-property-due-date"
            className="h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
            type="date"
            value={properties.dueDate ?? ""}
            onChange={(event) => onChange({ dueDate: event.currentTarget.value || null })}
            disabled={readOnly}
            data-testid="doc-property-due-date"
          />
        </label>
        <label className="block text-xs text-[var(--muted)]" htmlFor="doc-property-aliases">
          <span className="mb-1 block">{t("common:noteProperties.aliases")}</span>
          <input
            id="doc-property-aliases"
            className="h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
            type="text"
            value={aliasesText}
            placeholder={t("common:noteProperties.aliasesPlaceholder")}
            onChange={(event) => setAliasesText(event.currentTarget.value)}
            onBlur={commitAliases}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            disabled={readOnly}
            data-testid="doc-property-aliases"
          />
        </label>
      </div>
    </section>
  );
}
