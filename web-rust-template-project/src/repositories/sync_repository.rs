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

    /// 获取同步历史
    pub async fn get_sync_history(
        &self,
        user_id: &str,
        limit: u32,
    ) -> anyhow::Result<Vec<sync_snapshots::Model>> {
        let snapshots = sync_snapshots::Entity::find()
            .filter(sync_snapshots::Column::UserId.eq(user_id))
            .order_by_desc(sync_snapshots::Column::CreatedAt)
            .limit(limit as u64)
            .all(&self.db)
            .await?;
        Ok(snapshots)
    }

    // ========== 记录操作 ==========

    /// 获取快照的所有记录元信息
    pub async fn get_snapshot_records(
        &self,
        snapshot_id: &str,
    ) -> anyhow::Result<Vec<sync_records::Model>> {
        let records = sync_records::Entity::find()
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
            let user_id = match &record.user_id { Set(v) => v.as_str(), _ => "" };
            let table_name = match &record.table_name { Set(v) => v.as_str(), _ => "" };
            let rid = match &record.record_id { Set(v) => v.as_str(), _ => "" };

            let existing = sync_records::Entity::find()
                .filter(sync_records::Column::UserId.eq(user_id))
                .filter(sync_records::Column::TableName.eq(table_name))
                .filter(sync_records::Column::RecordId.eq(rid))
                .one(&self.db)
                .await?;

            if let Some(existing_model) = existing {
                // 已存在 → 更新
                let mut active: sync_records::ActiveModel = existing_model.into();
                active.content_hash = record.content_hash;
                active.updated_at = record.updated_at;
                active.snapshot_id = record.snapshot_id;
                active.storage_key = record.storage_key;
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

    /// 更新用户记录的快照 ID（将 pending 关联到新快照）
    pub async fn update_records_snapshot_id(
        &self,
        user_id: &str,
        old_snapshot_id: &str,
        new_snapshot_id: &str,
    ) -> anyhow::Result<u64> {
        let result = sync_records::Entity::update_many()
            .filter(
                sync_records::Column::UserId
                    .eq(user_id)
                    .and(sync_records::Column::SnapshotId.eq(old_snapshot_id)),
            )
            .set(sync_records::ActiveModel {
                snapshot_id: Set(new_snapshot_id.to_string()),
                ..Default::default()
            })
            .exec(&self.db)
            .await?;
        Ok(result.rows_affected)
    }

    /// 只关联指定 record_id 的 pending 记录到新快照
    pub async fn update_specific_records_snapshot_id(
        &self,
        user_id: &str,
        record_ids: &[String],
        new_snapshot_id: &str,
    ) -> anyhow::Result<u64> {
        if record_ids.is_empty() {
            return Ok(0);
        }
        let result = sync_records::Entity::update_many()
            .filter(
                sync_records::Column::UserId
                    .eq(user_id)
                    .and(sync_records::Column::SnapshotId.eq("pending"))
                    .and(sync_records::Column::RecordId.is_in(record_ids.to_vec())),
            )
            .set(sync_records::ActiveModel {
                snapshot_id: Set(new_snapshot_id.to_string()),
                ..Default::default()
            })
            .exec(&self.db)
            .await?;
        Ok(result.rows_affected)
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

    /// 批量写入附件元信息（真正的 upsert：按自然键冲突时更新）
    pub async fn upsert_attachments(
        &self,
        attachments: Vec<sync_attachments::ActiveModel>,
    ) -> anyhow::Result<()> {
        for attachment in attachments {
            let uid = match &attachment.user_id { Set(v) => v.as_str(), _ => "" };
            let aid = match &attachment.attachment_id { Set(v) => v.as_str(), _ => "" };

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
}
