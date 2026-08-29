import { convertFileSrc } from "@tauri-apps/api/core";

export interface MarkdownAttachment {
  id: string;
  filename: string;
  file_path: string;
  mime_type: string;
}

export type AttachmentImageAlignment = "left" | "center" | "right";

export interface AttachmentImageOptions {
  width?: number;
  align?: AttachmentImageAlignment;
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

function getImageMetadata(source: string) {
  const hashIndex = source.indexOf("#");
  if (hashIndex < 0) return null;
  const fragment = source.slice(hashIndex + 1);
  const params = new URLSearchParams(fragment);
  if (!params.has("qn-width") && !params.has("qn-align")) return null;
  return params;
}

export function getAttachmentImageOptions(source: string): AttachmentImageOptions {
  const params = getImageMetadata(source);
  if (!params) return {};

  const widthValue = Number(params.get("qn-width"));
  const width = Number.isFinite(widthValue) && widthValue >= 40 && widthValue <= 4000
    ? Math.round(widthValue)
    : undefined;
  const alignValue = params.get("qn-align");
  const align = alignValue === "center" || alignValue === "right" || alignValue === "left"
    ? alignValue
    : undefined;
  return { width, align };
}

export function withAttachmentImageOptions(source: string, options: AttachmentImageOptions) {
  const baseSource = source.split("#", 1)[0];
  const params = new URLSearchParams();
  if (options.width && Number.isFinite(options.width)) {
    params.set("qn-width", String(Math.round(options.width)));
  }
  if (options.align && options.align !== "left") {
    params.set("qn-align", options.align);
  }
  const fragment = params.toString();
  return fragment ? `${baseSource}#${fragment}` : baseSource;
}

export function getAttachmentImageStyle(options: AttachmentImageOptions): Record<string, string> {
  const style: Record<string, string> = {};
  if (options.width) {
    style.width = `${options.width}px`;
    style.maxWidth = "100%";
  }
  if (options.align) {
    style.display = "block";
    style.marginLeft = options.align === "right" ? "auto" : options.align === "center" ? "auto" : "0";
    style.marginRight = options.align === "left" ? "auto" : options.align === "center" ? "auto" : "0";
  }
  return style;
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
  if (!attachment) return source;
  const hashIndex = source.indexOf("#");
  const suffix = hashIndex >= 0 ? source.slice(hashIndex) : "";
  return `${getAttachmentAssetUrl(attachment)}${suffix}`;
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
