import { CalendarDays, Flag, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NoteProperties } from "../../utils/frontmatter";

interface NotePropertiesBadgesProps {
  properties: NoteProperties;
  testId?: string;
}

export function NotePropertiesBadges({ properties, testId = "note-properties" }: NotePropertiesBadgesProps) {
  const { t } = useTranslation(["common"]);
  const statusLabels: Record<string, string> = {
    inbox: t("common:noteProperties.statuses.inbox"),
    "in-progress": t("common:noteProperties.statuses.inProgress"),
    done: t("common:noteProperties.statuses.done"),
    archived: t("common:noteProperties.statuses.archived"),
  };
  const priorityLabels: Record<string, string> = {
    low: t("common:noteProperties.priorities.low"),
    medium: t("common:noteProperties.priorities.medium"),
    high: t("common:noteProperties.priorities.high"),
  };
  const showStatus = properties.status !== "inbox";
  const showPriority = properties.priority !== "none";
  const showDueDate = Boolean(properties.dueDate);
  const showAliases = properties.aliases.length > 0;

  if (!showStatus && !showPriority && !showDueDate && !showAliases) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-4" data-testid={testId}>
      {showStatus && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs text-[var(--accent)]">
          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
          {statusLabels[properties.status] ?? properties.status}
        </span>
      )}
      {showPriority && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--field)] px-2.5 py-1 text-xs text-[var(--text)]">
          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
          {t("common:noteProperties.priority")}: {priorityLabels[properties.priority] ?? properties.priority}
        </span>
      )}
      {showDueDate && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--field)] px-2.5 py-1 text-xs text-[var(--text)]">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {t("common:noteProperties.due")}: {properties.dueDate}
        </span>
      )}
      {showAliases && (
        <span className="inline-flex min-w-0 items-center gap-1 text-xs text-[var(--muted)]">
          <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="mr-0.5">{t("common:noteProperties.aliases")}:</span>
          {properties.aliases.map((alias) => (
            <span key={alias} className="rounded-full bg-[var(--field)] px-2 py-1 text-[var(--muted)]">{alias}</span>
          ))}
        </span>
      )}
    </div>
  );
}
