import type { LucideIcon } from "lucide-react";

export type AppPage =
  | "home"
  | "all"
  | "tags"
  | "vault"
  | "files"
  | "document"
  | "sync"
  | "versions"
  | "settings";

export type ItemType =
  | "note"
  | "password"
  | "link"
  | "file"
  | "image"
  | "code"
  | "task"
  | "command"
  | "secret";

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
  encrypted?: boolean;
  pinned?: boolean;
  favorite?: boolean;
}

export interface Metric {
  label: string;
  value: string;
  delta: string;
  tone: "cyan" | "purple" | "yellow" | "blue";
}

export interface Activity {
  title: string;
  detail: string;
  time: string;
  tone: string;
}
