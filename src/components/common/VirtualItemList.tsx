import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface VirtualItemListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T) => ReactNode;
  itemKey: (item: T) => string;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void | Promise<void>;
  loadingLabel?: ReactNode;
  className?: string;
}

const OVERSCAN = 5;

/**
 * 固定行高的轻量虚拟列表。记录行内容使用 line-clamp 限制高度，
 * 因而可以在不引入额外依赖的情况下稳定计算可见窗口。
 */
export function VirtualItemList<T>({
  items,
  itemHeight,
  renderItem,
  itemKey,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  loadingLabel = "Loading…",
  className,
}: VirtualItemListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateHeight = () => setViewportHeight(element.clientHeight);
    updateHeight();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      setScrollTop(element.scrollTop);
      if (
        hasMore &&
        !loadingMore &&
        element.scrollHeight - element.scrollTop - element.clientHeight <= itemHeight * 2
      ) {
        onLoadMore?.();
      }
    },
    [hasMore, itemHeight, loadingMore, onLoadMore],
  );

  // 首屏不足以填满视口时，自动继续加载，避免用户看不到滚动条而无法触发下一页。
  useEffect(() => {
    const element = containerRef.current;
    if (!element || !hasMore || loadingMore || items.length === 0 || element.clientHeight === 0) return;
    if (element.scrollHeight <= element.clientHeight + itemHeight * 2) {
      onLoadMore?.();
    }
  }, [hasMore, itemHeight, items.length, loadingMore, onLoadMore]);

  const visibleRange = useMemo(() => {
    const effectiveHeight = viewportHeight || itemHeight * 6;
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - OVERSCAN);
    const end = Math.min(
      items.length,
      Math.ceil((scrollTop + effectiveHeight) / itemHeight) + OVERSCAN,
    );
    return { start, end };
  }, [itemHeight, items.length, scrollTop, viewportHeight]);

  const totalHeight = (items.length + (loadingMore ? 1 : 0)) * itemHeight;

  return (
    <div
      ref={containerRef}
      className={className ?? "h-full overflow-auto"}
      onScroll={handleScroll}
      data-testid="virtual-item-list"
      data-loaded-count={items.length}
      data-has-more={hasMore ? "true" : "false"}
    >
      <div className="relative w-full" style={{ height: totalHeight }}>
        {items.slice(visibleRange.start, visibleRange.end).map((item, index) => {
          const absoluteIndex = visibleRange.start + index;
          return (
            <div
              key={itemKey(item)}
              className="absolute left-0 right-0"
              style={{ height: itemHeight, top: absoluteIndex * itemHeight }}
            >
              {renderItem(item)}
            </div>
          );
        })}
        {loadingMore && (
          <div
            className="absolute inset-x-0 flex items-center justify-center text-xs text-[var(--muted)]"
            style={{ height: itemHeight, top: items.length * itemHeight }}
            data-testid="library-loading-more"
          >
            {loadingLabel}
          </div>
        )}
      </div>
    </div>
  );
}
