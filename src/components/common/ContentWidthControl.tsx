import { Columns2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settingsStore";
import {
  clampContentWidthProgress,
  fromContentWidthControlProgress,
  CONTENT_WIDTH_COMFORTABLE,
  CONTENT_WIDTH_DEFAULT,
  CONTENT_WIDTH_CONTROL_MAX_PROGRESS,
  CONTENT_WIDTH_IMMERSIVE,
  toContentWidthControlProgress,
} from "../../utils/contentWidth";

interface ContentWidthControlProps {
  compact?: boolean;
  testId?: string;
}

const PRESETS = [
  { key: "default", value: CONTENT_WIDTH_DEFAULT, labelKey: "default" },
  { key: "comfortable", value: CONTENT_WIDTH_COMFORTABLE, labelKey: "comfortable" },
  { key: "immersive", value: CONTENT_WIDTH_IMMERSIVE, labelKey: "immersive" },
] as const;

interface PopoverPosition {
  top: number;
  right: number;
}

const COMPACT_PANEL_GAP = 8;
const COMPACT_PANEL_MARGIN = 8;

function getCompactPanelPosition(trigger: HTMLElement): PopoverPosition {
  const rect = trigger.getBoundingClientRect();
  const estimatedPanelHeight = 176;
  const top = Math.max(
    COMPACT_PANEL_MARGIN,
    Math.min(
      rect.bottom + COMPACT_PANEL_GAP,
      window.innerHeight - estimatedPanelHeight - COMPACT_PANEL_MARGIN,
    ),
  );

  return {
    top,
    right: Math.max(COMPACT_PANEL_MARGIN, window.innerWidth - rect.right),
  };
}

export function ContentWidthControl({ compact = false, testId = "content-width-control" }: ContentWidthControlProps) {
  const { t } = useTranslation(["settings"]);
  const value = clampContentWidthProgress(useSettingsStore((s) => s.settings.contentWidthProgress));
  const controlValue = toContentWidthControlProgress(value);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const [compactOpen, setCompactOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = `${testId}-panel`;

  const updatePopoverPosition = () => {
    if (!triggerRef.current) return;
    setPopoverPosition(getCompactPanelPosition(triggerRef.current));
  };

  useEffect(() => {
    if (!compactOpen) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setCompactOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCompactOpen(false);
    };
    const handleViewportChange = () => updatePopoverPosition();

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [compactOpen]);

  const handleChange = (nextValue: number) => {
    updateSetting("contentWidthProgress", clampContentWidthProgress(nextValue));
  };

  const panel = (
    <div
      ref={compact ? panelRef : undefined}
      id={panelId}
      className="w-72 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--popover)] p-3 shadow-xl"
      data-testid={panelId}
      style={compact && popoverPosition ? {
        position: "fixed",
        top: popoverPosition.top,
        right: popoverPosition.right,
        maxHeight: "calc(100vh - 1rem)",
        zIndex: 100,
      } : undefined}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--text)]">{t("settings:contentWidth.title")}</span>
        <span className="text-xs tabular-nums text-[var(--muted)]">{controlValue}%</span>
      </div>
      <div className="mb-3 grid grid-cols-3 border-b border-[var(--line)]" role="group" aria-label={t("settings:contentWidth.presets")}>
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            className={`border-b-2 px-2 py-1.5 text-xs transition-colors ${value === preset.value ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:border-[var(--line)] hover:text-[var(--text)]"}`}
            type="button"
            data-testid={`${testId}-preset-${preset.key}`}
            aria-pressed={value === preset.value}
            onClick={() => handleChange(preset.value)}
          >
            {t(`settings:contentWidth.${preset.labelKey}`)}
          </button>
        ))}
      </div>
      <label className="block" htmlFor={`${testId}-slider`}>
        <span className="mb-1.5 block text-xs text-[var(--muted)]">{t("settings:contentWidth.slider")}</span>
        <input
          id={`${testId}-slider`}
          className="w-full accent-[var(--accent)]"
          data-testid={`${testId}-slider`}
          type="range"
          min={CONTENT_WIDTH_DEFAULT}
          max={CONTENT_WIDTH_CONTROL_MAX_PROGRESS}
          step={1}
          value={controlValue}
          aria-label={t("settings:contentWidth.slider")}
          onChange={(event) => handleChange(fromContentWidthControlProgress(event.currentTarget.value))}
        />
      </label>
    </div>
  );

  if (!compact) {
    return <div data-testid={testId}>{panel}</div>;
  }

  const compactPanel = compactOpen && popoverPosition && typeof document !== "undefined"
    ? createPortal(panel, document.body)
    : null;

  return (
    <>
      <div className="relative shrink-0" data-testid={testId}>
        <button
          ref={triggerRef}
          className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden"
          type="button"
          aria-label={t("settings:contentWidth.open")}
          aria-expanded={compactOpen}
          aria-controls={panelId}
          title={t("settings:contentWidth.open")}
          onClick={() => {
            if (compactOpen) {
              setCompactOpen(false);
              return;
            }
            updatePopoverPosition();
            setCompactOpen(true);
          }}
        >
          <Columns2 className="h-4 w-4" />
        </button>
      </div>
      {compactPanel}
    </>
  );
}
