import { useEffect, useState } from "react";
import { FileText, FolderOpen, Music, Plus, Trash2, Video, X } from "lucide-react";
import { openPath } from "@tauri-apps/plugin-opener";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Modal } from "./Modal";
import { useAttachmentStore } from "../../stores/attachmentStore";

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

function getCategoryLabel(category: FileCategory) {
  switch (category) {
    case "image": return "图片";
    case "audio": return "音频";
    case "video": return "视频";
    case "pdf": return "PDF";
    case "text": return "文本";
    default: return "文件";
  }
}

function getExtension(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export function AttachmentManagerModal({ open: isOpen, onClose, itemId }: AttachmentManagerModalProps) {
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
      title: "选择附件",
    });
    if (selected) {
      await addAttachment(itemId, selected);
    }
  }

  async function handleDelete(id: string) {
    await deleteAttachment(id);
  }

  async function handlePreview(filePath: string, filename: string, mime: string) {
    const category = getFileCategory(mime);
    if (category === "text") {
      setLoadingText(true);
      try {
        const content = await invoke<string>("read_from_file", { path: filePath });
        setPreview({ type: category, filePath, filename, textContent: content });
      } catch {
        setPreview({ type: category, filePath, filename, textContent: "无法读取文件内容" });
      }
      setLoadingText(false);
    } else if (category === "other") {
      await openPath(filePath);
    } else {
      setPreview({ type: category, filePath, filename });
    }
  }

  function handleClosePreview() {
    setPreview(null);
    setLoadingText(false);
  }

  return (
    <>
      <Modal open={isOpen && !preview} onClose={onClose} title="管理附件" maxWidth="max-w-lg">
        <div className="space-y-3">
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm text-white hover:opacity-90"
            type="button"
            onClick={handleAddFile}
          >
            <Plus className="h-4 w-4" />
            添加文件
          </button>

          {attachments.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--muted)]">暂无附件</p>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => {
                const category = getFileCategory(att.mime_type);
                const Icon = category === "image" ? null : getCategoryIcon(category);
                const ext = getExtension(att.filename);
                return (
                  <div key={att.id} className="group flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--field)] p-3 transition hover:border-[var(--accent)]/30">
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
                        title={category === "other" ? "用系统应用打开" : "预览"}
                      >
                        {ext ? (
                          <span className="text-[10px] font-bold uppercase text-[var(--muted)]">{ext}</span>
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
                        {formatFileSize(att.file_size)} · {getCategoryLabel(category)}
                        {ext && ` · .${ext}`}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        className="rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                        type="button"
                        onClick={() => openPath(att.file_path)}
                        title="用系统应用打开"
                      >
                        <FolderOpen className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-full p-1.5 text-[var(--muted)] hover:bg-red-500/10 hover:text-red-400"
                        type="button"
                        onClick={() => handleDelete(att.id)}
                        title="删除附件"
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
                加载中...
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Preview overlay */}
      {preview && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/70 backdrop-blur-sm"
          onClick={handleClosePreview}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between px-4 py-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                {getCategoryLabel(preview.type)}
              </span>
              <span className="truncate text-sm font-medium text-white">{preview.filename}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="rounded-full px-3 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"
                type="button"
                onClick={() => openPath(preview.filePath)}
              >
                打开文件
              </button>
              <button
                className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                type="button"
                onClick={handleClosePreview}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4" onClick={(e) => e.stopPropagation()}>
            {preview.type === "image" && (
              <img
                src={toAssetUrl(preview.filePath)}
                alt={preview.filename}
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
              />
            )}

            {preview.type === "audio" && (
              <div className="w-full max-w-md rounded-2xl bg-[var(--popover)] p-6 shadow-2xl">
                <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[var(--accent-soft)] mx-auto">
                  <Music className="h-8 w-8 text-[var(--accent)]" />
                </div>
                <p className="mb-4 text-center text-sm font-medium text-[var(--text)]">{preview.filename}</p>
                <audio
                  controls
                  src={toAssetUrl(preview.filePath)}
                  className="w-full"
                  autoPlay
                />
              </div>
            )}

            {preview.type === "video" && (
              <video
                controls
                src={toAssetUrl(preview.filePath)}
                className="max-h-full max-w-full rounded-xl shadow-2xl"
                autoPlay
              />
            )}

            {preview.type === "pdf" && (
              <iframe
                src={toAssetUrl(preview.filePath)}
                className="h-full w-full max-w-4xl rounded-xl border border-white/10 shadow-2xl"
                title={preview.filename}
              />
            )}

            {preview.type === "text" && (
              <div className="flex max-h-full w-full max-w-3xl flex-col rounded-2xl bg-[var(--popover)] shadow-2xl">
                <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] px-4 py-2">
                  <FileText className="h-4 w-4 text-[var(--muted)]" />
                  <span className="text-xs text-[var(--muted)]">{getExtension(preview.filename).toUpperCase() || "TEXT"}</span>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto p-4 text-sm leading-relaxed text-[var(--text)] font-mono whitespace-pre-wrap break-all">
                  {preview.textContent}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
