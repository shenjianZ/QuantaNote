import type { ReactNode } from "react";
import type { AppPage } from "../../types";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  children: ReactNode;
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onOpenSearch: () => void;
}

export function AppShell({
  children,
  currentPage,
  onNavigate,
  onOpenSearch,
}: AppShellProps) {
  return (
    <main className="desktop-stage">
      <div className="hotkey-hint">
        <span>Ctrl</span>
        <span>Shift</span>
        <span>Space</span>
        呼出
      </div>
      <section className="app-window">
        <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
        <div className="app-main">
          <TopBar onOpenSearch={onOpenSearch} />
          <div className="page-body">{children}</div>
          <StatusBar />
        </div>
      </section>
    </main>
  );
}
