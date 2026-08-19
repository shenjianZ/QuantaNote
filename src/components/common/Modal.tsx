import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isMobile, MOBILE_BACK_EVENT } from "../../utils/platform";
import { nativeLog } from "../../utils/nativeLog";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  headerExtra?: ReactNode;
  dialogStyle?: CSSProperties;
}

const RESPONSIVE_MAX_WIDTH_CLASSES: Record<string, string> = {
  "max-w-lg": "sm:max-w-lg",
  "max-w-2xl": "sm:max-w-2xl",
  "max-w-3xl": "sm:max-w-3xl",
};

export function Modal({ open, onClose, title, children, maxWidth = "max-w-lg", headerExtra, dialogStyle }: ModalProps) {
  const { t } = useTranslation(["common"]);
  const responsiveMaxWidth = RESPONSIVE_MAX_WIDTH_CLASSES[maxWidth] ?? RESPONSIVE_MAX_WIDTH_CLASSES["max-w-lg"];
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // 自动聚焦：仅在 open 从 false 变为 true 时执行一次
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (dialogRef.current) {
        const first = dialogRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        first?.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  // 键盘事件：Escape 关闭 + 移动端返回键关闭 + Tab 焦点陷阱
  useEffect(() => {
    if (!open) return;
    const mobile = isMobile();

    function handleMobileBack(e: Event) {
      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
      );
      if (dialogs[dialogs.length - 1] !== dialogRef.current) return;
      nativeLog("info", "[QuantaNote][mobile-back] close top modal", { title });
      e.preventDefault();
      e.stopImmediatePropagation();
      onCloseRef.current();
    }

    function handleKey(e: KeyboardEvent) {
      // Escape 或移动端 Backspace（物理返回键映射）关闭
      if (e.key === "Escape" || (mobile && e.key === "Backspace")) {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener(MOBILE_BACK_EVENT, handleMobileBack);
    document.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener(MOBILE_BACK_EVENT, handleMobileBack);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 grid place-items-end bg-black/20 backdrop-blur-sm sm:place-items-center sm:px-4"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[90vh] w-full flex-col rounded-t-3xl border border-[var(--line)] bg-[var(--popover)] shadow-2xl ${responsiveMaxWidth} sm:max-h-[85vh] sm:rounded-3xl`}
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
          <div className="flex items-center gap-2">
            {headerExtra}
            <button
              className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
              type="button"
              aria-label={t("common:buttons.close")}
              data-testid="modal-close-btn"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
        {/* 移动端底部安全区域 */}
        <div className="safe-area-inset-bottom sm:hidden" />
      </div>
    </div>
  );
}
