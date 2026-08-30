use crate::db::DbState;
use crate::error::AppError;
use crate::models::sync::SyncRecordPayload;
use crate::sync::transport::RecordMetaInfo;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};

/// 冲突解决策略
#[derive(Debug, Clone)]
pub enum ConflictResolution {
    /// 本地优先
    LocalWins,
    /// 远程优先
    RemoteWins,
    /// 手动解决（暂不实现，fallback 到 RemoteWins）
    #[allow(dead_code)]
    Manual,
}

/// 同步冲突记录
#[derive(Debug, Clone)]
pub struct SyncConflict {
    /// 记录 ID
    pub record_id: String,
    /// 表名
    pub table_name: String,
    /// 本地记录
    pub local_record: SyncRecordPayload,
    /// 远程记录元信息
    pub remote_meta: RecordMetaInfo,
    /// 解决策略
    pub resolution: ConflictResolution,
}

/// 差异比对结果
pub struct DiffResult {
    /// 需要推送到服务端的记录（本地独改）
    pub to_push: Vec<SyncRecordPayload>,
    /// 需要从服务端拉取的记录（远程独改）
    pub to_pull: Vec<RecordMetaInfo>,
    /// 冲突记录（双方异改）
    pub conflicts: Vec<SyncConflict>,
    /// 无变化的记录数
    pub unchanged: u32,
}

