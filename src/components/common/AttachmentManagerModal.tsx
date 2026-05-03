import { useCallback, useEffect, useState } from "react";
import { FileText, FolderOpen, Music, Plus, Trash2, Video, X } from "lucide-react";
import { openPath } from "@tauri-apps/plugin-opener";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Modal } from "./Modal";
import { useAttachmentStore } from "../../stores/attachmentStore";
import { useToastStore } from "../../stores/toastStore";

interface AttachmentManagerModalProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
}

type FileCategory = "image" | "audio" | "video" | "pdf" | "text" | "other";

interface PreviewState {
  type: FileCategory;
  filePath: string;
  filename: string;
  textContent?: string;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toAssetUrl(filePath: string) {
  return convertFileSrc(filePath);
}

function getFileCategory(mime: string): FileCategory {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("text/") || mime === "application/json") return "text";
  return "other";
}

function getCategoryIcon(category: FileCategory) {
  switch (category) {
    case "audio": return Music;
    case "video": return Video;
    default: return FileText;
  }
}

function getCategoryLabel(category: FileCategory, t: (key: string) => string) {
  switch (category) {
    case "image": return t("modals:attachment.categories.image");
    case "audio": return t("modals:attachment.categories.audio");
    case "video": return t("modals:attachment.categories.video");
    case "pdf": return t("modals:attachment.categories.pdf");
    case "text": return t("modals:attachment.categories.text");
    default: return t("modals:attachment.categories.other");
  }
}

