import { invoke } from "@tauri-apps/api/core";

// Types
export interface AttachmentResult {
    id: string;
    item_id: string;
    filename: string;
    file_path: string;
    mime_type: string;
    file_size: number;
    created_at: string;
}

export interface StorageIssue {
    path: string;
    attachmentId?: string;
    itemId?: string;
    filename?: string;
    sizeBytes: number;
    reason: string;
}

export interface StorageConsistencyReport {
    missingFiles: StorageIssue[];
    orphanFiles: StorageIssue[];
    brokenReferences: StorageIssue[];
    scannedFiles: number;
    storageBytes: number;
}

// Item commands
export async function createItem(
    title: string,
    itemType: string,
    content?: string,
) {
    return invoke("create_item", { title, itemType, content: content ?? null });
}

export async function getItems(
    itemType?: string,
    limit?: number,
    offset?: number,
) {
    return invoke("get_items", {
        itemType: itemType ?? null,
        limit: limit ?? 50,
        offset: offset ?? 0,
    });
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

export async function getTrashItems() {
    return invoke<TrashItemDto[]>("get_trash_items");
}

export async function restoreItem(id: string) {
    return invoke<ItemDto>("restore_item", { id });
}

export async function permanentlyDeleteItem(id: string) {
    return invoke("permanently_delete_item", { id });
}

export async function cleanupTrash(olderThanDays?: number) {
    return invoke<number>("cleanup_trash", { olderThanDays: olderThanDays ?? 30 });
}

export async function getRecentItems(limit?: number) {
    return invoke("get_recent_items", { limit: limit ?? 20 });
}

export type SummaryMode = "auto" | "manual";

export async function regenerateSummary(itemId: string) {
    return invoke<ItemDto>("regenerate_summary", { id: itemId });
}

// Search commands
export type SearchMode = "normal" | "advanced";
export type SearchScope = "content" | "tags" | "attachments" | "versions";

export interface SearchPageOptions {
    tab?: "recent" | "pinned" | "favorite";
    tag?: string;
    sort?: "updated" | "created" | "title";
    mode?: SearchMode;
    scopes?: SearchScope[];
    limit?: number;
    offset?: number;
}

export interface SearchResultDto {
    id: string;
    title: string;
    item_type: string;
    summary: string;
    created_at?: string;
    updated_at?: string;
    pinned?: boolean;
    favorite?: boolean;
    matched_fields?: string[];
    context?: string;
    highlight_terms?: string[];
}

export interface SearchPageDto {
    results: SearchResultDto[];
    total: number;
}

export async function searchItems(
    query: string,
    itemType?: string,
    options: SearchPageOptions = {},
) {
    return invoke<SearchPageDto>("search_items", {
        query,
        itemType: itemType ?? null,
        tab: options.tab ?? null,
        tag: options.tag ?? null,
        sort: options.sort ?? null,
        mode: options.mode ?? "normal",
        scopes: options.scopes ?? ["content"],
        limit: options.limit ?? 50,
        offset: options.offset ?? 0,
    });
}

// Attachment commands
export async function addAttachment(itemId: string, path: string) {
    return invoke<AttachmentResult>("add_attachment", { itemId, path });
}

export async function addAttachmentData(
    itemId: string,
    filename: string,
    mimeType: string,
    data: string,
) {
    return invoke<AttachmentResult>("add_attachment_data", {
        itemId,
        filename,
        mimeType,
        data,
    });
}

export interface ItemPageDto {
    items: ItemDto[];
    total: number;
}

export interface ItemPageOptions {
    tab?: "recent" | "pinned" | "favorite";
    tag?: string;
    sort?: "updated" | "created" | "title";
    limit?: number;
    offset?: number;
}

export async function getItemsPage(options: ItemPageOptions = {}) {
    return invoke<ItemPageDto>("get_items_page", {
        itemType: null,
        tab: options.tab ?? "recent",
        tag: options.tag ?? "all",
        sort: options.sort ?? "updated",
        limit: options.limit ?? 50,
        offset: options.offset ?? 0,
    });
}

export async function getAttachments(itemId: string) {
    return invoke("get_attachments", { itemId });
}

export async function deleteAttachment(id: string) {
    return invoke("delete_attachment", { id });
}

export async function exportAttachment(sourcePath: string, destinationPath: string) {
    return invoke("export_attachment", { sourcePath, destinationPath });
}

export async function getStorageConsistencyReport() {
    return invoke<StorageConsistencyReport>("get_storage_consistency_report");
}

export async function repairStorageConsistency() {
    return invoke<StorageConsistencyReport>("repair_storage_consistency");
}

// Version commands
export async function getVersions(itemId: string) {
    return invoke("get_versions", { itemId });
}

export async function createVersion(
    itemId: string,
    content: string,
    changeSummary?: string,
    name?: string,
    description?: string,
) {
    return invoke("create_version", {
        itemId,
        content,
        changeSummary: changeSummary ?? null,
        name: name ?? null,
        description: description ?? null,
    });
}

export async function updateVersion(
    id: string,
    name: string,
    description: string,
) {
    return invoke("update_version", { id, name, description });
}

export async function restoreVersion(versionId: string) {
    return invoke("restore_version", { versionId });
}

export async function deleteVersion(versionId: string) {
    return invoke("delete_version", { versionId });
}

// Item DTO
export interface ItemDto {
    id: string;
    title: string;
    item_type: string;
    content: string;
    summary: string;
    summary_mode?: SummaryMode;
    pinned: boolean;
    favorite: boolean;
    encrypted: boolean;
    created_at: string;
    updated_at: string;
}

export interface TrashItemDto {
    item: ItemDto;
    deleted_at: string;
}

// Tag commands
export interface TagDto {
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

export async function renameTag(oldName: string, newName: string) {
    return invoke<TagDto>("rename_tag", { oldName, newName });
}

export async function updateTagColor(name: string, color: string) {
    return invoke<TagDto>("update_tag_color", { name, color });
}

export async function getTagItemCounts() {
    return invoke<[string, string, number][]>("get_tag_item_counts");
}

// DB path command
export async function getDbPath() {
    return invoke<string>("get_db_path");
}

// Autostart commands
export async function setAutostart(enabled: boolean) {
    if (enabled) {
        return invoke("plugin:autostart|enable");
    }
    return invoke("plugin:autostart|disable");
}

export async function getAutostart() {
    return invoke<boolean>("plugin:autostart|is_enabled");
}

// Window behavior sync
export async function updateWindowBehavior(
    minimizeToTray: boolean,
    closeKeepRunning: boolean,
) {
    return invoke("update_window_behavior", {
        minimizeToTray,
        closeKeepRunning,
    });
}

// Library data (combined fetch)
export interface LibraryData {
    items: ItemDto[];
    tags: TagDto[];
    mappings: [string, string][];
}

export async function getLibraryData() {
    return invoke<LibraryData>("get_library_data");
}

// Diagnostics
export interface SqlLogConfig {
    enabled: boolean;
    to_console: boolean;
    to_file: boolean;
    pretty: boolean;
    max_len: number;
}

export async function getSqlLogConfig() {
    return invoke<SqlLogConfig>("get_sql_log_config");
}

export async function updateSqlLogConfig(config: SqlLogConfig) {
    return invoke<SqlLogConfig>("update_sql_log_config", { config });
}

export async function clearSqlLog() {
    return invoke("clear_sql_log");
}

export async function getLogDir() {
    return invoke<string>("get_log_dir");
}

export async function getSqlLogPath() {
    return invoke<string>("get_sql_log_path");
}

// ZIP export/import
export interface ExportOptions {
    includeTags: boolean;
    includeAttachments: boolean;
    includeVersions: boolean;
}

export interface ImportOptions {
    includeTags: boolean;
    includeAttachments: boolean;
    includeVersions: boolean;
    overwrite: boolean;
}

export interface ExportSizeEstimate {
    items_json: number;
    tags_json: number;
    versions_json: number;
    attachments: number;
    total: number;
}

export async function getExportSizeEstimate() {
    return invoke<ExportSizeEstimate>("get_export_size_estimate");
}

export async function exportDataZip(path: string, options: ExportOptions) {
    return invoke("export_data_zip", { path, options: {
        include_tags: options.includeTags,
        include_attachments: options.includeAttachments,
        include_versions: options.includeVersions,
    }});
}

export async function exportDataZipToDefault(options: ExportOptions) {
    return invoke<string>("export_data_zip_to_default", { options: {
        include_tags: options.includeTags,
        include_attachments: options.includeAttachments,
        include_versions: options.includeVersions,
    }});
}

export async function importDataZip(path: string, options: ImportOptions) {
    return invoke("import_data_zip", { path, options: {
        include_tags: options.includeTags,
        include_attachments: options.includeAttachments,
        include_versions: options.includeVersions,
        overwrite: options.overwrite,
    }});
}

export async function importDataZipBytes(data: number[], options: ImportOptions) {
    return invoke("import_data_zip_bytes", { data, options: {
        include_tags: options.includeTags,
        include_attachments: options.includeAttachments,
        include_versions: options.includeVersions,
        overwrite: options.overwrite,
    }});
}

// Auto backup
export interface AutoBackupConfig {
    enabled: boolean;
    interval_days: number;
    max_backups: number;
    expire_days: number;
    last_backup_at: string | null;
    last_backup_filename?: string | null;
    last_backup_size?: number | null;
    last_backup_error?: string | null;
}

export interface BackupFileInfo {
    filename: string;
    size: number;
    created_at: string;
    backup_type: "automatic" | "manual";
    verified: boolean;
    verification_error: string | null;
}

export interface BackupVerification {
    filename: string;
    size: number;
    valid: boolean;
    checked_at: string;
    error: string | null;
}

export async function getAutoBackupConfig() {
    return invoke<AutoBackupConfig>("get_auto_backup_config");
}

export async function updateAutoBackupConfig(config: AutoBackupConfig) {
    return invoke("update_auto_backup_config", { config });
}

export async function triggerBackupNow() {
    return invoke<string>("trigger_backup_now");
}

export async function getBackupDirPath() {
    return invoke<string>("get_backup_dir_path");
}

export async function listBackups() {
    return invoke<BackupFileInfo[]>("list_backups");
}

export async function deleteBackup(filename: string) {
    return invoke("delete_backup", { filename });
}

export async function verifyBackup(filename: string) {
    return invoke<BackupVerification>("verify_backup", { filename });
}

// Settings (SQLite-backed)
export async function loadAllSettings() {
    return invoke<Record<string, string>>("load_all_settings");
}

export async function saveSettings(settings: Record<string, string>) {
    return invoke("save_settings", { settings });
}

// Sync types
export interface SyncConfig {
    enabled: boolean;
    server_url: string;
    /** Token 仅由 Rust 后端保存在系统凭据库，前端不会收到真实值。 */
    access_token?: string;
    refresh_token?: string;
    user_id: string;
    authenticated: boolean;
    device_id: string;
    auto_sync: boolean;
    sync_interval_minutes: number;
    conflict_resolution: string;
    sync_attachments: boolean;
    last_sync_at: string | null;
    last_snapshot_id: string | null;
}

export interface SyncState {
    status: string;
    progress: { phase: string; current: number; total: number } | null;
    last_error: string | null;
    last_sync_at: string | null;
    queued: boolean;
    retry_count: number;
    next_retry_at: string | null;
    paused: boolean;
}

export interface SyncQueueStatus {
    queued: boolean;
    retry_count: number;
    next_retry_at: string | null;
    last_error: string | null;
    paused: boolean;
}

export interface ConflictInfo {
    record_id: string;
    table_name: string;
    local_data: Record<string, unknown>;
    local_updated_at: string;
    remote_updated_at: string;
    content_hash: string;
}

export interface ConflictResolutionChoice {
    table_name: string;
    record_id: string;
    choice: "local" | "remote";
}

export interface SyncResult {
    pushed: number;
    pulled: number;
    skipped: number;
    conflicts: number;
    pending_conflicts: ConflictInfo[] | null;
    attachments_uploaded: number;
    attachments_downloaded: number;
    snapshot_id: string;
}

export interface SyncLoginResult {
    user_id: string;
    email: string;
    access_token?: string;
    refresh_token?: string;
}

export interface SyncHistoryEntry {
    snapshot_id: string;
    record_count: number;
    total_size: number;
    created_at: string;
}

export interface PaginatedSyncHistory {
    items: SyncHistoryEntry[];
    total: number;
    page: number;
    page_size: number;
}

// Sync commands
export async function getSyncConfig() {
    return invoke<SyncConfig>("get_sync_config");
}

export async function saveSyncConfig(config: SyncConfig) {
    return invoke("save_sync_config_cmd", { config });
}

export async function getSyncState() {
    return invoke<SyncState>("get_sync_state");
}

export async function getSyncQueueStatus() {
    return invoke<SyncQueueStatus>("get_sync_queue_status");
}

export async function triggerSync() {
    return invoke<SyncResult>("trigger_sync");
}

export async function pauseSync() {
    return invoke<SyncQueueStatus>("pause_sync");
}

export async function resumeSync() {
    return invoke<SyncQueueStatus>("resume_sync");
}

export async function syncLogin(
    serverUrl: string,
    email: string,
    password: string,
) {
    return invoke<SyncLoginResult>("sync_login", { serverUrl, email, password });
}

export async function syncRegister(
    serverUrl: string,
    email: string,
    password: string,
    verifyCode?: string,
) {
    return invoke<SyncLoginResult>("sync_register", { serverUrl, email, password, verifyCode: verifyCode ?? null });
}

export async function syncLogout() {
    return invoke("sync_logout");
}

export async function syncForgotPassword(
    serverUrl: string,
    email: string,
    lang: string = "zh-CN",
): Promise<string | null> {
    return invoke<string | null>("sync_forgot_password", { serverUrl, email, lang });
}

export async function syncResetPassword(
    serverUrl: string,
    email: string,
    resetToken: string,
    newPassword: string,
) {
    return invoke("sync_reset_password", {
        serverUrl,
        email,
        resetToken,
        newPassword,
    });
}

export async function testSyncConnection(serverUrl: string) {
    return invoke<boolean>("test_sync_connection", { serverUrl });
}

export async function getSyncHistory(page: number = 1, pageSize: number = 10) {
    return invoke<PaginatedSyncHistory>("get_sync_history", { page, pageSize });
}

export async function getPendingConflicts() {
    return invoke<ConflictInfo[] | null>("get_pending_conflicts");
}

export async function resolveSyncConflicts(
    resolutions: ConflictResolutionChoice[],
) {
    return invoke<SyncResult>("resolve_sync_conflicts", { resolutions });
}

export async function cancelSyncConflicts() {
    return invoke("cancel_sync_conflicts");
}

// ── User Profile ──────────────────────────────────────────────

export interface UserProfile {
    id: string;
    email: string;
    nickname: string | null;
    avatar_url: string | null;
    bio: string | null;
    phone: string | null;
    address: string | null;
    created_at: string | null;
}

export async function getUserProfile(): Promise<UserProfile> {
    return invoke<UserProfile>("get_user_profile");
}

export async function updateUserProfile(updates: {
    nickname?: string;
    bio?: string;
    phone?: string;
    address?: string;
}): Promise<UserProfile> {
    return invoke<UserProfile>("update_user_profile", { updates });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return invoke("change_password", { payload: { old_password: oldPassword, new_password: newPassword } });
}

export async function uploadAvatar(filePath: string): Promise<UserProfile> {
    return invoke<UserProfile>("upload_avatar", { filePath });
}

export async function deleteAccount(): Promise<void> {
    return invoke("delete_account");
}

export async function sendVerifyCode(serverUrl: string, email: string, lang: string = "zh-CN"): Promise<void> {
    return invoke("send_verify_code", { serverUrl, email, lang });
}
