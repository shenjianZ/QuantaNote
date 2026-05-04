use crate::domain::entities::{sync_attachments, sync_records, sync_snapshots};
use sea_orm::*;

/// 同步数据仓库
pub struct SyncRepository {
    db: DatabaseConnection,
}

impl SyncRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    // ========== 快照操作 ==========

    /// 获取用户最新快照
    pub async fn get_latest_snapshot(
        &self,
        user_id: &str,
    ) -> anyhow::Result<Option<sync_snapshots::Model>> {
        let snapshot = sync_snapshots::Entity::find()
            .filter(sync_snapshots::Column::UserId.eq(user_id))
            .order_by_desc(sync_snapshots::Column::CreatedAt)
            .one(&self.db)
            .await?;
        Ok(snapshot)
    }

    /// 创建快照
    pub async fn create_snapshot(
        &self,
        user_id: &str,
        snapshot_id: &str,
        data_hash: &str,
        record_count: i32,
        total_size: i64,
    ) -> anyhow::Result<sync_snapshots::Model> {
        let model = sync_snapshots::ActiveModel {
            id: NotSet,
            user_id: Set(user_id.to_string()),
            snapshot_id: Set(snapshot_id.to_string()),
            data_hash: Set(data_hash.to_string()),
            record_count: Set(record_count),
            total_size: Set(total_size),
            created_at: Set(chrono::Utc::now().naive_utc()),
        };
        let result = model.insert(&self.db).await?;
        Ok(result)
    }

    /// 获取同步历史（分页）
    pub async fn get_sync_history(
        &self,
        user_id: &str,
        offset: u32,
        limit: u32,
    ) -> anyhow::Result<(Vec<sync_snapshots::Model>, i64)> {
        let total = sync_snapshots::Entity::find()
            .filter(sync_snapshots::Column::UserId.eq(user_id))
            .count(&self.db)
            .await? as i64;

        let snapshots = sync_snapshots::Entity::find()
            .filter(sync_snapshots::Column::UserId.eq(user_id))
            .order_by_desc(sync_snapshots::Column::CreatedAt)
            .offset(offset as u64)
            .limit(limit as u64)
            .all(&self.db)
            .await?;

        Ok((snapshots, total))
    }

    // ========== 记录操作 ==========

    /// 获取快照的所有记录元信息（校验 snapshot 归属用户）
    pub async fn get_snapshot_records(
        &self,
        user_id: &str,
        snapshot_id: &str,
    ) -> anyhow::Result<Vec<sync_records::Model>> {
        let records = sync_records::Entity::find()
            .filter(sync_records::Column::UserId.eq(user_id))
            .filter(sync_records::Column::SnapshotId.eq(snapshot_id))
            .all(&self.db)
            .await?;
        Ok(records)
    }

    /// 批量写入记录（真正的 upsert：按自然键冲突时更新）
    pub async fn upsert_records(
        &self,
        records: Vec<sync_records::ActiveModel>,
    ) -> anyhow::Result<()> {
        for record in records {
            let user_id = match &record.user_id {
                Set(v) => v.as_str(),
                _ => "",
            };
            let table_name = match &record.table_name {
                Set(v) => v.as_str(),
                _ => "",
            };
            let rid = match &record.record_id {
                Set(v) => v.as_str(),
                _ => "",
            };

            let existing = sync_records::Entity::find()
                .filter(sync_records::Column::UserId.eq(user_id))
                .filter(sync_records::Column::TableName.eq(table_name))
                .filter(sync_records::Column::RecordId.eq(rid))
                .one(&self.db)
                .await?;

            if let Some(existing_model) = existing {
                // 已存在 → 更新内容哈希和时间，但不修改 snapshot_id/storage_key
                // 避免破坏已提交快照的记录视图（pending 记录通过 insert 新行或 commit 时统一替换）
                let mut active: sync_records::ActiveModel = existing_model.into();
                active.content_hash = record.content_hash;
                active.updated_at = record.updated_at;
                // 仅当记录已经是 pending 状态时才更新 snapshot_id/storage_key
                if matches!(&active.snapshot_id, Set(v) if v == "pending") {
                    active.snapshot_id = record.snapshot_id;
                    active.storage_key = record.storage_key;
                }
                active.update(&self.db).await?;
            } else {
                // 不存在 → 插入
                record.insert(&self.db).await?;
            }
        }
        Ok(())
    }

    /// 清除用户旧记录（在新快照提交前）
    pub async fn delete_user_records(&self, user_id: &str) -> anyhow::Result<()> {
        sync_records::Entity::delete_many()
            .filter(sync_records::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(())
    }

    /// 统计用户的记录数
    pub async fn count_user_records(&self, user_id: &str) -> anyhow::Result<i32> {
        let count = sync_records::Entity::find()
            .filter(sync_records::Column::UserId.eq(user_id))
            .count(&self.db)
            .await?;
        Ok(count as i32)
    }

    /// 获取用户所有记录的内容哈希（用于计算数据哈希）
    pub async fn get_user_record_hashes(&self, user_id: &str) -> anyhow::Result<Vec<String>> {
        let records = sync_records::Entity::find()
            .filter(sync_records::Column::UserId.eq(user_id))
            .all(&self.db)
            .await?;
        Ok(records.into_iter().map(|r| r.content_hash).collect())
    }

    /// 将用户所有记录关联到新快照（确保最新快照是完整视图）
    pub async fn update_all_records_snapshot_id(
        &self,
        user_id: &str,
        new_snapshot_id: &str,
    ) -> anyhow::Result<u64> {
        let result = sync_records::Entity::update_many()
            .filter(sync_records::Column::UserId.eq(user_id))
            .set(sync_records::ActiveModel {
                snapshot_id: Set(new_snapshot_id.to_string()),
                ..Default::default()
            })
            .exec(&self.db)
            .await?;
        Ok(result.rows_affected)
    }

    /// 获取指定 (record_id, table_name) 对的 pending 记录（精确匹配避免跨表碰撞）
    pub async fn get_pending_records_by_composite_ids(
        &self,
        user_id: &str,
        pushed_records: &[crate::domain::dto::sync::PushedRecordId],
    ) -> anyhow::Result<Vec<sync_records::Model>> {
        if pushed_records.is_empty() {
            return Ok(Vec::new());
        }
        let mut results = Vec::new();
        for pr in pushed_records {
            let record = sync_records::Entity::find()
                .filter(
                    sync_records::Column::UserId
                        .eq(user_id)
                        .and(sync_records::Column::SnapshotId.eq("pending"))
                        .and(sync_records::Column::RecordId.eq(&pr.record_id))
                        .and(sync_records::Column::TableName.eq(&pr.table_name)),
                )
                .one(&self.db)
                .await?;
            if let Some(r) = record {
                results.push(r);
            }
        }
        Ok(results)
    }

    /// 获取指定 record_ids 的 pending 记录（兼容旧客户端）
    pub async fn get_pending_records_by_ids(
        &self,
        user_id: &str,
        record_ids: &[String],
    ) -> anyhow::Result<Vec<sync_records::Model>> {
        if record_ids.is_empty() {
            return Ok(Vec::new());
        }
        let records = sync_records::Entity::find()
            .filter(
                sync_records::Column::UserId
                    .eq(user_id)
                    .and(sync_records::Column::SnapshotId.eq("pending"))
                    .and(sync_records::Column::RecordId.is_in(record_ids.to_vec())),
            )
            .all(&self.db)
            .await?;
        Ok(records)
    }

    /// 获取用户所有 pending 记录（保留用于调试/管理用途）
    #[allow(dead_code)]
    pub async fn get_all_pending_records(
        &self,
        user_id: &str,
    ) -> anyhow::Result<Vec<sync_records::Model>> {
        let records = sync_records::Entity::find()
            .filter(
                sync_records::Column::UserId
                    .eq(user_id)
                    .and(sync_records::Column::SnapshotId.eq("pending")),
            )
            .all(&self.db)
            .await?;
        Ok(records)
    }

    /// 更新记录的 storage_key
    pub async fn update_record_storage_key(
        &self,
        record_db_id: i64,
        new_storage_key: &str,
    ) -> anyhow::Result<()> {
        let result = sync_records::Entity::update_many()
            .filter(sync_records::Column::Id.eq(record_db_id))
            .set(sync_records::ActiveModel {
                storage_key: Set(new_storage_key.to_string()),
                ..Default::default()
            })
            .exec(&self.db)
            .await?;
        if result.rows_affected == 0 {
            return Err(anyhow::anyhow!("记录不存在: id={}", record_db_id));
        }
        Ok(())
    }

    // ========== 附件操作 ==========

    /// 获取用户所有附件元信息
    pub async fn get_user_attachments(
        &self,
        user_id: &str,
    ) -> anyhow::Result<Vec<sync_attachments::Model>> {
        let attachments = sync_attachments::Entity::find()
            .filter(sync_attachments::Column::UserId.eq(user_id))
            .all(&self.db)
            .await?;
        Ok(attachments)
    }

    /// 获取指定 attachment_ids 的 pending 附件
    pub async fn get_pending_attachments_by_ids(
        &self,
        user_id: &str,
        attachment_ids: &[String],
    ) -> anyhow::Result<Vec<sync_attachments::Model>> {
        if attachment_ids.is_empty() {
            return Ok(Vec::new());
        }
        let attachments = sync_attachments::Entity::find()
            .filter(
                sync_attachments::Column::UserId
                    .eq(user_id)
                    .and(sync_attachments::Column::SnapshotId.eq("pending"))
                    .and(sync_attachments::Column::AttachmentId.is_in(attachment_ids.to_vec())),
            )
            .all(&self.db)
            .await?;
        Ok(attachments)
    }

    /// 批量写入附件元信息（真正的 upsert：按自然键冲突时更新）
    pub async fn upsert_attachments(
        &self,
        attachments: Vec<sync_attachments::ActiveModel>,
    ) -> anyhow::Result<()> {
        for attachment in attachments {
            let uid = match &attachment.user_id {
                Set(v) => v.as_str(),
                _ => "",
            };
            let aid = match &attachment.attachment_id {
                Set(v) => v.as_str(),
                _ => "",
            };

            let existing = sync_attachments::Entity::find()
                .filter(sync_attachments::Column::UserId.eq(uid))
                .filter(sync_attachments::Column::AttachmentId.eq(aid))
                .one(&self.db)
                .await?;

            if let Some(existing_model) = existing {
                let mut active: sync_attachments::ActiveModel = existing_model.into();
                active.item_id = attachment.item_id;
                active.filename = attachment.filename;
                active.mime_type = attachment.mime_type;
                active.file_size = attachment.file_size;
                active.file_hash = attachment.file_hash;
                active.storage_key = attachment.storage_key;
                active.snapshot_id = attachment.snapshot_id;
                active.update(&self.db).await?;
            } else {
                attachment.insert(&self.db).await?;
            }
        }
        Ok(())
    }

    /// 清除用户旧附件元信息
    pub async fn delete_user_attachments(&self, user_id: &str) -> anyhow::Result<()> {
        sync_attachments::Entity::delete_many()
            .filter(sync_attachments::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(())
    }

    /// 删除不在当前完整附件列表中的附件元信息
    pub async fn delete_attachments_not_in_ids(
        &self,
        user_id: &str,
        attachment_ids: &[String],
    ) -> anyhow::Result<u64> {
        let mut delete = sync_attachments::Entity::delete_many()
            .filter(sync_attachments::Column::UserId.eq(user_id));
        if !attachment_ids.is_empty() {
            delete = delete
                .filter(sync_attachments::Column::AttachmentId.is_not_in(attachment_ids.to_vec()));
        }
        let result = delete.exec(&self.db).await?;
        Ok(result.rows_affected)
    }

    /// 更新附件元信息（commit 时由客户端上报完整元数据）
    pub async fn update_attachment_metadata(
        &self,
        user_id: &str,
        attachment_id: &str,
        item_id: &str,
        filename: &str,
        mime_type: &str,
        file_size: i64,
        file_hash: &str,
        storage_key: &str,
    ) -> anyhow::Result<()> {
        let model = sync_attachments::Entity::find()
            .filter(sync_attachments::Column::UserId.eq(user_id))
            .filter(sync_attachments::Column::AttachmentId.eq(attachment_id))
            .one(&self.db)
            .await?;
        if let Some(m) = model {
            let mut active: sync_attachments::ActiveModel = m.into();
            active.item_id = Set(item_id.to_string());
            active.filename = Set(filename.to_string());
            active.mime_type = Set(mime_type.to_string());
            active.file_size = Set(file_size);
            if !file_hash.is_empty() {
                active.file_hash = Set(file_hash.to_string());
            }
            if !storage_key.is_empty() {
                active.storage_key = Set(storage_key.to_string());
            }
            active.update(&self.db).await?;
        }
        Ok(())
    }

    /// 更新附件的 storage_key 和 snapshot_id
    pub async fn update_attachment_storage_key_snapshot(
        &self,
        attachment_db_id: i64,
        new_storage_key: &str,
        new_snapshot_id: &str,
    ) -> anyhow::Result<()> {
        let result = sync_attachments::Entity::update_many()
            .filter(sync_attachments::Column::Id.eq(attachment_db_id))
            .set(sync_attachments::ActiveModel {
                storage_key: Set(new_storage_key.to_string()),
                snapshot_id: Set(new_snapshot_id.to_string()),
                ..Default::default()
            })
            .exec(&self.db)
            .await?;
        if result.rows_affected == 0 {
            return Err(anyhow::anyhow!("附件不存在: id={}", attachment_db_id));
        }
        Ok(())
    }

    /// 将用户所有附件关联到新快照（附件表保存的是当前完整视图）
    pub async fn update_all_attachments_snapshot_id(
        &self,
        user_id: &str,
        new_snapshot_id: &str,
    ) -> anyhow::Result<u64> {
        let result = sync_attachments::Entity::update_many()
            .filter(sync_attachments::Column::UserId.eq(user_id))
            .set(sync_attachments::ActiveModel {
                snapshot_id: Set(new_snapshot_id.to_string()),
                ..Default::default()
            })
            .exec(&self.db)
            .await?;
        Ok(result.rows_affected)
    }

    /// 删除指定快照 ID 之前的旧快照
    pub async fn delete_snapshots_before(
        &self,
        user_id: &str,
        before_snapshot_id: &str,
    ) -> anyhow::Result<Vec<String>> {
        // 找到 before_snapshot_id 的创建时间
        let reference = sync_snapshots::Entity::find()
            .filter(sync_snapshots::Column::UserId.eq(user_id))
            .filter(sync_snapshots::Column::SnapshotId.eq(before_snapshot_id))
            .one(&self.db)
            .await?;
        let reference = match reference {
            Some(r) => r,
            None => return Ok(vec![]),
        };

        // 查找比它更旧的快照
        let old_snapshots = sync_snapshots::Entity::find()
            .filter(sync_snapshots::Column::UserId.eq(user_id))
            .filter(sync_snapshots::Column::CreatedAt.lt(reference.created_at))
            .all(&self.db)
            .await?;

        let old_ids: Vec<String> = old_snapshots
            .iter()
            .map(|s| s.snapshot_id.clone())
            .collect();
        if old_ids.is_empty() {
            return Ok(old_ids);
        }

        // 删除旧快照关联的记录
        sync_records::Entity::delete_many()
            .filter(sync_records::Column::UserId.eq(user_id))
            .filter(sync_records::Column::SnapshotId.is_in(old_ids.clone()))
            .exec(&self.db)
            .await?;

        // 删除旧快照关联的附件元信息
        sync_attachments::Entity::delete_many()
            .filter(sync_attachments::Column::UserId.eq(user_id))
            .filter(sync_attachments::Column::SnapshotId.is_in(old_ids.clone()))
            .exec(&self.db)
            .await?;

        // 删除旧快照本身
        sync_snapshots::Entity::delete_many()
            .filter(sync_snapshots::Column::UserId.eq(user_id))
            .filter(sync_snapshots::Column::SnapshotId.is_in(old_ids.clone()))
            .exec(&self.db)
            .await?;

        Ok(old_ids)
    }

    /// 删除用户所有快照
    pub async fn delete_all_snapshots(&self, user_id: &str) -> anyhow::Result<()> {
        sync_snapshots::Entity::delete_many()
            .filter(sync_snapshots::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(())
    }

    // ========== Pending 孤儿清理 ==========

    /// 查询所有用户中超过指定小时数的 pending 记录
    pub async fn get_stale_pending_records(
        &self,
        age_hours: i64,
    ) -> anyhow::Result<Vec<sync_records::Model>> {
        let cutoff = chrono::Utc::now().naive_utc() - chrono::Duration::hours(age_hours);
        let records = sync_records::Entity::find()
            .filter(sync_records::Column::SnapshotId.eq("pending"))
            .filter(sync_records::Column::CreatedAt.lt(cutoff))
            .all(&self.db)
            .await?;
        Ok(records)
    }

    /// 查询所有用户中超过指定小时数的 pending 附件
    pub async fn get_stale_pending_attachments(
        &self,
        age_hours: i64,
    ) -> anyhow::Result<Vec<sync_attachments::Model>> {
        let cutoff = chrono::Utc::now().naive_utc() - chrono::Duration::hours(age_hours);
        let attachments = sync_attachments::Entity::find()
            .filter(sync_attachments::Column::SnapshotId.eq("pending"))
            .filter(sync_attachments::Column::CreatedAt.lt(cutoff))
            .all(&self.db)
            .await?;
        Ok(attachments)
    }

    /// 按主键批量删除记录
    pub async fn delete_records_by_ids(&self, ids: &[i64]) -> anyhow::Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let result = sync_records::Entity::delete_many()
            .filter(sync_records::Column::Id.is_in(ids.to_vec()))
            .exec(&self.db)
            .await?;
        Ok(result.rows_affected)
    }

    /// 按主键批量删除附件
    pub async fn delete_attachments_by_ids(&self, ids: &[i64]) -> anyhow::Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let result = sync_attachments::Entity::delete_many()
            .filter(sync_attachments::Column::Id.is_in(ids.to_vec()))
            .exec(&self.db)
            .await?;
        Ok(result.rows_affected)
    }
}