function getExtension(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export function AttachmentManagerModal({ open: isOpen, onClose, itemId }: AttachmentManagerModalProps) {
  const { t } = useTranslation(["modals", "common"]);
  const attachments = useAttachmentStore((s) => s.attachments);
  const fetchAttachments = useAttachmentStore((s) => s.fetchAttachments);
  const addAttachment = useAttachmentStore((s) => s.addAttachment);
  const deleteAttachment = useAttachmentStore((s) => s.deleteAttachment);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  useEffect(() => {
    if (isOpen && itemId) {
      fetchAttachments(itemId);
    }
  }, [isOpen, itemId, fetchAttachments]);

  async function handleAddFile() {
    const selected = await openDialog({
      multiple: false,
      title: t("modals:attachment.selectFile"),
    });
    if (selected) {
      try {
        await addAttachment(itemId, selected);
      } catch {
        useToastStore.getState().addToast("error", t("common:toast.attachmentAddFailed"));
      }
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAttachment(id);
    } catch {
      useToastStore.getState().addToast("error", t("common:toast.attachmentDeleteFailed"));
    }
  }

  async function handlePreview(filePath: string, filename: string, mime: string) {
    const category = getFileCategory(mime);
    if (category === "text") {
      setLoadingText(true);
      try {
        const content = await invoke<string>("read_from_file", { path: filePath });
        setPreview({ type: category, filePath, filename, textContent: content });
      } catch {
        setPreview({ type: category, filePath, filename, textContent: t("common:error.cannotReadFile") });
      }
      setLoadingText(false);
    } else if (category === "other") {
      await openPath(filePath);
    } else {
      setPreview({ type: category, filePath, filename });
    }
  }

  const handleClosePreview = useCallback(() => {
    setPreview(null);
    setLoadingText(false);
  }, []);

  useEffect(() => {
    if (!preview) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClosePreview();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [preview, handleClosePreview]);

  return (
    <>
      <Modal open={isOpen && !preview} onClose={onClose} title={t("modals:attachment.title")} maxWidth="max-w-lg">
        <div className="space-y-3">
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm text-white hover:opacity-90"
            type="button"
            data-testid="attachment-add-btn"
            onClick={handleAddFile}
          >
            <Plus className="h-4 w-4" />
            {t("modals:attachment.addFile")}
          </button>

          {attachments.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--muted)]">{t("modals:attachment.noAttachments")}</p>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => {
                const category = getFileCategory(att.mime_type);
                const Icon = category === "image" ? null : getCategoryIcon(category);
                const ext = getExtension(att.filename);
                return (
                  <div key={att.id} className="group flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--field)] p-3 transition hover:border-[var(--accent)]/30" data-testid="attachment-item">
                    {/* Thumbnail or icon */}
                    {category === "image" ? (
                      <button
                        type="button"
                        className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[var(--line)]"
                        onClick={() => handlePreview(att.file_path, att.filename, att.mime_type)}
                      >
                        <img
                          src={toAssetUrl(att.file_path)}
                          alt={att.filename}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-[var(--hover)]"
                        onClick={() => handlePreview(att.file_path, att.filename, att.mime_type)}
                        title={category === "other" ? t("modals:attachment.openWithSystem") : t("modals:attachment.preview")}
                      >
                        {ext ? (
                          <span className="text-2xs font-bold uppercase text-[var(--muted)]">{ext}</span>
                        ) : Icon ? (
                          <Icon className="h-5 w-5 text-[var(--muted)]" />
                        ) : (
                          <FileText className="h-5 w-5 text-[var(--muted)]" />
                        )}
                      </button>
                    )}

                    {/* File info */}
                    <div className="min-w-0 flex-1">
                      <button
                        className="w-full truncate text-left text-sm font-medium text-[var(--text)] hover:underline"
                        type="button"
                        onClick={() => handlePreview(att.file_path, att.filename, att.mime_type)}
                      >
                        {att.filename}
                      </button>
                      <p className="text-xs text-[var(--muted)]">
                        {formatFileSize(att.file_size)} · {getCategoryLabel(category, t)}
                        {ext && ` · .${ext}`}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        className="rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                        type="button"
                        onClick={() => openPath(att.file_path)}
                        title={t("modals:attachment.openWithSystem")}
                      >
                        <FolderOpen className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-full p-1.5 text-[var(--muted)] hover:bg-red-500/10 hover:text-red-400"
                        type="button"
                        onClick={() => handleDelete(att.id)}
                        title={t("modals:attachment.deleteAttachment")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {loadingText && (
            <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 backdrop-blur-sm">
              <div className="rounded-2xl bg-[var(--popover)] px-6 py-4 text-sm text-[var(--text)]">
                {t("modals:attachment.loading")}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Preview overlay */}
      {preview && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/40 backdrop-blur-sm"
          onClick={handleClosePreview}
        >
          <div
            className={`flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--popover)] shadow-2xl ${
              preview.type === "pdf" ? "h-[75vh] w-[85vw] max-w-4xl" :
              preview.type === "video" ? "w-[85vw] max-w-3xl" :
              preview.type === "text" ? "h-[70vh] w-[85vw] max-w-2xl" :
              preview.type === "audio" ? "w-80" :
              "max-h-[80vh] max-w-2xl"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-2xs font-medium text-[var(--accent)]">
                  {getCategoryLabel(preview.type, t)}
                </span>
                <span className="truncate text-sm text-[var(--text)]">{preview.filename}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  className="rounded-full px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                  type="button"
                  onClick={() => openPath(preview.filePath)}
                >
                  {t("modals:attachment.openWithSystem")}
                </button>
                <button
                  className="grid h-7 w-7 place-items-center rounded-full bg-[var(--field)] text-[var(--text)] hover:bg-[var(--hover)]"
                  type="button"
                  onClick={handleClosePreview}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Preview content */}
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
              {preview.type === "image" && (
                <img
                  src={toAssetUrl(preview.filePath)}
                  alt={preview.filename}
                  className="max-h-full max-w-full rounded-lg object-contain"
                />
              )}

              {preview.type === "audio" && (
                <div className="w-full py-4">
                  <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-soft)] mx-auto">
                    <Music className="h-7 w-7 text-[var(--accent)]" />
                  </div>
                  <p className="mb-4 text-center text-sm font-medium text-[var(--text)]">{preview.filename}</p>
                  <audio controls src={toAssetUrl(preview.filePath)} className="mx-auto w-full" autoPlay />
                </div>
              )}

              {preview.type === "video" && (
                <video
                  controls
                  src={toAssetUrl(preview.filePath)}
                  className="max-h-full w-full rounded-lg"
                  autoPlay
                />
              )}

              {preview.type === "pdf" && (
                <iframe
                  src={toAssetUrl(preview.filePath)}
                  className="h-full w-full rounded-lg"
                  title={preview.filename}
                />
              )}

              {preview.type === "text" && (
                <pre className="h-full w-full overflow-auto p-3 text-sm leading-relaxed text-[var(--text)] font-mono whitespace-pre-wrap break-all">
                  {preview.textContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
