import { Archive, Home, Plus, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppPage } from "../../types";

interface BottomTabBarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onNewNote: () => void;
}

export function BottomTabBar({ currentPage, onNavigate, onNewNote }: BottomTabBarProps) {
  const { t } = useTranslation(["topbar"]);

  const tabs = [
    { page: "workspace" as AppPage, icon: Home, label: t("topbar:workspace") },
    { page: "library" as AppPage, icon: Archive, label: t("topbar:library") },
  ];

  return (
    <nav className="flex h-14 shrink-0 items-center justify-around border-t border-[var(--line)] bg-[var(--chrome)] safe-area-inset-bottom">
      {tabs.map(({ page, icon: Icon, label }) => (
        <button
          key={page}
          className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-xs transition ${
            currentPage === page ? "text-[var(--accent)]" : "text-[var(--muted)]"
          }`}
          onClick={() => onNavigate(page)}
          type="button"
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </button>
      ))}

      {/* 中间 FAB 新建按钮 */}
      <div className="flex flex-1 justify-center">
        <button
          className="flex h-12 w-12 -translate-y-2 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg transition active:scale-95"
          onClick={onNewNote}
          type="button"
          aria-label={t("topbar:newNote", "新建笔记")}
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      <button
        className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-xs transition ${
          currentPage === "settings" ? "text-[var(--accent)]" : "text-[var(--muted)]"
        }`}
        onClick={() => onNavigate("settings")}
        type="button"
      >
        <Settings className="h-5 w-5" />
        <span>{t("topbar:settings")}</span>
      </button>
    </nav>
  );
}