/// 计算单条记录的 SHA256 哈希
pub fn compute_record_hash(data: &serde_json::Value) -> String {
    let json_str = serde_json::to_string(data).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(json_str.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// 计算文件数据的 SHA256 哈希
pub fn compute_file_hash(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

/// 从数据库查询所有记录并计算哈希
pub fn collect_local_records(db: &DbState) -> Result<Vec<SyncRecordPayload>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut all_records = Vec::new();

    // items 表
    collect_table_records(
        &conn,
        "items",
        "SELECT id, title, item_type, content, summary, summary_mode, pinned, favorite, encrypted, created_at, updated_at, deleted_at FROM items",
        |row| {
            let id: String = row.get(0)?;
            let data = serde_json::json!({
                "id": id,
                "title": row.get::<_, String>(1)?,
                "item_type": row.get::<_, String>(2)?,
                "content": row.get::<_, String>(3)?,
                "summary": row.get::<_, String>(4)?,
                "summary_mode": row.get::<_, String>(5)?,
                "pinned": row.get::<_, i32>(6)? != 0,
                "favorite": row.get::<_, i32>(7)? != 0,
                "encrypted": row.get::<_, i32>(8)? != 0,
                "created_at": row.get::<_, String>(9)?,
                "updated_at": row.get::<_, String>(10)?,
                "deleted_at": row.get::<_, Option<String>>(11)?,
            });
            let updated_at = row.get::<_, String>(10)?;
            Ok((id, data, updated_at))
        },
        &mut all_records,
    )?;

    // tags 表（使用 uuid 作为同步标识，避免自增 ID 跨设备冲突）
    collect_table_records(
        &conn,
        "tags",
        "SELECT uuid, name, color, updated_at FROM tags",
        |row| {
            let uuid: String = row.get(0)?;
            let data = serde_json::json!({
                "uuid": uuid,
                "name": row.get::<_, String>(1)?,
                "color": row.get::<_, String>(2)?,
                "updated_at": row.get::<_, String>(3)?,
            });
            let updated_at = row.get::<_, String>(3)?;
            Ok((uuid, data, updated_at))
        },
        &mut all_records,
    )?;

    // item_tags 表（使用 tag uuid 作为同步标识）
    collect_table_records(
        &conn,
        "item_tags",
        "SELECT it.item_id, t.uuid, it.updated_at
         FROM item_tags it JOIN tags t ON t.id = it.tag_id",
        |row| {
            let item_id: String = row.get(0)?;
            let tag_uuid: String = row.get(1)?;
            let id = format!("{}_{}", item_id, tag_uuid);
            let data = serde_json::json!({
                "item_id": item_id,
                "tag_uuid": tag_uuid,
                "updated_at": row.get::<_, String>(2)?,
            });
            let updated_at = row.get::<_, String>(2)?;
            Ok((id, data, updated_at))
        },
        &mut all_records,
    )?;

    // attachments 表
    collect_table_records(
        &conn,
        "attachments",
        "SELECT id, item_id, filename, file_path, mime_type, file_size, content_hash, created_at FROM attachments",
        |row| {
            let id: String = row.get(0)?;
            let data = serde_json::json!({
                "id": id,
                "item_id": row.get::<_, String>(1)?,
                "filename": row.get::<_, String>(2)?,
                "file_path": row.get::<_, String>(3)?,
                "mime_type": row.get::<_, String>(4)?,
                "file_size": row.get::<_, i64>(5)?,
                "content_hash": row.get::<_, String>(6)?,
                "created_at": row.get::<_, String>(7)?,
            });
            let updated_at = row.get::<_, String>(7)?;
            Ok((id, data, updated_at))
        },
        &mut all_records,
    )?;

    // versions 表
    collect_table_records(
        &conn,
        "versions",
        "SELECT id, item_id, version_number, content, change_summary, name, description, created_at FROM versions",
        |row| {
            let id: String = row.get(0)?;
            let data = serde_json::json!({
                "id": id,
                "item_id": row.get::<_, String>(1)?,
                "version_number": row.get::<_, i64>(2)?,
                "content": row.get::<_, String>(3)?,
                "change_summary": row.get::<_, String>(4)?,
                "name": row.get::<_, String>(5)?,
                "description": row.get::<_, String>(6)?,
                "created_at": row.get::<_, String>(7)?,
            });
            let updated_at = row.get::<_, String>(7)?;
            Ok((id, data, updated_at))
        },
        &mut all_records,
    )?;

    // tombstones（已删除记录的标记）
    let mut stmt = conn
        .prepare("SELECT record_id, table_name, deleted_at FROM sync_tombstones")
        .map_err(|e| AppError::Database(format!("准备查询失败 (tombstones): {}", e)))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| AppError::Database(format!("查询失败 (tombstones): {}", e)))?;

    for row in rows {
        let (record_id, table_name, deleted_at) =
            row.map_err(|e| AppError::Database(format!("读取行失败 (tombstones): {}", e)))?;
        let data = match table_name.as_str() {
            "tags" => serde_json::json!({
                "uuid": record_id,
                "_deleted": true,
                "deleted_at": deleted_at,
            }),
            "item_tags" => {
                let mut parts = record_id.splitn(2, '_');
                let item_id = parts.next().unwrap_or("");
                let tag_uuid = parts.next().unwrap_or("");
                serde_json::json!({
                    "item_id": item_id,
                    "tag_uuid": tag_uuid,
                    "_deleted": true,
                    "deleted_at": deleted_at,
                })
            }
            _ => serde_json::json!({
                "id": record_id,
                "_deleted": true,
                "deleted_at": deleted_at,
            }),
        };
        let content_hash = compute_record_hash(&data);
        all_records.push(SyncRecordPayload {
            table_name,
            record_id,
            content_hash,
            updated_at: deleted_at,
            data,
        });
    }

    // 去重：如果同一 (record_id, table_name) 同时有 live 记录和 tombstone，优先保留 live
    let live_keys: HashSet<String> = all_records
        .iter()
        .filter(|r| {
            !r.data
                .get("_deleted")
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
        })
        .map(|r| format!("{}:{}", r.table_name, r.record_id))
        .collect();

    all_records.retain(|r| {
        if r.data
            .get("_deleted")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            let key = format!("{}:{}", r.table_name, r.record_id);
            !live_keys.contains(&key)
        } else {
            true
        }
    });

    Ok(all_records)
}

fn collect_table_records<F>(
    conn: &rusqlite::Connection,
    table_name: &str,
    sql: &str,
    row_mapper: F,
    output: &mut Vec<SyncRecordPayload>,
) -> Result<(), AppError>
where
    F: Fn(&rusqlite::Row) -> Result<(String, serde_json::Value, String), rusqlite::Error>,
{
    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| AppError::Database(format!("准备查询失败 ({}): {}", table_name, e)))?;

    let rows = stmt
        .query_map([], |row| row_mapper(row))
        .map_err(|e| AppError::Database(format!("查询失败 ({}): {}", table_name, e)))?;

    for row in rows {
        let (record_id, data, updated_at) =
            row.map_err(|e| AppError::Database(format!("读取行失败 ({}): {}", table_name, e)))?;
        let content_hash = compute_record_hash(&data);
        output.push(SyncRecordPayload {
            table_name: table_name.to_string(),
            record_id,
            content_hash,
            updated_at,
            data,
        });
    }

    Ok(())
}

