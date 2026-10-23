import type { ReactNode } from "react";

/** 分区头部：图标 + 大标题 + 描述 */
export function SettingsHeader({ icon, title, description }: { icon?: ReactNode; title: string; description?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      {icon && <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">{icon}</div>}
      <div>
        <h1 className="text-lg font-semibold text-[var(--text)]">{title}</h1>
        {description && <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{description}</p>}
      </div>
    </div>
  );
}

/** 设置组卡片：内部行以细分隔线分隔 */
export function SettingsGroup({ title, children, testId }: { title?: string; children: ReactNode; testId?: string }) {
  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]" data-testid={testId}>
      {title && <div className="border-b border-[var(--line)] bg-[var(--field)]/50 px-4 py-2 text-xs font-medium text-[var(--muted)]">{title}</div>}
      <div className="divide-y divide-[var(--line)]">{children}</div>
    </section>
  );
}

/** 标准设置行：左侧 label(+desc)，右侧控件 */
export function SettingsRow({
  label,
  desc,
  children,
  testId,
  stacked,
}: {
  label: ReactNode;
  desc?: ReactNode;
  children?: ReactNode;
  testId?: string;
  /** 控件较宽（滑块/输入组）时上下堆叠 */
  stacked?: boolean;
}) {
  const labelBlock = (
    <div className="min-w-0 max-w-full">
      <div className="text-sm font-medium leading-snug text-[var(--text)]">{label}</div>
      {desc && <div className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{desc}</div>}
    </div>
  );

  if (stacked) {
    return (
      <div className="px-4 py-3 transition-colors hover:bg-[var(--hover)]/40" data-testid={testId}>
        {labelBlock}
        {children && <div className="mt-2.5">{children}</div>}
      </div>
    );
  }
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-[var(--hover)]/40" data-testid={testId}>
      {labelBlock}
      {children && <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 text-right">{children}</div>}
    </div>
  );
}

/** 状态徽章：tone 控制配色 */
export function SettingsBadge({ tone = "neutral", children }: { tone?: "ok" | "warn" | "danger" | "neutral" | "accent"; children: ReactNode }) {
  const toneClass = {
    ok: "bg-[var(--ok-soft)] text-[var(--ok)]",
    warn: "bg-[var(--warn-soft)] text-[var(--warn)]",
    danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
    accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
    neutral: "bg-[var(--field)] text-[var(--muted)]",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>{children}</span>;
}

/** 开关（与全局 settings-switch 样式一致） */
export function SettingsToggle({ value, onChange, testId, ariaLabel }: { value: boolean; onChange: (value: boolean) => void; testId?: string; ariaLabel?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      data-testid={testId}
      className={`settings-switch relative shrink-0 rounded-full border border-[var(--line)] transition ${value ? "bg-[var(--accent)]" : "bg-[var(--field)]"}`}
      onClick={() => onChange(!value)}
    >
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${value ? "left-6" : "left-1"}`} />
    </button>
  );
}

/** 主操作按钮（accent 实底） */
export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** 次操作按钮（边框） */
export function SecondaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** 危险操作按钮（红字） */
export function DangerButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  );
}

export const inputClass =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]";
