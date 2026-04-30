import {
  BookOpen,
  Braces,
  FileText,
  Folder,
  Image,
  Link,
} from "lucide-react";
import type { Item, ItemType, Tag } from "../types";
import type { ItemDto } from "../stores/itemStore";

const TYPE_TO_ICON: Record<string, typeof FileText> = {
  note: FileText,
  link: Link,
  file: Folder,
  image: Image,
  code: Braces,
  task: BookOpen,
};

const TYPE_TO_ACCENT: Record<string, string> = {
  note: "cyan",
  link: "blue",
  file: "yellow",
  image: "purple",
  code: "cyan",
  task: "green",
};

function formatRelativeTime(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} 小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay} 天前`;
    return date.toLocaleDateString("zh-CN");
  } catch {
    return isoDate;
  }
}

export function adaptItem(dto: ItemDto): Item {
  const itemType = (dto.item_type || "note") as ItemType;
  return {
    id: dto.id,
    type: itemType,
    title: dto.title,
    summary: dto.summary || dto.content?.slice(0, 60) || "",
    tags: [] as Tag[],
    time: formatRelativeTime(dto.updated_at || dto.created_at),
    icon: TYPE_TO_ICON[dto.item_type] ?? FileText,
    accent: TYPE_TO_ACCENT[dto.item_type] ?? "cyan",
    pinned: dto.pinned,
    favorite: dto.favorite,
  };
}
