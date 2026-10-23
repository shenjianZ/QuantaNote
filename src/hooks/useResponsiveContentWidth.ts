import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { interpolateContentWidth } from "../utils/contentWidth";

interface ResponsiveContentWidthOptions {
  baseWidth: number;
  progress: number;
  horizontalGutter?: number;
  /** lg+ 视口下额外预留的宽度（如右侧 dock 占位），小屏不扣除 */
  reservedWidth?: number;
  enabled?: boolean;
}

interface ResponsiveContentWidthResult<T extends HTMLElement> {
  ref: RefObject<T | null>;
  style: CSSProperties | undefined;
}

const LG_BREAKPOINT = 1024;

function getResponsiveGutter(gutter: number) {
  return typeof window !== "undefined" && window.innerWidth >= 640 ? gutter : 0;
}

function getResponsiveReserved(reservedWidth: number) {
  return typeof window !== "undefined" && window.innerWidth >= LG_BREAKPOINT ? reservedWidth : 0;
}

function getElementAvailableWidth(element: HTMLElement, horizontalGutter: number, reservedWidth: number) {
  const parent = element.parentElement;
  const parentWidth = parent?.getBoundingClientRect().width || parent?.clientWidth || window.innerWidth;
  return Math.max(0, parentWidth - getResponsiveGutter(horizontalGutter) - getResponsiveReserved(reservedWidth));
}

export function useResponsiveContentWidth<T extends HTMLElement = HTMLElement>({
  baseWidth,
  progress,
  horizontalGutter = 0,
  reservedWidth = 0,
  enabled = true,
}: ResponsiveContentWidthOptions): ResponsiveContentWidthResult<T> {
  const ref = useRef<T>(null);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!enabled) {
      setAvailableWidth(null);
      return;
    }

    const element = ref.current;
    if (!element) return;
    const parent = element.parentElement;

    const measure = () => {
      setAvailableWidth(getElementAvailableWidth(element, horizontalGutter, reservedWidth));
    };

    measure();
    const observer = typeof ResizeObserver !== "undefined" && parent
      ? new ResizeObserver(measure)
      : null;
    if (observer && parent) observer.observe(parent);
    window.addEventListener("resize", measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled, horizontalGutter, reservedWidth]);

  if (!enabled || availableWidth === null) {
    return { ref, style: undefined };
  }

  return {
    ref,
    style: {
      maxWidth: `${interpolateContentWidth(baseWidth, availableWidth, progress)}px`,
    },
  };
}

export function useViewportContentWidth(
  baseWidth: number,
  progress: number,
  horizontalGutter = 0,
  /** lg+ 视口下额外预留的宽度（如右侧 dock 占位），小屏不扣除 */
  reservedWidth = 0,
): { style: CSSProperties; width: number } {
  const computeWidth = () => {
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : baseWidth;
    const available = Math.max(0, viewportWidth - getResponsiveGutter(horizontalGutter) - getResponsiveReserved(reservedWidth));
    return interpolateContentWidth(baseWidth, available, progress);
  };

  const [width, setWidth] = useState(computeWidth);

  useLayoutEffect(() => {
    const measure = () => setWidth(computeWidth());
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseWidth, horizontalGutter, reservedWidth, progress]);

  return {
    style: {
      maxWidth: `${width}px`,
    },
    width,
  };
}
