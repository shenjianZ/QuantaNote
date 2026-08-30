import { useEffect, useState } from "react";
import { Network, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getNoteBacklinks, getNoteLinks, type NoteLinkDto } from "../../services/tauriCommands";
import { NoteLinkGraphModal } from "./NoteLinkGraphModal";

interface NoteLinksPanelProps {
  itemId: string;
  onOpenNote?: (title: string, targetId: string | null) => void;
}

function LinkList({
  links,
  kind,
  onOpenNote,
}: {
  links: NoteLinkDto[];
  kind: "forward" | "backlink";
  onOpenNote?: (title: string, targetId: string | null) => void;
}) {
  const { t } = useTranslation(["library"]);
  if (links.length === 0) {
    return <p className="text-xs text-[var(--muted)]">{t("library:links.none")}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link, index) => {
        const title = kind === "forward" ? link.target_title : link.source_title;
        const targetId = kind === "forward" ? link.target_id : link.source_id;
        const unresolved = kind === "forward" && !link.target_id;
        return (
          <button
            key={`${kind}-${link.source_id}-${link.target_title}-${index}`}
            className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${unresolved ? "border-dashed border-[var(--muted)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]" : "border-[var(--line)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
            type="button"
            data-testid={`reader-${kind === "forward" ? "forward-link" : "backlink"}`}
            data-note-target={title}
            onClick={() => onOpenNote?.(title, targetId)}
            title={unresolved ? t("library:links.unresolved") : title}
          >
            <span className="truncate">{title}</span>
            {unresolved && <span aria-hidden="true">+</span>}
          </button>
        );
      })}
    </div>
  );
}

export function NoteLinksPanel({ itemId, onOpenNote }: NoteLinksPanelProps) {
  const { t } = useTranslation(["library"]);
  const [forwardLinks, setForwardLinks] = useState<NoteLinkDto[]>([]);
  const [backlinks, setBacklinks] = useState<NoteLinkDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([getNoteLinks(itemId), getNoteBacklinks(itemId)])
      .then(([nextForwardLinks, nextBacklinks]) => {
        if (cancelled) return;
        setForwardLinks(nextForwardLinks);
        setBacklinks(nextBacklinks);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  return (
    <>
      <section className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4" data-testid="reader-note-links">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--text)]">{t("library:links.title")}</h3>
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--field)] px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
            type="button"
            data-testid="reader-note-graph-btn"
            onClick={() => setGraphOpen(true)}
          >
            <Network className="h-3.5 w-3.5" />
            {t("library:links.graph")}
          </button>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]" data-testid="reader-note-links-loading">
            <RotateCw className="h-3.5 w-3.5 animate-spin" />
            {t("library:links.loading")}
          </div>
        )}
        {error && <p className="text-xs text-red-400">{t("library:links.loadFailed")}</p>}
        {!loading && !error && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium text-[var(--muted)]">{t("library:links.forward")}</div>
              <LinkList links={forwardLinks} kind="forward" onOpenNote={onOpenNote} />
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-[var(--muted)]">{t("library:links.backlinks")}</div>
              <LinkList links={backlinks} kind="backlink" onOpenNote={onOpenNote} />
            </div>
          </div>
        )}
      </section>
      <NoteLinkGraphModal open={graphOpen} onClose={() => setGraphOpen(false)} />
    </>
  );
}
