import { useEffect, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ImagePreviewModalProps {
  open: boolean;
  src: string;
  alt: string;
  onClose: () => void;
  testIdPrefix?: string;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const SCALE_STEP = 1.1;

interface ImagePanOffset {
  x: number;
  y: number;
}

interface ImageDragState extends ImagePanOffset {
  startX: number;
  startY: number;
}

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function ImagePreviewModal({
  open,
  src,
  alt,
  onClose,
  testIdPrefix = "image-preview",
}: ImagePreviewModalProps) {
  const { t } = useTranslation();
  const [scale, setScale] = useState(1);
  const [panOffset, setPanOffset] = useState<ImagePanOffset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<ImageDragState | null>(null);

  useEffect(() => {
    if (!open) return;
    setScale(1);
    setPanOffset({ x: 0, y: 0 });
    dragRef.current = null;
    setIsDragging(false);
  }, [open, src]);

  useEffect(() => {
    if (scale <= 1) setPanOffset({ x: 0, y: 0 });
  }, [scale]);

  useEffect(() => {
    if (!open) return;

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      event.preventDefault();
      setPanOffset({
        x: drag.x + event.clientX - drag.startX,
        y: drag.y + event.clientY - drag.startY,
      });
    };
    const handleMouseUp = () => {
      dragRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);

  if (!open || !src || typeof document === "undefined" || !document.body) return null;

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.deltaY === 0) return;
    setScale((currentScale) => clampScale(
      currentScale * (event.deltaY < 0 ? SCALE_STEP : 1 / SCALE_STEP),
    ));
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (scale <= 1 || event.button !== 0) return;
    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      x: panOffset.x,
      y: panOffset.y,
    };
    setIsDragging(true);
  };

  const imageTransform = panOffset.x === 0 && panOffset.y === 0
    ? `scale(${scale})`
    : `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${scale})`;

  return createPortal(
    <div
      className="quantanote-image-preview"
      role="dialog"
      aria-modal="true"
      aria-label={t("editor:imageEditor.preview")}
      data-testid={`${testIdPrefix}-modal`}
      onMouseDown={onClose}
    >
      <div className="quantanote-image-preview__toolbar" onMouseDown={(event) => event.stopPropagation()}>
        <div className="quantanote-image-preview__info">
          <span className="quantanote-image-preview__title">{alt}</span>
          <span
            className="quantanote-image-preview__scale"
            aria-live="polite"
            data-testid={`${testIdPrefix}-scale`}
          >
            {Math.round(scale * 100)}%
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("editor:imageEditor.close")}
          title={t("editor:imageEditor.close")}
          data-testid={`${testIdPrefix}-close`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        className="quantanote-image-preview__stage"
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        data-testid={`${testIdPrefix}-stage`}
        style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        <img
          src={src}
          alt={alt}
          className="quantanote-image-preview__image"
          data-testid={`${testIdPrefix}-content`}
          style={{ transform: imageTransform }}
          draggable={false}
        />
      </div>
    </div>,
    document.body,
  );
}
