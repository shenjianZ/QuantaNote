import { CheckCircle2, Database } from "lucide-react";
import { useItemStore } from "../../stores/itemStore";
import { useAppStore } from "../../stores/appStore";

const PAGE_NAMES: Record<string, string> = {
  workspace: "工作台",
  document: "文档编辑",
  settings: "设置",
};

export function StatusBar() {
  const itemCount = useItemStore((s) => s.items.length);
  const currentPage = useAppStore((s) => s.currentPage);

  return (
    <footer className="statusbar">
      <div>
        <Database />
        <span>{PAGE_NAMES[currentPage] || currentPage}</span>
        <span className="statusbar-count">· {itemCount} 条记录</span>
        <CheckCircle2 className="ok" />
      </div>
      <div>
        <span className="text-faint text-sm">本地模式</span>
      </div>
    </footer>
  );
}
