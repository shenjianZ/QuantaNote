import { convertFileSrc } from "@tauri-apps/api/core";

export interface MarkdownAttachment {
  id: string;
  filename: string;
  file_path: string;
  mime_type: string;
}

export const ATTACHMENT_PROTOCOL = "attachment://";

export function isImageAttachment(attachment: Pick<MarkdownAttachment, "mime_type">) {
  return attachment.mime_type.toLowerCase().startsWith("image/");
}

export function isImagePath(path: string) {
  return /\.(?:apng|avif|bmp|gif|ico|jpe?g|jfif|pjpeg|pjp|png|svg|tiff?|webp)$/i.test(path);
}

export function getAttachmentReference(id: string) {
  return `${ATTACHMENT_PROTOCOL}${encodeURIComponent(id)}`;
}

export function getAttachmentIdFromSource(source: string) {
  if (!source.toLowerCase().startsWith(ATTACHMENT_PROTOCOL)) return null;
  const encodedId = source.slice(ATTACHMENT_PROTOCOL.length).split(/[?#]/, 1)[0];
  if (!encodedId) return null;
  try {
    return decodeURIComponent(encodedId);
  } catch {
    return encodedId;
  }
}

export function getAttachmentAssetUrl(attachment: MarkdownAttachment) {
  try {
    return convertFileSrc(attachment.file_path);
  } catch {
    // 浏览器开发模式没有 Tauri runtime 时，保留原路径，避免编辑器初始化失败。
    return attachment.file_path;
  }
}

export function resolveAttachmentSource(
  source: string,
  attachments: readonly MarkdownAttachment[],
) {
  const id = getAttachmentIdFromSource(source);
  if (!id) return source;
  const attachment = attachments.find((candidate) => candidate.id === id);
  return attachment ? getAttachmentAssetUrl(attachment) : source;
}

export function resolveAttachmentReferences(
  markdown: string,
  attachments: readonly MarkdownAttachment[],
) {
  if (!markdown || attachments.length === 0) return markdown;
  return markdown.replace(
    /\]\((attachment:\/\/[^)\s]+)([^)]*)\)/gi,
    (_match, source: string, suffix: string) => `](${resolveAttachmentSource(source, attachments)}${suffix})`,
  );
}

export function normalizeAttachmentReferences(
  markdown: string,
  attachments: readonly MarkdownAttachment[],
) {
  if (!markdown || attachments.length === 0) return markdown;
  return attachments.reduce((value, attachment) => {
    const assetUrl = getAttachmentAssetUrl(attachment);
    return assetUrl && assetUrl !== attachment.file_path
      ? value.split(assetUrl).join(getAttachmentReference(attachment.id))
      : value;
  }, markdown);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

/** Remove image/link nodes that point at an attachment which no longer exists. */
export function removeAttachmentReferences(markdown: string, attachmentId: string) {
  if (!markdown || !attachmentId) return markdown;

  const reference = escapeRegExp(getAttachmentReference(attachmentId));
  const node = `!?\\[(?:\\\\.|[^\\]\\\\])*\\]\\(${reference}(?=[?#\\s)])[^)]*\\)`;
  const standalone = new RegExp(`(^|\\n)[ \\t]*${node}[ \\t]*(?:\\r?\\n|$)`, "gi");
  const inline = new RegExp(node, "gi");
  return markdown
    .replace(standalone, (_match, prefix: string) => prefix)
    .replace(inline, "")
    .replace(/\n{3,}/g, "\n\n");
}

function escapeMarkdownLabel(value: string) {
  return value.replace(/[\\\[\]]/g, "\\$&");
}

export function buildAttachmentMarkdown(
  attachment: Pick<MarkdownAttachment, "id" | "filename">,
  asImage: boolean,
) {
  const filename = escapeMarkdownLabel(attachment.filename);
  const reference = getAttachmentReference(attachment.id);
  return asImage ? `![${filename}](${reference})\n\n` : `[${filename}](${reference})\n\n`;
}
