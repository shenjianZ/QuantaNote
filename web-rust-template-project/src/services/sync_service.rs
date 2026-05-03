use crate::domain::dto::sync::{
    CommitSyncRequest, SyncRecordPayload as DtoSyncRecordPayload,
};
use crate::domain::entities::{sync_attachments, sync_records};
use crate::domain::vo::sync::{
    AttachmentDiffResult, CommitResult, PaginatedSyncHistory, PullResult, PushResult,
    RecordMetaInfo, RemoteAttachmentInfo, SnapshotInfo, SyncHistoryEntry, SyncRecordData,
};
use crate::infra::storage::StorageBackend;
use crate::repositories::sync_repository::SyncRepository;
use bytes::Bytes;
use sea_orm::{NotSet, Set};

/// 同步服务
pub struct SyncService {
    repo: SyncRepository,
    storage: Box<dyn StorageBackend>,
}

impl SyncService {
    pub fn new(repo: SyncRepository, storage: Box<dyn StorageBackend>) -> Self {
        Self { repo, storage }
    }

    /// 获取用户最新快照
    pub async fn get_latest_snapshot(&self, user_id: &str) -> anyhow::Result<Option<SnapshotInfo>> {
        let snapshot = self.repo.get_latest_snapshot(user_id).await?;
        Ok(snapshot.map(|s| SnapshotInfo {
            snapshot_id: s.snapshot_id,
            data_hash: s.data_hash,
            record_count: s.record_count,
            total_size: s.total_size,
            created_at: s.created_at.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string(),
        }))
    }

    /// 获取快照的记录元信息
    pub async fn get_snapshot_records(
        &self,
        snapshot_id: &str,
    ) -> anyhow::Result<Vec<RecordMetaInfo>> {
        let records = self.repo.get_snapshot_records(snapshot_id).await?;
        Ok(records
            .into_iter()
            .map(|r| RecordMetaInfo {
                table_name: r.table_name,
                record_id: r.record_id,
                content_hash: r.content_hash,
                updated_at: r.updated_at.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string(),
            })
            .collect())
    }

    /// 接受客户端推送的记录
    pub async fn push_records(
        &self,
        user_id: &str,
        snapshot_id: &str,
        records: Vec<DtoSyncRecordPayload>,
    ) -> anyhow::Result<PushResult> {
        let mut accepted = Vec::new();
        let skipped = Vec::new();

        for record in &records {
            // 验证 content_hash 与实际数据是否匹配
            let computed_hash = {
                use sha2::{Digest, Sha256};
                let json_str = serde_json::to_string(&record.data).unwrap_or_default();
                let mut hasher = Sha256::new();
                hasher.update(json_str.as_bytes());
                format!("{:x}", hasher.finalize())
            };
            if computed_hash != record.content_hash {
                return Err(anyhow::anyhow!(
                    "记录 {} 的 content_hash 不匹配: 声称={}, 实际={}",
                    record.record_id,
                    record.content_hash,
                    computed_hash
                ));
            }

            // 存储记录数据到对象存储
            let storage_key = format!(
                "{}/{}/{}/{}.json",
                user_id, snapshot_id, record.table_name, record.record_id
            );
            let data = serde_json::to_vec(&record.data)?;
            self.storage
                .put_object(&storage_key, Bytes::from(data), "application/json")
                .await?;

            accepted.push(record.record_id.clone());
        }

        // 写入记录元信息
        let record_models: Vec<sync_records::ActiveModel> = records
            .iter()
            .map(|r| {
                let storage_key = format!(
                    "{}/{}/{}/{}.json",
                    user_id, snapshot_id, r.table_name, r.record_id
                );
                sync_records::ActiveModel {
                    id: NotSet,
                    user_id: Set(user_id.to_string()),
                    table_name: Set(r.table_name.clone()),
                    record_id: Set(r.record_id.clone()),
                    content_hash: Set(r.content_hash.clone()),
                    updated_at: Set(chrono::NaiveDateTime::parse_from_str(
                        &r.updated_at,
                        "%Y-%m-%dT%H:%M:%S%.3fZ",
                    )
                    .unwrap_or_else(|_| chrono::Utc::now().naive_utc())),
                    snapshot_id: Set(snapshot_id.to_string()),
                    storage_key: Set(storage_key),
                    created_at: NotSet,
                }
            })
            .collect();

        self.repo.upsert_records(record_models).await?;

        Ok(PushResult { accepted, skipped })
    }

