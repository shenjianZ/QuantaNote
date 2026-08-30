import type { LucideIcon } from "lucide-react";
import type { NoteProperties } from "../utils/frontmatter";

export type AppPage =
  | "workspace"
  | "library"
  | "document"
  | "settings"
  | "profile"
  | "language-setup";

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
  createdAt: string;
  updatedAt: string;
  properties: NoteProperties;
}

export interface VersionDto {
  id: string;
  item_id: string;
  version_number: number;
  content: string;
  change_summary: string;
  name: string;
  description: string;
  created_at: string;
}
