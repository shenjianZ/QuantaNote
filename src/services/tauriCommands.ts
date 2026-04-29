import { invoke } from "@tauri-apps/api/core";

interface UnlockResult {
  unlocked: boolean;
}

interface SyncResult {
  status: string;
  message: string;
}

interface AttachmentResult {
  id: string;
  item_id: string;
  path: string;
}

export async function createItem(title: string, itemType: string) {
  return invoke("create_item", { title, itemType });
}

export async function searchItems(query: string) {
  return invoke("search_items", { query });
}

export async function unlockVault(password: string) {
  const result = await invoke<UnlockResult>("unlock_vault", { password });
  return result.unlocked;
}

export async function syncNow() {
  return invoke<SyncResult>("sync_now");
}

export async function addAttachment(itemId: string, path: string) {
  return invoke<AttachmentResult>("add_attachment", { itemId, path });
}