/// 比对本地记录和服务端记录，计算差异（三方 diff）
///
/// 使用 baseline_map 进行三方比较：
/// - 本地 hash ≠ 基线 hash → 本地修改了
/// - 远程 hash ≠ 基线 hash → 远程修改了
/// - 两者都修改了且 hash 不同 → 冲突
pub fn compute_diff(
    local_records: &[SyncRecordPayload],
    remote_metas: &[RecordMetaInfo],
    baseline_map: &HashMap<String, String>,
    conflict_strategy: &str,
) -> DiffResult {
    // 构建映射，使用 "table_name:record_id" 作为复合键避免跨表 ID 碰撞
    let remote_map: HashMap<String, &RecordMetaInfo> = remote_metas
        .iter()
        .map(|m| (format!("{}:{}", m.table_name, m.record_id), m))
        .collect();
    let local_map: HashMap<String, &SyncRecordPayload> = local_records
        .iter()
        .map(|r| (format!("{}:{}", r.table_name, r.record_id), r))
        .collect();

    let mut to_push = Vec::new();
    let mut to_pull = Vec::new();
    let mut conflicts = Vec::new();
    let mut unchanged: u32 = 0;

    // 合并所有复合键
    let all_keys: HashSet<String> = local_map.keys().chain(remote_map.keys()).cloned().collect();

    for key in all_keys {
        let local = local_map.get(&key);
        let remote = remote_map.get(&key);
        let baseline_hash = baseline_map.get(&key).map(|s| s.as_str());

        match (local, remote, baseline_hash) {
            // 本地独有 → 推送
            (Some(l), None, _) => to_push.push((*l).clone()),
            // 远程独有 → 拉取
            (None, Some(r), _) => to_pull.push((*r).clone()),
            // 两端都有 → 三方比较
            (Some(l), Some(r), _) => {
                let local_changed = baseline_hash.map_or(true, |b| l.content_hash != b);
                let remote_changed = baseline_hash.map_or(true, |b| r.content_hash != b);

                match (local_changed, remote_changed) {
                    // 无变化
                    (false, false) => unchanged += 1,
                    // 本地独改 → 推送
                    (true, false) => to_push.push((*l).clone()),
                    // 远程独改 → 拉取
                    (false, true) => to_pull.push((*r).clone()),
                    // 双方都改
                    (true, true) => {
                        if l.content_hash == r.content_hash {
                            // 双方同改（内容相同）→ 无变化
                            unchanged += 1;
                        } else {
                            // 双方异改 → 冲突
                            let resolution = match conflict_strategy {
                                "local-wins" => ConflictResolution::LocalWins,
                                "remote-wins" => ConflictResolution::RemoteWins,
                                "auto" => {
                                    // 解析时间戳后比较，选择更新的一方
                                    let local_time =
                                        chrono::DateTime::parse_from_rfc3339(&l.updated_at)
                                            .ok()
                                            .map(|dt| dt.with_timezone(&chrono::Utc));
                                    let remote_time =
                                        chrono::DateTime::parse_from_rfc3339(&r.updated_at)
                                            .ok()
                                            .map(|dt| dt.with_timezone(&chrono::Utc));
                                    match (local_time, remote_time) {
                                        (Some(lt), Some(rt)) => {
                                            if lt >= rt {
                                                ConflictResolution::LocalWins
                                            } else {
                                                ConflictResolution::RemoteWins
                                            }
                                        }
                                        // 时间解析失败时，使用 content_hash 字典序作为确定性 tie-breaker
                                        _ => {
                                            if l.content_hash >= r.content_hash {
                                                ConflictResolution::LocalWins
                                            } else {
                                                ConflictResolution::RemoteWins
                                            }
                                        }
                                    }
                                }
                                _ => ConflictResolution::RemoteWins,
                            };
                            conflicts.push(SyncConflict {
                                record_id: l.record_id.clone(),
                                table_name: l.table_name.clone(),
                                local_record: (*l).clone(),
                                remote_meta: (*r).clone(),
                                resolution,
                            });
                        }
                    }
                }
            }
            // 两端都没有（理论上不会出现）
            (None, None, _) => {}
        }
    }

    // 根据解决策略处理冲突
    for conflict in &conflicts {
        match &conflict.resolution {
            ConflictResolution::LocalWins => {
                to_push.push(conflict.local_record.clone());
            }
            ConflictResolution::RemoteWins => {
                to_pull.push(conflict.remote_meta.clone());
            }
            _ => {} // Manual 模式由调用方拦截处理，不在此处自动解决
        }
    }

    DiffResult {
        to_push,
        to_pull,
        conflicts,
        unchanged,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_local(id: &str, table: &str, hash: &str, updated_at: &str) -> SyncRecordPayload {
        SyncRecordPayload {
            table_name: table.to_string(),
            record_id: id.to_string(),
            content_hash: hash.to_string(),
            updated_at: updated_at.to_string(),
            data: serde_json::json!({"id": id}),
        }
    }

    fn make_remote(id: &str, table: &str, hash: &str, updated_at: &str) -> RecordMetaInfo {
        RecordMetaInfo {
            table_name: table.to_string(),
            record_id: id.to_string(),
            content_hash: hash.to_string(),
            updated_at: updated_at.to_string(),
        }
    }

    #[test]
    fn local_only_records_are_pushed() {
        let local = vec![make_local("1", "items", "hash_a", "2024-01-01T00:00:00Z")];
        let remote = vec![];
        let baseline = HashMap::new();
        let result = compute_diff(&local, &remote, &baseline, "auto");
        assert_eq!(result.to_push.len(), 1);
        assert_eq!(result.to_pull.len(), 0);
        assert_eq!(result.conflicts.len(), 0);
        assert_eq!(result.unchanged, 0);
    }

    #[test]
    fn remote_only_records_are_pulled() {
        let local = vec![];
        let remote = vec![make_remote("1", "items", "hash_a", "2024-01-01T00:00:00Z")];
        let baseline = HashMap::new();
        let result = compute_diff(&local, &remote, &baseline, "auto");
        assert_eq!(result.to_push.len(), 0);
        assert_eq!(result.to_pull.len(), 1);
        assert_eq!(result.conflicts.len(), 0);
    }

    #[test]
    fn unchanged_records_counted() {
        let local = vec![make_local("1", "items", "hash_a", "2024-01-01T00:00:00Z")];
        let remote = vec![make_remote("1", "items", "hash_a", "2024-01-01T00:00:00Z")];
        let mut baseline = HashMap::new();
        baseline.insert("items:1".to_string(), "hash_a".to_string());
        let result = compute_diff(&local, &remote, &baseline, "auto");
        assert_eq!(result.to_push.len(), 0);
        assert_eq!(result.to_pull.len(), 0);
        assert_eq!(result.conflicts.len(), 0);
        assert_eq!(result.unchanged, 1);
    }

    #[test]
    fn local_only_change_is_pushed() {
        let local = vec![make_local("1", "items", "hash_b", "2024-01-02T00:00:00Z")];
        let remote = vec![make_remote("1", "items", "hash_a", "2024-01-01T00:00:00Z")];
        let mut baseline = HashMap::new();
        baseline.insert("items:1".to_string(), "hash_a".to_string());
        let result = compute_diff(&local, &remote, &baseline, "auto");
        assert_eq!(result.to_push.len(), 1);
        assert_eq!(result.to_pull.len(), 0);
        assert_eq!(result.conflicts.len(), 0);
    }

    #[test]
    fn remote_only_change_is_pulled() {
        let local = vec![make_local("1", "items", "hash_a", "2024-01-01T00:00:00Z")];
        let remote = vec![make_remote("1", "items", "hash_b", "2024-01-02T00:00:00Z")];
        let mut baseline = HashMap::new();
        baseline.insert("items:1".to_string(), "hash_a".to_string());
        let result = compute_diff(&local, &remote, &baseline, "auto");
        assert_eq!(result.to_push.len(), 0);
        assert_eq!(result.to_pull.len(), 1);
        assert_eq!(result.conflicts.len(), 0);
    }

    #[test]
    fn both_changed_same_content_is_unchanged() {
        let local = vec![make_local("1", "items", "hash_b", "2024-01-02T00:00:00Z")];
        let remote = vec![make_remote("1", "items", "hash_b", "2024-01-02T00:00:00Z")];
        let mut baseline = HashMap::new();
        baseline.insert("items:1".to_string(), "hash_a".to_string());
        let result = compute_diff(&local, &remote, &baseline, "auto");
        assert_eq!(result.conflicts.len(), 0);
        assert_eq!(result.unchanged, 1);
    }

    #[test]
    fn both_changed_different_content_is_conflict() {
        let local = vec![make_local("1", "items", "hash_b", "2024-01-02T00:00:00Z")];
        let remote = vec![make_remote("1", "items", "hash_c", "2024-01-02T00:00:00Z")];
        let mut baseline = HashMap::new();
        baseline.insert("items:1".to_string(), "hash_a".to_string());
        let result = compute_diff(&local, &remote, &baseline, "auto");
        assert_eq!(result.conflicts.len(), 1);
    }

    #[test]
    fn local_wins_strategy_pushes_conflict() {
        let local = vec![make_local("1", "items", "hash_b", "2024-01-02T00:00:00Z")];
        let remote = vec![make_remote("1", "items", "hash_c", "2024-01-02T00:00:00Z")];
        let mut baseline = HashMap::new();
        baseline.insert("items:1".to_string(), "hash_a".to_string());
        let result = compute_diff(&local, &remote, &baseline, "local-wins");
        assert_eq!(result.conflicts.len(), 1);
        assert_eq!(result.to_push.len(), 1);
        assert_eq!(result.to_pull.len(), 0);
    }

    #[test]
    fn remote_wins_strategy_pulls_conflict() {
        let local = vec![make_local("1", "items", "hash_b", "2024-01-02T00:00:00Z")];
        let remote = vec![make_remote("1", "items", "hash_c", "2024-01-02T00:00:00Z")];
        let mut baseline = HashMap::new();
        baseline.insert("items:1".to_string(), "hash_a".to_string());
        let result = compute_diff(&local, &remote, &baseline, "remote-wins");
        assert_eq!(result.conflicts.len(), 1);
        assert_eq!(result.to_push.len(), 0);
        assert_eq!(result.to_pull.len(), 1);
    }

    #[test]
    fn auto_strategy_picks_newer_on_conflict() {
        let local = vec![make_local("1", "items", "hash_b", "2024-01-03T00:00:00Z")];
        let remote = vec![make_remote("1", "items", "hash_c", "2024-01-02T00:00:00Z")];
        let mut baseline = HashMap::new();
        baseline.insert("items:1".to_string(), "hash_a".to_string());
        let result = compute_diff(&local, &remote, &baseline, "auto");
        assert_eq!(result.conflicts.len(), 1);
        // local is newer → should push
        assert_eq!(result.to_push.len(), 1);
        assert_eq!(result.to_pull.len(), 0);
    }

    #[test]
    fn no_baseline_treats_as_new() {
        let local = vec![make_local("1", "items", "hash_a", "2024-01-01T00:00:00Z")];
        let remote = vec![make_remote("1", "items", "hash_a", "2024-01-01T00:00:00Z")];
        let baseline = HashMap::new();
        let result = compute_diff(&local, &remote, &baseline, "auto");
        // Same hash → unchanged even without baseline
        assert_eq!(result.unchanged, 1);
        assert_eq!(result.conflicts.len(), 0);
    }

    #[test]
    fn cross_table_ids_do_not_collide() {
        let local = vec![make_local("1", "items", "hash_a", "2024-01-01T00:00:00Z")];
        let remote = vec![make_remote("1", "tags", "hash_b", "2024-01-01T00:00:00Z")];
        let baseline = HashMap::new();
        let result = compute_diff(&local, &remote, &baseline, "auto");
        assert_eq!(result.to_push.len(), 1);
        assert_eq!(result.to_pull.len(), 1);
        assert_eq!(result.conflicts.len(), 0);
    }

    #[test]
    fn compute_record_hash_is_deterministic() {
        let data = serde_json::json!({"id": "1", "title": "test"});
        let h1 = compute_record_hash(&data);
        let h2 = compute_record_hash(&data);
        assert_eq!(h1, h2);
        assert!(!h1.is_empty());
    }

    #[test]
    fn compute_file_hash_is_deterministic() {
        let data = b"hello world";
        let h1 = compute_file_hash(data);
        let h2 = compute_file_hash(data);
        assert_eq!(h1, h2);
        assert!(!h1.is_empty());
    }
}
