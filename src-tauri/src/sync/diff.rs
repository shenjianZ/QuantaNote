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
        "SELECT id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at FROM items",
        |row| {
            let id: String = row.get(0)?;
            let data = serde_json::json!({
                "id": id,
                "title": row.get::<_, String>(1)?,
                "item_type": row.get::<_, String>(2)?,
                "content": row.get::<_, String>(3)?,
                "summary": row.get::<_, String>(4)?,
                "pinned": row.get::<_, i32>(5)? != 0,
                "favorite": row.get::<_, i32>(6)? != 0,
                "encrypted": row.get::<_, i32>(7)? != 0,
                "created_at": row.get::<_, String>(8)?,
                "updated_at": row.get::<_, String>(9)?,
            });
            let updated_at = row.get::<_, String>(9)?;
            Ok((id, data, updated_at))
        },
        &mut all_records,
    )?;

    // tags 表
    collect_table_records(
        &conn,
        "tags",
        "SELECT id, name, color FROM tags",
        |row| {
            let id: i64 = row.get(0)?;
            let id_str = id.to_string();
            let data = serde_json::json!({
                "id": id,
                "name": row.get::<_, String>(1)?,
                "color": row.get::<_, String>(2)?,
            });
            // tags 表无 updated_at，使用空字符串（content_hash 仍可区分变更）
            Ok((id_str, data, String::new()))
        },
        &mut all_records,
    )?;

    // item_tags 表
    collect_table_records(
        &conn,
        "item_tags",
        "SELECT item_id, tag_id FROM item_tags",
        |row| {
            let item_id: String = row.get(0)?;
            let tag_id: i64 = row.get(1)?;
            let id = format!("{}_{}", item_id, tag_id);
            let data = serde_json::json!({
                "item_id": item_id,
                "tag_id": tag_id,
            });
            // item_tags 表无 updated_at，使用空字符串
            Ok((id, data, String::new()))
        },
        &mut all_records,
    )?;

    // attachments 表
    collect_table_records(
        &conn,
        "attachments",
        "SELECT id, item_id, filename, file_path, mime_type, file_size, created_at FROM attachments",
        |row| {
            let id: String = row.get(0)?;
            let data = serde_json::json!({
                "id": id,
                "item_id": row.get::<_, String>(1)?,
                "filename": row.get::<_, String>(2)?,
                "file_path": row.get::<_, String>(3)?,
                "mime_type": row.get::<_, String>(4)?,
                "file_size": row.get::<_, i64>(5)?,
                "created_at": row.get::<_, String>(6)?,
            });
            let updated_at = row.get::<_, String>(6)?;
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
        let data = serde_json::json!({
            "id": record_id,
            "_deleted": true,
            "deleted_at": deleted_at,
        });
        let content_hash = compute_record_hash(&data);
        all_records.push(SyncRecordPayload {
            table_name,
            record_id,
            content_hash,
            updated_at: deleted_at,
            data,
        });
    }

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
    // 构建映射
    let remote_map: HashMap<&str, &RecordMetaInfo> = remote_metas
        .iter()
        .map(|m| (m.record_id.as_str(), m))
        .collect();
    let local_map: HashMap<&str, &SyncRecordPayload> = local_records
        .iter()
        .map(|r| (r.record_id.as_str(), r))
        .collect();

    let mut to_push = Vec::new();
    let mut to_pull = Vec::new();
    let mut conflicts = Vec::new();
    let mut unchanged: u32 = 0;

    // 合并所有 record_id
    let all_ids: HashSet<String> = local_records
        .iter()
        .map(|r| r.record_id.clone())
        .chain(remote_metas.iter().map(|m| m.record_id.clone()))
        .collect();

    for id in all_ids {
        let local = local_map.get(id.as_str());
        let remote = remote_map.get(id.as_str());
        let baseline_hash = baseline_map.get(&id).map(|s| s.as_str());

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
                                    // 比较时间戳，选择更新的一方
                                    if l.updated_at >= r.updated_at {
                                        ConflictResolution::LocalWins
                                    } else {
                                        ConflictResolution::RemoteWins
                                    }
                                }
                                _ => ConflictResolution::RemoteWins,
                            };
                            conflicts.push(SyncConflict {
                                record_id: id,
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
            _ => {} // Manual 暂不处理，后续可扩展 UI
        }
    }

    DiffResult {
        to_push,
        to_pull,
        conflicts,
        unchanged,
    }
}
