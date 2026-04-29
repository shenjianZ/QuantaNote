import { CheckCircle2, Cloud, LockKeyhole, ShieldCheck } from "lucide-react";

export function StatusBar() {
  return (
    <footer className="statusbar">
      <div>
        <Cloud size={18} />
        <span>已同步 1 分钟前</span>
        <CheckCircle2 size={17} className="ok" />
      </div>
      <div>
        <LockKeyhole size={17} />
        <span>端到端加密已开启</span>
      </div>
      <div>
        <ShieldCheck size={17} className="ok" />
        <span>安全评分 95 分</span>
      </div>
    </footer>
  );
}
