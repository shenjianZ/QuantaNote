export type NotePriority = "none" | "low" | "medium" | "high";

export interface NoteProperties {
  status: string;
  priority: NotePriority;
  dueDate: string | null;
  aliases: string[];
}

export type NotePropertyUpdates = Partial<NoteProperties>;

export const DEFAULT_NOTE_PROPERTIES: NoteProperties = {
  status: "inbox",
  priority: "none",
  dueDate: null,
  aliases: [],
};

const MANAGED_KEYS = new Set(["status", "priority", "due", "due_date", "deadline", "alias", "aliases"]);
const FRONTMATTER_PATTERN = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/;
const YAML_KEY_PATTERN = /^\s*([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*$/;

interface FrontmatterBlock {
  header: string;
  body: string;
}

function getFrontmatterBlock(content: string): FrontmatterBlock | null {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) return null;
  const hasYamlKey = match[1].split(/\r?\n/).some((line) => YAML_KEY_PATTERN.test(line));
  return hasYamlKey ? { header: match[1], body: match[2] } : null;
}

function cleanScalar(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"');
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

function parseAliases(value: string): string[] {
  const cleaned = cleanScalar(value);
  if (!cleaned) return [];
  const values = cleaned.startsWith("[") && cleaned.endsWith("]")
    ? cleaned.slice(1, -1).split(",")
    : [cleaned];
  return Array.from(new Set(values.map(cleanScalar).map((item) => item.trim()).filter(Boolean)));
}

function normalizePriority(value: string): NotePriority {
  switch (cleanScalar(value).toLowerCase()) {
    case "1":
    case "low":
      return "low";
    case "2":
    case "medium":
    case "normal":
      return "medium";
    case "3":
    case "high":
    case "urgent":
    case "critical":
      return "high";
    default:
      return "none";
  }
}

function normalizeStatus(value: string): string {
  const normalized = cleanScalar(value).toLowerCase().replace(/[\s_]+/g, "-");
  if (!normalized) return DEFAULT_NOTE_PROPERTIES.status;
  if (normalized === "todo") return "inbox";
  if (["doing", "active", "in-progress"].includes(normalized)) return "in-progress";
  if (["complete", "completed"].includes(normalized)) return "done";
  return normalized;
}

function normalizeDueDate(value: string): string | null {
  const cleaned = cleanScalar(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : null;
}

export function parseNoteProperties(content: string): NoteProperties {
  const block = getFrontmatterBlock(content);
  if (!block) return { ...DEFAULT_NOTE_PROPERTIES, aliases: [] };

  let status = DEFAULT_NOTE_PROPERTIES.status;
  let priority = DEFAULT_NOTE_PROPERTIES.priority;
  let dueDate: string | null = null;
  let aliases: string[] = [];
  const lines = block.header.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(YAML_KEY_PATTERN);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2];
    if (key === "status") status = normalizeStatus(value);
    if (key === "priority") priority = normalizePriority(value);
    if (["due", "due_date", "deadline"].includes(key)) dueDate = normalizeDueDate(value);
    if (key === "alias") aliases = parseAliases(value);
    if (key === "aliases") {
      aliases = value ? parseAliases(value) : [];
      if (!value) {
        const listValues: string[] = [];
        for (let next = index + 1; next < lines.length; next += 1) {
          const listMatch = lines[next].match(/^\s*-\s+(.+?)\s*$/);
          if (!listMatch) break;
          listValues.push(cleanScalar(listMatch[1]));
          index = next;
        }
        aliases = Array.from(new Set(listValues.filter(Boolean)));
      }
    }
  }

  return { status, priority, dueDate, aliases };
}

export function stripFrontmatter(content: string): string {
  return getFrontmatterBlock(content)?.body ?? content;
}

export function hasNoteProperties(properties: NoteProperties): boolean {
  return properties.status !== DEFAULT_NOTE_PROPERTIES.status
    || properties.priority !== DEFAULT_NOTE_PROPERTIES.priority
    || properties.dueDate !== null
    || properties.aliases.length > 0;
}

function removeManagedFields(header: string): string[] {
  const lines = header.split(/\r?\n/);
  const result: string[] = [];
  let skippingAliasList = false;

  for (const line of lines) {
    if (skippingAliasList) {
      if (/^\s*-\s+/.test(line)) continue;
      skippingAliasList = false;
    }

    const match = line.match(YAML_KEY_PATTERN);
    if (match && MANAGED_KEYS.has(match[1].toLowerCase())) {
      skippingAliasList = match[1].toLowerCase() === "aliases" && !match[2];
      continue;
    }
    result.push(line);
  }

  return result.filter((line, index, all) => line.trim() !== "" || (index > 0 && index < all.length - 1));
}

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}

function buildManagedFields(properties: NoteProperties): string[] {
  const fields: string[] = [];
  if (properties.status !== DEFAULT_NOTE_PROPERTIES.status) fields.push(`status: ${quoteYaml(properties.status)}`);
  if (properties.priority !== DEFAULT_NOTE_PROPERTIES.priority) fields.push(`priority: ${properties.priority}`);
  if (properties.dueDate) fields.push(`due: ${properties.dueDate}`);
  if (properties.aliases.length > 0) {
    fields.push("aliases:");
    properties.aliases.forEach((alias) => fields.push(`  - ${quoteYaml(alias)}`));
  }
  return fields;
}

export function updateNoteProperties(content: string, updates: NotePropertyUpdates): string {
  const current = parseNoteProperties(content);
  const next: NoteProperties = {
    status: updates.status === undefined ? current.status : normalizeStatus(updates.status),
    priority: updates.priority === undefined ? current.priority : normalizePriority(updates.priority),
    dueDate: updates.dueDate === undefined ? current.dueDate : normalizeDueDate(updates.dueDate ?? ""),
    aliases: updates.aliases === undefined
      ? [...current.aliases]
      : Array.from(new Set(updates.aliases.map((alias) => alias.trim()).filter(Boolean))),
  };
  const block = getFrontmatterBlock(content);
  const unknownFields = block ? removeManagedFields(block.header) : [];
  const headerFields = [...unknownFields, ...buildManagedFields(next)].filter((line) => line.trim() !== "");

  if (headerFields.length === 0) return block?.body ?? content;
  const header = `---\n${headerFields.join("\n")}\n---\n`;
  return `${header}${block?.body ?? content}`;
}
