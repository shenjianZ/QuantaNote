import type { ReactNode } from "react";
import type { AppPage } from "../../types";
import { TopBar } from "./TopBar";
import { StatusBar } from "./StatusBar";

interface AppShellProps {
  children: ReactNode;
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onOpenSearch: () => void;
  itemCount?: number;
}

export function AppShell({
  children,
  currentPage,
  onNavigate,
  onOpenSearch,
  itemCount,
}: AppShellProps) {
  return (
    <main className="h-screen w-screen overflow-hidden bg-[var(--app-bg)] text-[var(--text)]">
      <section className="flex h-full min-h-0 flex-col">
        <TopBar
          currentPage={currentPage}
          onNavigate={onNavigate}
          onOpenSearch={onOpenSearch}
        />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        <StatusBar currentPage={currentPage} itemCount={itemCount} />
      </section>
    </main>
  );
}
