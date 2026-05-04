import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ColorPickerModalProps {
  open: boolean;
  initialColor?: string;
  onConfirm: (hex: string, name: string) => void;
  onCancel: () => void;
}

const PALETTE_ROWS = [
  // 红色系
  ["#fecaca", "#fca5a5", "#f87171", "#ef4444", "#dc2626", "#b91c1c"],
  // 橙色系
  ["#fed7aa", "#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c"],
  // 黄色系
  ["#fef08a", "#fde047", "#facc15", "#eab308", "#ca8a04", "#a16207"],
  // 绿色系
  ["#bbf7d0", "#86efac", "#4ade80", "#22c55e", "#16a34a", "#15803d"],
  // 青色系
  ["#a5f3fc", "#67e8f9", "#22d3ee", "#06b6d4", "#0891b2", "#0e7490"],
  // 蓝色系
  ["#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"],
  // 紫色系
  ["#e9d5ff", "#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9"],
  // 粉色系
  ["#fbcfe8", "#f9a8d4", "#f472b6", "#ec4899", "#db2777", "#be185d"],
  // 中性色
  ["#f5f5f4", "#d6d3d1", "#a8a29e", "#78716c", "#57534e", "#292524"],
];

export function ColorPickerModal({
  open,
  initialColor = "#386c5f",
  onConfirm,
  onCancel,
}: ColorPickerModalProps) {
  const { t } = useTranslation(["modals", "common"]);
  const [selected, setSelected] = useState(initialColor);
  const [hexInput, setHexInput] = useState(initialColor);
  const [name, setName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSelected(initialColor);
      setHexInput(initialColor);
      setName("");
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [open, initialColor]);

  function handleHexChange(v: string) {
    setHexInput(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      setSelected(v);
    }
  }

  function handleSelect(hex: string) {
    setSelected(hex);
    setHexInput(hex);
  }

  function handleConfirm() {
    const hex = /^#[0-9a-fA-F]{6}$/.test(selected) ? selected : initialColor;
    onConfirm(hex, name);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        data-testid="color-picker-modal"
        className="w-80 rounded-2xl border border-[var(--line)] bg-[var(--popover)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">{t("modals:colorPicker.title")}</h3>
          <button
            type="button"
            data-testid="color-picker-cancel-btn"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 预览 + HEX */}
        <div className="mb-4 flex items-center gap-3">
          <div
            data-testid="color-picker-preview"
            className="h-12 w-12 shrink-0 rounded-xl border border-[var(--line)] shadow-inner"
            style={{ background: selected }}
          />
          <div className="flex-1">
            <div className="mb-1 text-xs text-[var(--muted)]">{t("modals:colorPicker.hexValue")}</div>
            <input
              data-testid="color-picker-hex-input"
              className="h-8 w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-2.5 font-mono text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              value={hexInput}
              maxLength={7}
              onChange={(e) => handleHexChange(e.target.value)}
            />
          </div>
        </div>

        {/* 调色板 */}
        <div className="mb-4">
          <div className="mb-2 text-xs text-[var(--muted)]">{t("modals:colorPicker.palette")}</div>
          <div data-testid="color-picker-palette" className="flex flex-col gap-1">
            {PALETTE_ROWS.map((row, ri) => (
              <div key={ri} className="flex gap-1">
                {row.map((hex) => (
                  <button
                    key={hex}
                    data-testid="color-picker-swatch"
                    data-color={hex}
                    type="button"
                    className={`h-6 flex-1 rounded transition-transform hover:scale-110 ${
                      hex === selected ? "outline outline-2 outline-offset-1 outline-[var(--accent)]" : ""
                    }`}
                    style={{ background: hex }}
                    onClick={() => handleSelect(hex)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* 名称 */}
        <div className="mb-4">
          <div className="mb-1 text-xs text-[var(--muted)]">{t("modals:colorPicker.colorName")}</div>
          <input
            ref={nameRef}
            data-testid="color-picker-name-input"
            className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            placeholder={t("modals:colorPicker.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
              if (e.key === "Escape") onCancel();
            }}
          />
        </div>

        {/* 按钮 */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="h-8 rounded-lg border border-[var(--line)] px-3 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
            onClick={onCancel}
          >
            {t("common:buttons.cancel")}
          </button>
          <button
            type="button"
            data-testid="color-picker-confirm-btn"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-white hover:opacity-90"
            onClick={handleConfirm}
          >
            <Check className="h-4 w-4" />
            {t("common:buttons.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
