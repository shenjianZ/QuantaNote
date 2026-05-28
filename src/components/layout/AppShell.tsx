import type { ReactNode } from "react";
import type { AppPage } from "../../types";
import { TopBar } from "./TopBar";
import { StatusBar } from "./StatusBar";
import { BottomTabBar } from "./BottomTabBar";

interface AppShellProps {
  children: ReactNode;
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onOpenSearch: () => void;
  onNewNote?: () => void;
  itemCount?: number;
}

export function AppShell({
  children,
  currentPage,
  onNavigate,
  onOpenSearch,
  onNewNote,
  itemCount,
}: AppShellProps) {
  return (
    <main className="h-screen w-screen overflow-hidden bg-[var(--app-bg)] text-[var(--text)]">
      <section className="flex h-full min-h-0 flex-col">
        {/* 移动端添加顶部安全区域 */}
        <div className="safe-area-inset-top sm:hidden" />
        <TopBar
          currentPage={currentPage}
          onNavigate={onNavigate}
          onOpenSearch={onOpenSearch}
        />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        {/* 桌面端显示 StatusBar，移动端显示 BottomTabBar */}
        <div className="hidden sm:block">
          <StatusBar currentPage={currentPage} itemCount={itemCount} />
        </div>
        {onNewNote && (
          <div className="sm:hidden">
            <BottomTabBar
              currentPage={currentPage}
              onNavigate={onNavigate}
              onNewNote={onNewNote}
            />
          </div>
        )}
      </section>
    </main>
  );
}