    /// 为客户端准备拉取数据
    pub async fn pull_records(
        &self,
        user_id: &str,
        since_snapshot_id: Option<&str>,
    ) -> anyhow::Result<PullResult> {
        // 获取最新快照
        let snapshot = self
            .repo
            .get_latest_snapshot(user_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("没有找到快照"))?;

        // 如果指定了 since_snapshot_id 且与最新相同，返回空
        if let Some(since) = since_snapshot_id {
            if since == snapshot.snapshot_id {
                return Ok(PullResult {
                    records: vec![],
                    snapshot_id: snapshot.snapshot_id,
                });
            }
        }

        // 获取快照的所有记录
        let records = self.repo.get_snapshot_records(&snapshot.snapshot_id).await?;

        // 从对象存储中读取每条记录的数据
        let mut result_records = Vec::new();
        for record in records {
            let data = match self.storage.get_object(&record.storage_key).await {
                Ok(obj) => serde_json::from_slice(&obj.data).unwrap_or(serde_json::Value::Null),
                Err(_) => serde_json::Value::Null,
            };

            result_records.push(SyncRecordData {
                table_name: record.table_name,
                record_id: record.record_id,
                content_hash: record.content_hash,
                updated_at: record
                    .updated_at
                    .format("%Y-%m-%dT%H:%M:%S%.3fZ")
                    .to_string(),
                data,
            });
        }

        Ok(PullResult {
            records: result_records,
            snapshot_id: snapshot.snapshot_id,
        })
    }

    /// 比对附件差异
    pub async fn diff_attachments(
        &self,
        user_id: &str,
        client_hashes: &[String],
    ) -> anyhow::Result<AttachmentDiffResult> {
        let existing = self.repo.get_user_attachments(user_id).await?;
        let existing_hashes: std::collections::HashSet<&str> =
            existing.iter().map(|a| a.file_hash.as_str()).collect();

        let missing: Vec<String> = client_hashes
            .iter()
            .filter(|h| !existing_hashes.contains(h.as_str()))
            .cloned()
            .collect();

        let remote_attachments: Vec<RemoteAttachmentInfo> = existing
            .iter()
            .map(|a| RemoteAttachmentInfo {
                attachment_id: a.attachment_id.clone(),
                file_hash: a.file_hash.clone(),
                item_id: a.item_id.clone(),
                filename: a.filename.clone(),
                mime_type: a.mime_type.clone(),
                file_size: a.file_size,
            })
            .collect();

        Ok(AttachmentDiffResult {
            missing,
            remote_attachments,
        })
    }

    /// 上传附件
    pub async fn upload_attachment(
        &self,
        user_id: &str,
        snapshot_id: &str,
        attachment_id: &str,
        item_id: &str,
        filename: &str,
        mime_type: &str,
        file_hash: &str,
        data: Bytes,
    ) -> anyhow::Result<String> {
        let storage_key = format!(
            "{}/{}/attachments/{}/{}",
            user_id, snapshot_id, attachment_id, filename
        );

        self.storage
            .put_object(&storage_key, data, mime_type)
            .await?;

        // 写入附件元信息
        let model = sync_attachments::ActiveModel {
            id: NotSet,
            user_id: Set(user_id.to_string()),
            attachment_id: Set(attachment_id.to_string()),
            item_id: Set(item_id.to_string()),
            filename: Set(filename.to_string()),
            mime_type: Set(mime_type.to_string()),
            file_size: Set(0), // 会在 commit 时更新
            file_hash: Set(file_hash.to_string()),
            storage_key: Set(storage_key.clone()),
            snapshot_id: Set(snapshot_id.to_string()),
            created_at: NotSet,
        };
        self.repo.upsert_attachments(vec![model]).await?;

        Ok(storage_key)
    }

    /// 下载附件
    pub async fn download_attachment(
        &self,
        user_id: &str,
        attachment_id: &str,
    ) -> anyhow::Result<(Bytes, String)> {
        let attachments = self.repo.get_user_attachments(user_id).await?;
        let attachment = attachments
            .iter()
            .find(|a| a.attachment_id == attachment_id)
            .ok_or_else(|| anyhow::anyhow!("附件不存在"))?;

        let obj = self.storage.get_object(&attachment.storage_key).await?;
        Ok((obj.data, attachment.mime_type.clone()))
    }

