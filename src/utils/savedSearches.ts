import type { SearchMode, SearchScope } from "../services/tauriCommands";
import type { ItemType } from "../types";
import type { NotePriority } from "./frontmatter";

export type SavedSearchTimeRange = "all" | "today" | "7d" | "30d";
export type SavedSearchStatus = "all" | "incomplete" | string;
export type SavedSearchItemType = "all" | ItemType;

export interface SavedSearchCriteria {
  query: string;
  activeTab: "recent" | "pinned" | "favorite";
  tag: string;
  sort: "updated" | "created" | "title" | "priority" | "due";
  searchMode: SearchMode;
  searchScopes: SearchScope[];
  status: SavedSearchStatus;
  priority: "all" | NotePriority;
  type: SavedSearchItemType;
  timeRange: SavedSearchTimeRange;
  untagged: boolean;
  hasAttachments: boolean;
}

export interface SavedSearch extends SavedSearchCriteria {
  id: string;
  name: string;
}

export interface SmartCollectionPreset extends SavedSearchCriteria {
  id: string;
  labelKey: string;
}

const DEFAULT_CRITERIA: SavedSearchCriteria = {
  query: "",
  activeTab: "recent",
  tag: "all",
  sort: "updated",
  searchMode: "normal",
  searchScopes: ["content"],
  status: "all",
  priority: "all",
  type: "all",
  timeRange: "all",
  untagged: false,
  hasAttachments: false,
};

export const DEFAULT_SMART_COLLECTIONS: SmartCollectionPreset[] = [
  {
    ...DEFAULT_CRITERIA,
    id: "recently-modified",
    labelKey: "library:collections.recentlyModified",
    timeRange: "7d",
  },
  {
    ...DEFAULT_CRITERIA,
    id: "unclassified",
    labelKey: "library:collections.unclassified",
    untagged: true,
  },
  {
    ...DEFAULT_CRITERIA,
    id: "favorites",
    labelKey: "library:collections.favorites",
    activeTab: "favorite",
  },
  {
    ...DEFAULT_CRITERIA,
    id: "incomplete",
    labelKey: "library:collections.incomplete",
    status: "incomplete",
  },
];

const VALID_TABS = new Set(["recent", "pinned", "favorite"]);
const VALID_SORTS = new Set(["updated", "created", "title", "priority", "due"]);
const VALID_MODES = new Set(["normal", "advanced"]);
const VALID_SCOPES = new Set(["content", "tags", "attachments", "versions"]);
const VALID_TIME_RANGES = new Set(["all", "today", "7d", "30d"]);
const VALID_TYPES = new Set(["all", "note", "link", "file", "image", "code", "task"]);
const VALID_PRIORITIES = new Set(["all", "none", "low", "medium", "high"]);

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeCriteria(value: unknown): SavedSearchCriteria {
  const raw = value && typeof value === "object" ? value as Partial<SavedSearchCriteria> : {};
  const scopes = Array.isArray(raw.searchScopes)
    ? raw.searchScopes.filter((scope): scope is SearchScope => typeof scope === "string" && VALID_SCOPES.has(scope))
    : [];

  return {
    query: asString(raw.query, DEFAULT_CRITERIA.query),
    activeTab: VALID_TABS.has(raw.activeTab as string) ? raw.activeTab as SavedSearchCriteria["activeTab"] : DEFAULT_CRITERIA.activeTab,
    tag: asString(raw.tag, DEFAULT_CRITERIA.tag) || DEFAULT_CRITERIA.tag,
    sort: VALID_SORTS.has(raw.sort as string) ? raw.sort as SavedSearchCriteria["sort"] : DEFAULT_CRITERIA.sort,
    searchMode: VALID_MODES.has(raw.searchMode as string) ? raw.searchMode as SearchMode : DEFAULT_CRITERIA.searchMode,
    searchScopes: scopes.length > 0 ? Array.from(new Set(scopes)) : [...DEFAULT_CRITERIA.searchScopes],
    status: asString(raw.status, DEFAULT_CRITERIA.status) || DEFAULT_CRITERIA.status,
    priority: VALID_PRIORITIES.has(raw.priority as string) ? raw.priority as SavedSearchCriteria["priority"] : DEFAULT_CRITERIA.priority,
    type: VALID_TYPES.has(raw.type as string) ? raw.type as SavedSearchItemType : DEFAULT_CRITERIA.type,
    timeRange: VALID_TIME_RANGES.has(raw.timeRange as string) ? raw.timeRange as SavedSearchTimeRange : DEFAULT_CRITERIA.timeRange,
    untagged: asBoolean(raw.untagged),
    hasAttachments: asBoolean(raw.hasAttachments),
  };
}

export function normalizeSavedSearches(value: unknown): SavedSearch[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: SavedSearch[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Partial<SavedSearch>;
    const id = asString(raw.id, "");
    const name = asString(raw.name, "");
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, name: name.slice(0, 80), ...normalizeCriteria(raw) });
    if (result.length >= 50) break;
  }

  return result;
}

export function createSavedSearchId(): string {
  return `saved-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
