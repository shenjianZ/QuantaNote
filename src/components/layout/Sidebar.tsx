import {
  Archive,
  Folder,
  Grid2X2,
  History,
  Home,
  LockKeyhole,
  Settings,
  ShieldCheck,
  Tag,
} from "lucide-react";
import type { AppPage } from "../../types";
import { cn } from "../../utils/classNames";

interface SidebarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}

const navItems = [
  { page: "home" as AppPage, label: "首页", icon: Home },
  { page: "all" as AppPage, label: "全部", icon: Grid2X2 },
  { page: "tags" as AppPage, label: "标签", icon: Tag },
  { page: "vault" as AppPage, label: "保险箱", icon: LockKeyhole },
  { page: "files" as AppPage, label: "文件", icon: Folder },
  { page: "sync" as AppPage, label: "同步", icon: ShieldCheck },
  { page: "versions" as AppPage, label: "版本", icon: History },
  { page: "settings" as AppPage, label: "设置", icon: Settings },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="nav-list">
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
              <Icon size={24} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <button className="profile-button" type="button" title="个人账户">
        <Archive size={22} />
        <span />
      </button>
    </aside>
  );
}