    /// 提交同步，创建新快照
    pub async fn commit(
        &self,
        user_id: &str,
        request: CommitSyncRequest,
    ) -> anyhow::Result<CommitResult> {
        let snapshot_id = uuid::Uuid::new_v4().to_string();

        // 只关联本次推送的 pending 记录到新快照（避免多设备竞态）
        if request.pushed_record_ids.is_empty() {
            // 兼容旧客户端：关联所有 pending 记录
            self.repo
                .update_records_snapshot_id(user_id, "pending", &snapshot_id)
                .await?;
        } else {
            self.repo
                .update_specific_records_snapshot_id(
                    user_id,
                    &request.pushed_record_ids,
                    &snapshot_id,
                )
                .await?;
        }

        // 更新附件元信息（客户端在 commit 时上报完整元数据）
        for attachment in &request.attachments {
            let _ = self
                .repo
                .update_attachment_metadata(
                    user_id,
                    &attachment.attachment_id,
                    &attachment.item_id,
                    &attachment.filename,
                    &attachment.mime_type,
                    attachment.file_size,
                    &attachment.file_hash,
                    &attachment.storage_key,
                )
                .await;
        }

        // 统计实际记录数
        let record_count = self.repo.count_user_records(user_id).await?;

        // 计算数据哈希（基于所有记录的 content_hash）
        let hashes = self.repo.get_user_record_hashes(user_id).await?;
        let data_hash = {
            use sha2::{Digest, Sha256};
            let mut hasher = Sha256::new();
            for h in &hashes {
                hasher.update(h.as_bytes());
            }
            format!("{:x}", hasher.finalize())
        };

        // 创建快照
        let snapshot = self
            .repo
            .create_snapshot(
                user_id,
                &snapshot_id,
                &data_hash,
                record_count,
                0, // total_size 在记录级别不累计
            )
            .await?;

        // 清理旧快照（保留最近 20 个）
        let _ = self.cleanup_old_snapshots(user_id, 20).await;

        Ok(CommitResult {
            snapshot_id: snapshot.snapshot_id,
            created_at: snapshot
                .created_at
                .format("%Y-%m-%dT%H:%M:%S%.3fZ")
                .to_string(),
        })
    }

    /// 清理旧快照，保留最近 keep_count 个
    async fn cleanup_old_snapshots(
        &self,
        user_id: &str,
        keep_count: usize,
    ) -> anyhow::Result<()> {
        let (history, _) = self.repo.get_sync_history(user_id, 0, keep_count as u32 + 1).await?;
        if history.len() <= keep_count {
            return Ok(());
        }
        // history 按 created_at 降序排列，第 keep_count 个是保留的最旧快照
        if let Some(boundary) = history.get(keep_count - 1) {
            let _ = self
                .repo
                .delete_snapshots_before(user_id, &boundary.snapshot_id)
                .await;
        }
        Ok(())
    }

    /// 获取同步历史（分页）
    pub async fn get_history(
        &self,
        user_id: &str,
        page: u32,
        page_size: u32,
    ) -> anyhow::Result<PaginatedSyncHistory> {
        let offset = (page - 1) * page_size;
        let (snapshots, total) = self.repo.get_sync_history(user_id, offset, page_size).await?;
        let items = snapshots
            .into_iter()
            .map(|s| SyncHistoryEntry {
                snapshot_id: s.snapshot_id,
                record_count: s.record_count,
                total_size: s.total_size,
                created_at: s.created_at.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string(),
            })
            .collect();
        Ok(PaginatedSyncHistory {
            items,
            total,
            page,
            page_size,
        })
    }

    /// 重置用户所有同步数据（删除所有快照、记录和附件元信息）
    pub async fn reset_sync_data(&self, user_id: &str) -> anyhow::Result<()> {
        self.repo.delete_user_records(user_id).await?;
        self.repo.delete_user_attachments(user_id).await?;
        self.repo.delete_all_snapshots(user_id).await?;
        Ok(())
    }
}
