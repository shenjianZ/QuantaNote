import { invoke } from "@tauri-apps/api/core";

// Types
interface AttachmentResult {
  id: string;
  item_id: string;
  filename: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

// Item commands
export async function createItem(title: string, itemType: string, content?: string) {
  return invoke("create_item", { title, itemType, content: content ?? null });
}

export async function getItems(itemType?: string, limit?: number, offset?: number) {
  return invoke("get_items", { itemType: itemType ?? null, limit: limit ?? 50, offset: offset ?? 0 });
}

export async function getItem(id: string) {
  return invoke("get_item", { id });
}

export async function updateItem(id: string, updates: Record<string, unknown>) {
  return invoke("update_item", { id, ...updates });
}

export async function deleteItem(id: string) {
  return invoke("delete_item", { id });
}

export async function getRecentItems(limit?: number) {
  return invoke("get_recent_items", { limit: limit ?? 20 });
}

// Search commands
export async function searchItems(query: string) {
  return invoke("search_items", { query });
}

// Attachment commands
export async function addAttachment(itemId: string, path: string) {
  return invoke<AttachmentResult>("add_attachment", { itemId, path });
}

export async function getAttachments(itemId: string) {
  return invoke("get_attachments", { itemId });
}

export async function deleteAttachment(id: string) {
  return invoke("delete_attachment", { id });
}

// Version commands
export async function getVersions(itemId: string) {
  return invoke("get_versions", { itemId });
}

export async function createVersion(itemId: string, content: string, changeSummary?: string) {
  return invoke("create_version", { itemId, content, changeSummary: changeSummary ?? null });
}

// Tag commands
interface TagDto {
  name: string;
  color: string;
}

export async function getAllTags() {
  return invoke<TagDto[]>("get_all_tags");
}

export async function createTag(name: string, color: string) {
  return invoke<TagDto>("create_tag", { name, color });
}

export async function deleteTag(name: string) {
  return invoke("delete_tag", { name });
}

export async function getItemTags(itemId: string) {
  return invoke<TagDto[]>("get_item_tags", { itemId });
}

export async function setItemTags(itemId: string, tagNames: string[]) {
  return invoke("set_item_tags", { itemId, tagNames });
}

export async function getAllItemTagMappings() {
  return invoke<[string, string][]>("get_all_item_tag_mappings");
}
