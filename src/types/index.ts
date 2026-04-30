import type { LucideIcon } from "lucide-react";

export type AppPage =
  | "all"
  | "tags"
  | "document"
  | "settings";

export type ItemType =
  | "note"
  | "link"
  | "file"
  | "image"
  | "code"
  | "task";

export interface Tag {
  name: string;
  color: "cyan" | "green" | "blue" | "purple" | "yellow" | "red";
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  summary: string;
  tags: Tag[];
  time: string;
  icon: LucideIcon;
  accent: string;
  pinned?: boolean;
  favorite?: boolean;
}
