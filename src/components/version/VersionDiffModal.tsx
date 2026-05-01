import { useMemo } from "react";
import { diffLines, type Change } from "diff";
import { X } from "lucide-react";
import { Modal } from "../common/Modal";
import type { VersionDto } from "../../types";

interface VersionDiffModalProps {
  open: boolean;
  versionA: VersionDto | null;
  versionB: VersionDto | null;
  onClose: () => void;
}

function DiffLine({ change }: { change: Change }) {
  const lines = (change.value ?? "").split("\n").filter((_, i, arr) => i < arr.length - 1 || arr[arr.length - 1] !== "");
  return (
    <>
      {lines.map((line, i) => (
        <div
          key={i}
          className={`font-mono text-xs leading-relaxed ${
            change.added
              ? "bg-green-500/10 text-green-400"
              : change.removed
                ? "bg-red-500/10 text-red-400"
                : "text-[var(--text)]"
          }`}
        >
          <span className="inline-block w-6 select-none text-right pr-2 text-[var(--muted)]">
            {change.added ? "+" : change.removed ? "-" : " "}
          </span>
          {line || " "}
        </div>
      ))}
    </>
  );
}

export function VersionDiffModal({ open, versionA, versionB, onClose }: VersionDiffModalProps) {
  const diffResult = useMemo(() => {
    if (!versionA || !versionB) return [];
    return diffLines(versionA.content || "", versionB.content || "");
  }, [versionA, versionB]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const change of diffResult) {
      const lines = (change.value ?? "").split("\n").length - 1;
      if (change.added) added += lines;
      if (change.removed) removed += lines;
    }
    return { added, removed };
  }, [diffResult]);

  if (!versionA || !versionB) return null;

  return (
    <Modal open={open} onClose={onClose} title="版本对比" maxWidth="max-w-3xl">
      <div className="space-y-3" data-testid="version-diff-modal">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
              {versionA.name || `v${versionA.version_number}`}
            </span>
            <span className="text-[var(--muted)]">→</span>
            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
              {versionB.name || `v${versionB.version_number}`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span className="text-green-400">+{stats.added}</span>
            <span className="text-red-400">-{stats.removed}</span>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--field)] p-3">
          {diffResult.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--muted)]">
              两个版本内容相同
            </div>
          ) : (
            diffResult.map((change, i) => <DiffLine key={i} change={change} />)
          )}
        </div>

        <div className="flex justify-end">
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
            type="button"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            关闭
          </button>
        </div>
      </div>
    </Modal>
  );
}
