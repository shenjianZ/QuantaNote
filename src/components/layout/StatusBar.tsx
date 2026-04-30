import { CheckCircle2, Database } from "lucide-react";
import { useItemStore } from "../../stores/itemStore";
import { useAppStore } from "../../stores/appStore";

const PAGE_NAMES: Record<string, string> = {
  home: "首页",
  all: "全部记录",
  tags: "标签",
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
        <span style={{ color: 'var(--text-faint)' }}>· {itemCount} 条记录</span>
        <CheckCircle2 className="ok" />
      </div>
      <div>
        <span className="text-faint text-sm">本地模式</span>
      </div>
    </footer>
  );
}
