import {
  Grid2X2,
  Settings,
  Tag,
  User,
} from "lucide-react";
import type { AppPage } from "../../types";
import { cn } from "../../utils/classNames";

interface SidebarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}

const navItems = [
  { page: "all" as AppPage, label: "全部", icon: Grid2X2 },
  { page: "tags" as AppPage, label: "标签", icon: Tag },
  { page: "settings" as AppPage, label: "设置", icon: Settings },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <nav className="nav-list">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            currentPage === item.page ||
            (item.page === "all" && currentPage === "document");
          return (
            <button
              key={item.page}
              className={cn("nav-item", active && "active")}
              onClick={() => onNavigate(item.page)}
              title={item.label}
              type="button"
            >
              <Icon />
            </button>
          );
        })}
      </nav>

      <button className="profile-button" type="button" title="设置" onClick={() => onNavigate("settings")}>
        <User />
        <span />
      </button>
    </aside>
  );
}
