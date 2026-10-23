import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlignLeft,
  Archive,
  AtSign,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Flag,
  Tags,
} from "lucide-react";
import type { NoteProperties } from "../../utils/frontmatter";
import { TagPill } from "./TagPill";

interface NotePropertiesBadgesProps {
  properties: NoteProperties;
  tags?: { name: string; color: string }[];
  summary?: string;
  testId?: string;
}

type DueDateTone = "overdue" | "soon" | "plain";

function getLocalDateString(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getDueDateTone(dueDate: string): DueDateTone {
  const today = getLocalDateString(new Date());
  if (dueDate < today) return "overdue";
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);
  return dueDate <= getLocalDateString(soon) ? "soon" : "plain";
}

const STATUS_STYLES: Record<string, string> = {
  "in-progress": "bg-[var(--info-soft)] text-[var(--info)]",
  done: "bg-[var(--ok-soft)] text-[var(--ok)]",
  archived: "bg-[var(--field)] text-[var(--muted)]",
};

const STATUS_ICONS: Record<string, typeof CircleDot> = {
  "in-progress": CircleDot,
  done: CheckCircle2,
  archived: Archive,
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-[var(--ok-soft)] text-[var(--ok)]",
  medium: "bg-[var(--warn-soft)] text-[var(--warn)]",
  high: "bg-[var(--danger-soft)] text-[var(--danger)]",
};

const DUE_TONE_STYLES: Record<DueDateTone, string> = {
  overdue: "bg-[var(--danger-soft)] text-[var(--danger)]",
  soon: "bg-[var(--warn-soft)] text-[var(--warn)]",
  plain: "bg-[var(--field)] text-[var(--text)]",
};

const DUE_TONE_ICONS: Record<DueDateTone, typeof CalendarDays> = {
  overdue: CalendarX2,
  soon: CalendarClock,
  plain: CalendarDays,
};

export function NotePropertiesBadges({ properties, tags = [], summary = "", testId = "note-properties" }: NotePropertiesBadgesProps) {
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
  const showTags = tags.length > 0;
  const showSummary = summary.trim().length > 0;
  const dueTone = properties.dueDate ? getDueDateTone(properties.dueDate) : "plain";
  const StatusIcon = STATUS_ICONS[properties.status] ?? CircleDot;
  const DueIcon = DUE_TONE_ICONS[dueTone];

  const summaryTextRef = useRef<HTMLParagraphElement>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [summaryTruncated, setSummaryTruncated] = useState(false);

  useEffect(() => {
    setSummaryExpanded(false);
    const element = summaryTextRef.current;
    setSummaryTruncated(element ? element.scrollHeight > element.clientHeight + 1 : false);
  }, [summary]);

  if (!showStatus && !showPriority && !showDueDate && !showAliases && !showTags && !showSummary) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-3" data-testid={testId}>
      {showStatus && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${STATUS_STYLES[properties.status] ?? "bg-[var(--field)] text-[var(--text)]"}`}>
          <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {statusLabels[properties.status] ?? properties.status}
        </span>
      )}
      {showPriority && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${PRIORITY_STYLES[properties.priority]}`}>
          <Flag className="h-3.5 w-3.5" fill={properties.priority === "high" ? "currentColor" : "none"} aria-hidden="true" />
          {t("common:noteProperties.priority")}: {priorityLabels[properties.priority] ?? properties.priority}
        </span>
      )}
      {showDueDate && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${DUE_TONE_STYLES[dueTone]}`}>
          <DueIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {t("common:noteProperties.due")}: {properties.dueDate}
          {dueTone === "overdue" && <span className="font-medium"> · {t("common:noteProperties.overdue")}</span>}
        </span>
      )}
      {showAliases && (
        <span className="inline-flex min-w-0 items-center gap-1 text-xs text-[var(--muted)]">
          <AtSign className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="mr-0.5">{t("common:noteProperties.aliases")}:</span>
          {properties.aliases.map((alias) => (
            <span key={alias} className="rounded-full bg-[var(--field)] px-2 py-1 text-[var(--muted)]">{alias}</span>
          ))}
        </span>
      )}
      {showTags && (
        <span className="inline-flex min-w-0 flex-wrap items-center gap-1 text-xs text-[var(--muted)]" data-testid={`${testId}-tags`}>
          <Tags className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="mr-0.5">{t("common:noteProperties.tags")}:</span>
          {tags.map((tag) => <TagPill key={tag.name} tag={tag} />)}
        </span>
      )}
      {showSummary && (
        <div className="w-full rounded-xl bg-[var(--field)] px-3 py-2" data-testid={`${testId}-summary`}>
          <div className="flex items-start gap-2">
            <AlignLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted)]" aria-hidden="true" />
            <p
              ref={summaryTextRef}
              className={`min-w-0 flex-1 text-xs leading-relaxed text-[var(--text)] ${summaryExpanded ? "" : "line-clamp-2"}`}
              data-testid={summaryExpanded ? `${testId}-summary-expanded` : `${testId}-summary-clamped`}
            >
              <span className="mr-1 text-[var(--muted)]">{t("common:noteProperties.summary")}:</span>
              {summary}
            </p>
            {summaryTruncated && (
              <button
                className="ml-1 inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full text-[11px] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
                type="button"
                data-testid={`${testId}-summary-toggle`}
                aria-expanded={summaryExpanded}
                onClick={() => setSummaryExpanded((expanded) => !expanded)}
              >
                {t(summaryExpanded ? "common:noteProperties.showLess" : "common:noteProperties.showMore")}
                {summaryExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
