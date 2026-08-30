import { CalendarDays, ChevronLeft, ChevronRight, List, Plus } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDateKey, getCalendarDays, isSameMonth, isToday } from "../../utils/dailyNotes";

interface CalendarViewProps {
  month: Date;
  counts: Record<string, number>;
  selectedDate: string | null;
  loading?: boolean;
  onMonthChange: (offset: number) => void;
  onSelectDate: (dateKey: string) => void;
  onOpenDailyNote?: (dateKey: string) => void;
  onBackToList: () => void;
}

export function CalendarView({
  month,
  counts,
  selectedDate,
  loading = false,
  onMonthChange,
  onSelectDate,
  onOpenDailyNote,
  onBackToList,
}: CalendarViewProps) {
  const { t } = useTranslation(["library"]);
  const days = useMemo(() => getCalendarDays(month), [month]);
  const locale = typeof navigator !== "undefined" ? navigator.language : "zh-CN";
  const monthLabel = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(month);
  const selectedCount = selectedDate ? counts[selectedDate] ?? 0 : 0;
  const weekdayLabels = [
    t("library:calendar.weekdays.sun"),
    t("library:calendar.weekdays.mon"),
    t("library:calendar.weekdays.tue"),
    t("library:calendar.weekdays.wed"),
    t("library:calendar.weekdays.thu"),
    t("library:calendar.weekdays.fri"),
    t("library:calendar.weekdays.sat"),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col p-3 sm:p-5" data-testid="library-calendar-view">
      <header className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays className="h-5 w-5 shrink-0 text-[var(--accent)]" />
          <h2 className="truncate text-base font-semibold text-[var(--text)]">{monthLabel}</h2>
          {loading && <span className="text-xs text-[var(--muted)]">{t("library:calendar.loading")}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
            data-testid="library-calendar-prev"
            aria-label={t("library:calendar.previousMonth")}
            onClick={() => onMonthChange(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
            data-testid="library-calendar-next"
            aria-label={t("library:calendar.nextMonth")}
            onClick={() => onMonthChange(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--line)] px-2.5 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
            data-testid="library-calendar-list-btn"
            onClick={onBackToList}
          >
            <List className="h-3.5 w-3.5" />
            {t("library:calendar.listView")}
          </button>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-7 border-b border-[var(--line)] pb-2" role="row">
        {weekdayLabels.map((label) => (
          <div key={label} className="text-center text-xs font-medium text-[var(--muted)]" role="columnheader">
            {label}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {days.map((date) => {
          const dateKey = formatDateKey(date);
          const count = counts[dateKey] ?? 0;
          const inMonth = isSameMonth(date, month);
          const selected = selectedDate === dateKey;
          return (
            <button
              key={dateKey}
              type="button"
              className={`relative m-0.5 min-h-12 rounded-xl border text-left transition sm:m-1 sm:min-h-16 ${
                selected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-transparent hover:border-[var(--line)] hover:bg-[var(--hover)]"
              } ${inMonth ? "text-[var(--text)]" : "text-[var(--muted)] opacity-50"}`}
              data-testid={`library-calendar-day-${dateKey}`}
              aria-label={t("library:calendar.dayLabel", { date: dateKey, count })}
              aria-pressed={selected}
              onClick={() => onSelectDate(dateKey)}
            >
              <span className={`absolute right-2 top-1.5 text-xs ${isToday(date) ? "font-bold text-[var(--accent)]" : ""}`}>
                {date.getDate()}
              </span>
              <span className="absolute bottom-1.5 left-2 flex items-center gap-1 text-[10px] text-[var(--accent)] sm:bottom-2 sm:left-2.5" data-testid={`library-calendar-count-${dateKey}`}>
                {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                {count > 0 && count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-between gap-3 rounded-xl bg-[var(--field)] px-3 py-2.5" data-testid="library-calendar-selection">
        {selectedDate ? (
          <div className="min-w-0 text-sm text-[var(--text)]">
            <span className="font-medium">{selectedDate}</span>
            <span className="ml-2 text-xs text-[var(--muted)]">{t("library:calendar.selectedCount", { count: selectedCount })}</span>
          </div>
        ) : (
          <span className="text-sm text-[var(--muted)]">{t("library:calendar.selectHint")}</span>
        )}
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="library-calendar-open-daily"
          disabled={!selectedDate || !onOpenDailyNote}
          onClick={() => selectedDate && onOpenDailyNote?.(selectedDate)}
        >
          <Plus className="h-3.5 w-3.5" />
          {t("library:calendar.openDailyNote")}
        </button>
      </div>
    </div>
  );
}
