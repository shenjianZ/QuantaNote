import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../common/Modal";
import { getNoteLinkGraph, type NoteLinkGraphDto } from "../../services/tauriCommands";

interface NoteLinkGraphModalProps {
  open: boolean;
  onClose: () => void;
}

const GRAPH_WIDTH = 720;
const GRAPH_HEIGHT = 420;

function shorten(value: string, maxLength = 18): string {
  const chars = Array.from(value);
  return chars.length > maxLength ? `${chars.slice(0, maxLength - 1).join("")}…` : value;
}

export function NoteLinkGraphModal({ open, onClose }: NoteLinkGraphModalProps) {
  const { t } = useTranslation(["library", "common"]);
  const [graph, setGraph] = useState<NoteLinkGraphDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    getNoteLinkGraph()
      .then((result) => {
        if (!cancelled) setGraph(result);
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
  }, [open]);

  const positions = useMemo(() => {
    if (!graph) return new Map<string, { x: number; y: number }>();
    const radius = Math.min(155, Math.max(72, graph.nodes.length * 22));
    return new Map(graph.nodes.map((node, index) => {
      if (graph.nodes.length === 1) return [node.id, { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 }] as const;
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / graph.nodes.length;
      return [node.id, {
        x: GRAPH_WIDTH / 2 + Math.cos(angle) * radius,
        y: GRAPH_HEIGHT / 2 + Math.sin(angle) * radius,
      }] as const;
    }));
  }, [graph]);

  const resolvedEdges = graph?.edges.filter((edge) => edge.target_id && positions.has(edge.source_id) && positions.has(edge.target_id)) ?? [];
  const unresolvedEdges = graph?.edges.filter((edge) => !edge.target_id) ?? [];

  return (
    <Modal open={open} onClose={onClose} title={t("library:links.graphTitle")} maxWidth="max-w-3xl">
      <div data-testid="note-link-graph">
        {loading && <div className="py-12 text-center text-sm text-[var(--muted)]">{t("library:links.loading")}</div>}
        {error && <div className="py-12 text-center text-sm text-red-400">{t("library:links.loadFailed")}</div>}
        {!loading && !error && graph && graph.nodes.length === 0 && (
          <div className="py-12 text-center text-sm text-[var(--muted)]">{t("library:links.graphEmpty")}</div>
        )}
        {!loading && !error && graph && graph.nodes.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--field)] p-2">
              <svg
                className="mx-auto min-w-[34rem]"
                viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                role="img"
                aria-label={t("library:links.graphTitle")}
                data-testid="note-link-graph-svg"
              >
                <defs>
                  <marker id="note-link-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L8,4 L0,8 z" fill="var(--accent)" />
                  </marker>
                </defs>
                {resolvedEdges.map((edge, index) => {
                  const source = positions.get(edge.source_id)!;
                  const target = positions.get(edge.target_id!)!;
                  return (
                    <line
                      key={`${edge.source_id}-${edge.target_id}-${index}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke="var(--accent)"
                      strokeOpacity="0.55"
                      strokeWidth="1.5"
                      markerEnd="url(#note-link-arrow)"
                    />
                  );
                })}
                {graph.nodes.map((node) => {
                  const point = positions.get(node.id)!;
                  return (
                    <g key={node.id} transform={`translate(${point.x}, ${point.y})`}>
                      <circle r="30" fill="var(--paper)" stroke="var(--accent)" strokeWidth="2" />
                      <text textAnchor="middle" dominantBaseline="central" fill="var(--text)" fontSize="11">
                        {shorten(node.title)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            {unresolvedEdges.length > 0 && (
              <p className="mt-3 text-xs text-[var(--muted)]" data-testid="note-link-graph-unresolved">
                {t("library:links.unresolvedCount", { count: unresolvedEdges.length })}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
