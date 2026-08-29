import { useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Modal } from "./Modal";
import { useItemStore } from "../../stores/itemStore";

interface TrashModalProps {
  open: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

function formatDeletedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function TrashModal({ open, onClose, onDataChanged }: TrashModalProps) {
  const { t } = useTranslation(["library", "common"]);
  const trashItems = useItemStore((state) => state.trashItems);
  const fetchTrashItems = useItemStore((state) => state.fetchTrashItems);
  const restoreItem = useItemStore((state) => state.restoreItem);
  const permanentlyDeleteItem = useItemStore((state) => state.permanentlyDeleteItem);
  const cleanupTrash = useItemStore((state) => state.cleanupTrash);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [permanentConfirmingId, setPermanentConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPermanentConfirmingId(null);
    fetchTrashItems().catch(() => {});
  }, [fetchTrashItems, open]);

  async function handleRestore(id: string) {
    setPendingId(id);
    try {
      await restoreItem(id);
      onDataChanged?.();
    } finally {
      setPendingId(null);
    }
  }

  async function handlePermanentDelete(id: string) {
    if (permanentConfirmingId !== id) {
      setPermanentConfirmingId(id);
      return;
    }
    setPendingId(id);
    try {
      await permanentlyDeleteItem(id);
      setPermanentConfirmingId(null);
    } finally {
      setPendingId(null);
    }
  }

  async function handleCleanup() {
    setPendingId("cleanup");
    try {
      await cleanupTrash(30);
      await fetchTrashItems();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("library:trash.title")} maxWidth="max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--field)] px-3 py-2.5">
        <div className="text-xs text-[var(--muted)]">{t("library:trash.retentionHint")}</div>
        <button
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
          type="button"
          data-testid="trash-cleanup-btn"
          disabled={pendingId !== null}
          onClick={handleCleanup}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("library:trash.cleanup")}
        </button>
      </div>

      {trashItems.length === 0 ? (
        <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-[var(--line)] px-6 text-center">
          <div>
            <Trash2 className="mx-auto mb-2 h-7 w-7 text-[var(--muted)]" />
            <div className="text-sm font-medium text-[var(--text)]">{t("library:trash.emptyTitle")}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">{t("library:trash.emptySubtitle")}</div>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)]">
          {trashItems.map(({ item, deleted_at }) => {
            const confirming = permanentConfirmingId === item.id;
            return (
              <div key={item.id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--text)]">{item.title || t("library:unnamed")}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{t("library:trash.deletedAt", { time: formatDeletedAt(deleted_at) })}</div>
                </div>
                <button
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
                  type="button"
                  data-testid={`trash-restore-${item.id}`}
                  disabled={pendingId !== null}
                  onClick={() => handleRestore(item.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("library:trash.restore")}
                </button>
                <button
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs disabled:opacity-50 ${confirming ? "bg-red-500/10 text-red-500" : "text-red-400 hover:bg-red-500/10"}`}
                  type="button"
                  data-testid={`trash-delete-${item.id}`}
                  disabled={pendingId !== null}
                  onClick={() => handlePermanentDelete(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {confirming ? t("library:trash.confirmPermanentDelete") : t("library:trash.permanentDelete")}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
