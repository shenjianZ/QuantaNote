import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "../common/Select";
import type { NotePriority, NoteProperties, NotePropertyUpdates } from "../../utils/frontmatter";

interface NotePropertiesPanelProps {
  properties: NoteProperties;
  onChange: (updates: NotePropertyUpdates) => void;
}

export function NotePropertiesPanel({ properties, onChange }: NotePropertiesPanelProps) {
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
    <section className="shrink-0 rounded-2xl border border-[var(--line)] bg-transparent p-3" data-testid="doc-note-properties">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-[var(--text)]">{t("common:noteProperties.title")}</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{t("common:noteProperties.hint")}</p>
      </div>
      <div className="space-y-3">
        <label className="block text-xs text-[var(--muted)]">
          <span className="mb-1 block">{t("common:noteProperties.status")}</span>
          <span data-testid="doc-property-status">
            <Select
              value={properties.status}
              onChange={(value) => onChange({ status: value })}
              options={statusOptions}
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
            />
          </span>
        </label>
        <label className="block text-xs text-[var(--muted)]" htmlFor="doc-property-due-date">
          <span className="mb-1 block">{t("common:noteProperties.due")}</span>
          <input
            id="doc-property-due-date"
            className="h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
            type="date"
            value={properties.dueDate ?? ""}
            onChange={(event) => onChange({ dueDate: event.currentTarget.value || null })}
            data-testid="doc-property-due-date"
          />
        </label>
        <label className="block text-xs text-[var(--muted)]" htmlFor="doc-property-aliases">
          <span className="mb-1 block">{t("common:noteProperties.aliases")}</span>
          <input
            id="doc-property-aliases"
            className="h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
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
            data-testid="doc-property-aliases"
          />
        </label>
      </div>
    </section>
  );
}
