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

    /// 批量写入记录
    pub async fn upsert_records(
        &self,
        records: Vec<sync_records::ActiveModel>,
    ) -> anyhow::Result<()> {
        for record in records {
            record.insert(&self.db).await?;
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

    /// 批量写入附件元信息
    pub async fn upsert_attachments(
        &self,
        attachments: Vec<sync_attachments::ActiveModel>,
    ) -> anyhow::Result<()> {
        for attachment in attachments {
            attachment.insert(&self.db).await?;
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
