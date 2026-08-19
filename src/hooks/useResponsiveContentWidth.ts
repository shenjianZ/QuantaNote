import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { interpolateContentWidth } from "../utils/contentWidth";

interface ResponsiveContentWidthOptions {
  baseWidth: number;
  progress: number;
  horizontalGutter?: number;
  enabled?: boolean;
}

interface ResponsiveContentWidthResult<T extends HTMLElement> {
  ref: RefObject<T | null>;
  style: CSSProperties | undefined;
}

function getResponsiveGutter(gutter: number) {
  return typeof window !== "undefined" && window.innerWidth >= 640 ? gutter : 0;
}

function getElementAvailableWidth(element: HTMLElement, horizontalGutter: number) {
  const parent = element.parentElement;
  const parentWidth = parent?.getBoundingClientRect().width || parent?.clientWidth || window.innerWidth;
  return Math.max(0, parentWidth - getResponsiveGutter(horizontalGutter));
}

export function useResponsiveContentWidth<T extends HTMLElement = HTMLElement>({
  baseWidth,
  progress,
  horizontalGutter = 0,
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
      setAvailableWidth(getElementAvailableWidth(element, horizontalGutter));
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
  }, [enabled, horizontalGutter]);

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
): { style: CSSProperties } {
  const [availableWidth, setAvailableWidth] = useState(() => {
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : baseWidth;
    return Math.max(0, viewportWidth - getResponsiveGutter(horizontalGutter));
  });

  useLayoutEffect(() => {
    const measure = () => {
      const viewportWidth = typeof window !== "undefined" ? window.innerWidth : baseWidth;
      setAvailableWidth(Math.max(0, viewportWidth - getResponsiveGutter(horizontalGutter)));
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [baseWidth, horizontalGutter]);

  return {
    style: {
      maxWidth: `${interpolateContentWidth(baseWidth, availableWidth, progress)}px`,
    },
  };
}
