import { useState } from "react";
import { Modal } from "./Modal";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface VersionDto {
  id: string;
  item_id: string;
  version_number: number;
  content: string;
  change_summary: string;
  name: string;
  description: string;
  created_at: string;
}

interface VersionPreviewModalProps {
  open: boolean;
  version: VersionDto | null;
  onClose: () => void;
  onRestore: (version: VersionDto) => void;
  theme: "light" | "dark";
}

export function VersionPreviewModal({ open, version, onClose, onRestore, theme }: VersionPreviewModalProps) {
  const [confirming, setConfirming] = useState(false);

  if (!version) return null;

  function handleRestore() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    onRestore(version!);
    setConfirming(false);
  }

  function handleClose() {
    setConfirming(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={`版本预览 — ${version.name || `v${version.version_number}`}`} maxWidth="max-w-2xl">
      {version.description && (
        <p className="mb-3 text-sm text-[var(--muted)]">{version.description}</p>
      )}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4">
        <MarkdownRenderer content={version.content} theme={theme} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          className="rounded-full bg-[var(--field)] px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
          type="button"
          onClick={handleClose}
        >
          关闭
        </button>
        <button
          className={`rounded-full px-4 py-2 text-sm text-white ${confirming ? "bg-red-500 hover:bg-red-600" : "bg-[var(--accent)] hover:opacity-90"}`}
          type="button"
          onClick={handleRestore}
        >
          {confirming ? "确认恢复到此版本？" : "恢复到此版本"}
        </button>
      </div>
    </Modal>
  );
}
