use crate::domain::dto::sync::{CommitSyncRequest, SyncRecordPayload as DtoSyncRecordPayload};
use crate::domain::entities::{sync_attachments, sync_records};
use crate::domain::vo::sync::{
    AttachmentDiffResult, CommitResult, PaginatedSyncHistory, PullResult, PushResult,
    RecordMetaInfo, RemoteAttachmentInfo, SnapshotInfo, SyncHistoryEntry, SyncRecordData,
};
use crate::infra::storage::StorageBackend;
use crate::repositories::sync_repository::SyncRepository;
use bytes::Bytes;
use sea_orm::{NotSet, Set};
use sha2::{Digest, Sha256};

const ATTACHMENT_CHUNK_SIZE: usize = 4 * 1024 * 1024;
const MAX_ATTACHMENT_SIZE: i64 = 50 * 1024 * 1024;

fn validate_attachment_hash(file_hash: &str) -> anyhow::Result<()> {
    if file_hash.len() != 64 || !file_hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(anyhow::anyhow!("附件哈希格式无效"));
    }
    Ok(())
}

fn expected_chunk_count(file_size: i64) -> anyhow::Result<u32> {
    if !(0..=MAX_ATTACHMENT_SIZE).contains(&file_size) {
        return Err(anyhow::anyhow!(
            "附件大小必须在 0 到 {} 字节之间",
            MAX_ATTACHMENT_SIZE
        ));
    }
    Ok(((file_size as usize + ATTACHMENT_CHUNK_SIZE - 1) / ATTACHMENT_CHUNK_SIZE).max(1) as u32)
}

fn chunk_prefix(user_id: &str, file_hash: &str) -> String {
    format!("{}/uploads/attachments/{}/chunks/", user_id, file_hash)
}

fn chunk_key(user_id: &str, file_hash: &str, chunk_index: u32) -> String {
    format!(
        "{}chunk-{:08}.part",
        chunk_prefix(user_id, file_hash),
        chunk_index
    )
}

fn safe_storage_component(value: &str, fallback: &str) -> String {
    let component: String = value
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        .take(128)
        .collect();
    if component.is_empty() {
        fallback.to_string()
    } else {
        component
    }
}

fn safe_filename(filename: &str) -> String {
    let basename = filename.rsplit(['/', '\\']).next().unwrap_or("");
    safe_storage_component(basename, "attachment.bin")
}

fn attachment_storage_key(
    user_id: &str,
    snapshot_id: &str,
    attachment_id: &str,
    filename: &str,
) -> String {
    format!(
        "{}/{}/attachments/{}/{}",
        safe_storage_component(user_id, "user"),
        safe_storage_component(snapshot_id, "pending"),
        safe_storage_component(attachment_id, "attachment"),
        safe_filename(filename)
    )
}

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

    /// 获取快照的记录元信息（校验 snapshot 归属用户）
    pub async fn get_snapshot_records(
        &self,
        user_id: &str,
        snapshot_id: &str,
    ) -> anyhow::Result<Vec<RecordMetaInfo>> {
        let records = self.repo.get_snapshot_records(user_id, snapshot_id).await?;
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
                    updated_at: Set(chrono::DateTime::parse_from_rfc3339(&r.updated_at)
                        .map(|value| value.naive_utc())
                        .or_else(|_| {
                            chrono::NaiveDateTime::parse_from_str(
                                &r.updated_at,
                                "%Y-%m-%dT%H:%M:%S%.3fZ",
                            )
                        })
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
        let records = self
            .repo
            .get_snapshot_records(user_id, &snapshot.snapshot_id)
            .await?;

        // 从对象存储中读取每条记录的数据；任意记录缺失都应让本次拉取失败，
        // 否则客户端会把不完整快照当作成功同步并刷新基线。
        let mut result_records = Vec::new();
        for record in records {
            let obj = self
                .storage
                .get_object(&record.storage_key)
                .await
                .map_err(|e| {
                    anyhow::anyhow!(
                        "读取记录对象失败: record_id={}, table={}, key={}, error={}",
                        record.record_id,
                        record.table_name,
                        record.storage_key,
                        e
                    )
                })?;

            let data: serde_json::Value = serde_json::from_slice(&obj.data).map_err(|e| {
                anyhow::anyhow!(
                    "解析记录数据失败: record_id={}, table={}, error={}",
                    record.record_id,
                    record.table_name,
                    e
                )
            })?;

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
        file_size: i64,
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
            file_size: Set(file_size),
            file_hash: Set(file_hash.to_string()),
            storage_key: Set(storage_key.clone()),
            snapshot_id: Set(snapshot_id.to_string()),
            created_at: NotSet,
        };
        self.repo.upsert_attachments(vec![model]).await?;

        Ok(storage_key)
    }

    /// 上传单个附件分片。分片以内容哈希作为稳定会话标识，重复请求幂等覆盖同一分片。
    pub async fn upload_attachment_chunk(
        &self,
        user_id: &str,
        file_hash: &str,
        file_size: i64,
        chunk_index: u32,
        total_chunks: u32,
        chunk_hash: &str,
        data: Bytes,
    ) -> anyhow::Result<()> {
        validate_attachment_hash(file_hash)?;
        let expected_total = expected_chunk_count(file_size)?;
        if total_chunks != expected_total {
            return Err(anyhow::anyhow!("分片总数与附件大小不匹配"));
        }
        if chunk_index >= total_chunks {
            return Err(anyhow::anyhow!("分片序号超出范围"));
        }

        let start = chunk_index as usize * ATTACHMENT_CHUNK_SIZE;
        let expected_len = if file_size == 0 {
            0
        } else {
            std::cmp::min(ATTACHMENT_CHUNK_SIZE, file_size as usize - start)
        };
        if data.len() != expected_len {
            return Err(anyhow::anyhow!(
                "分片大小不匹配: expected={}, actual={}",
                expected_len,
                data.len()
            ));
        }

        let mut hasher = Sha256::new();
        hasher.update(&data);
        let actual_hash = format!("{:x}", hasher.finalize());
        if actual_hash != chunk_hash.to_ascii_lowercase() {
            return Err(anyhow::anyhow!("分片哈希校验失败"));
        }

        self.storage
            .put_object(
                &chunk_key(user_id, file_hash, chunk_index),
                data,
                "application/octet-stream",
            )
            .await?;
        Ok(())
    }

    /// 查询已上传的分片序号，供客户端在中断后继续上传。
    pub async fn get_attachment_upload_status(
        &self,
        user_id: &str,
        file_hash: &str,
        total_chunks: u32,
    ) -> anyhow::Result<Vec<u32>> {
        validate_attachment_hash(file_hash)?;
        if total_chunks == 0 {
            return Err(anyhow::anyhow!("分片总数不能为 0"));
        }

        let prefix = chunk_prefix(user_id, file_hash);
        let mut received: Vec<u32> = self
            .storage
            .list_objects(&prefix)
            .await?
            .into_iter()
            .filter_map(|metadata| {
                let name = metadata.key.rsplit('/').next()?;
                let index = name.strip_prefix("chunk-")?.strip_suffix(".part")?;
                index.parse::<u32>().ok()
            })
            .filter(|index| *index < total_chunks)
            .collect();
        received.sort_unstable();
        received.dedup();
        Ok(received)
    }

    /// 合并分片、校验完整文件并写入正式附件对象。
    pub async fn complete_attachment_upload(
        &self,
        user_id: &str,
        snapshot_id: &str,
        attachment_id: &str,
        item_id: &str,
        filename: &str,
        mime_type: &str,
        file_hash: &str,
        file_size: i64,
        total_chunks: u32,
    ) -> anyhow::Result<String> {
        validate_attachment_hash(file_hash)?;
        let expected_total = expected_chunk_count(file_size)?;
        if total_chunks != expected_total {
            return Err(anyhow::anyhow!("分片总数与附件大小不匹配"));
        }

        let storage_key = attachment_storage_key(user_id, snapshot_id, attachment_id, filename);
        // 客户端可能在完成请求成功、但响应丢失后重试。正式对象已存在时，校验后直接返回，
        // 避免因成功清理分片而让重复完成请求失败。
        if self.storage.exists(&storage_key).await? {
            let object = self.storage.get_object(&storage_key).await?;
            if object.data.len() as i64 != file_size {
                return Err(anyhow::anyhow!("已存在附件大小与请求不匹配"));
            }
            let mut hasher = Sha256::new();
            hasher.update(&object.data);
            if format!("{:x}", hasher.finalize()) != file_hash.to_ascii_lowercase() {
                return Err(anyhow::anyhow!("已存在附件完整性校验失败"));
            }
            return Ok(storage_key);
        }

        let received = self
            .get_attachment_upload_status(user_id, file_hash, total_chunks)
            .await?;
        if received.len() != total_chunks as usize {
            return Err(anyhow::anyhow!(
                "附件分片尚未全部上传: received={}, expected={}",
                received.len(),
                total_chunks
            ));
        }

        let mut data = Vec::with_capacity(file_size as usize);
        for chunk_index in 0..total_chunks {
            let object = self
                .storage
                .get_object(&chunk_key(user_id, file_hash, chunk_index))
                .await?;
            let start = chunk_index as usize * ATTACHMENT_CHUNK_SIZE;
            let expected_len = if file_size == 0 {
                0
            } else {
                std::cmp::min(ATTACHMENT_CHUNK_SIZE, file_size as usize - start)
            };
            if object.data.len() != expected_len {
                return Err(anyhow::anyhow!("分片大小校验失败: index={}", chunk_index));
            }
            data.extend_from_slice(&object.data);
        }

        let mut hasher = Sha256::new();
        hasher.update(&data);
        let actual_hash = format!("{:x}", hasher.finalize());
        if actual_hash != file_hash.to_ascii_lowercase() {
            return Err(anyhow::anyhow!("附件完整性校验失败"));
        }

        self.storage
            .put_object(&storage_key, Bytes::from(data), mime_type)
            .await?;

        let model = sync_attachments::ActiveModel {
            id: NotSet,
            user_id: Set(user_id.to_string()),
            attachment_id: Set(attachment_id.to_string()),
            item_id: Set(item_id.to_string()),
            filename: Set(filename.to_string()),
            mime_type: Set(mime_type.to_string()),
            file_size: Set(file_size),
            file_hash: Set(file_hash.to_string()),
            storage_key: Set(storage_key.clone()),
            snapshot_id: Set(snapshot_id.to_string()),
            created_at: NotSet,
        };
        self.repo.upsert_attachments(vec![model]).await?;

        let chunk_keys: Vec<String> = (0..total_chunks)
            .map(|index| chunk_key(user_id, file_hash, index))
            .collect();
        if let Err(error) = self.storage.delete_objects(&chunk_keys).await {
            tracing::warn!(
                user_id,
                file_hash,
                error = %error,
                "清理已完成附件的分片失败"
            );
        }

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

        // 1. 获取 pending 记录（用于移动文件），只处理本次明确提交的记录
        let pending_records = if !request.pushed_records.is_empty() {
            self.repo
                .get_pending_records_by_composite_ids(user_id, &request.pushed_records)
                .await?
        } else if !request.pushed_record_ids.is_empty() {
            self.repo
                .get_pending_records_by_ids(user_id, &request.pushed_record_ids)
                .await?
        } else {
            Vec::new()
        };

        // 2. 先更新 DB 中的 storage_key 和 snapshot_id（DB 操作失败不会留下孤立文件）
        //    记录 key 映射，后续移动文件时使用
        let mut key_moves: Vec<(String, String)> = Vec::new();
        for record in &pending_records {
            let old_key = record.storage_key.clone();
            let new_key = format!(
                "{}/{}/{}/{}.json",
                user_id, snapshot_id, record.table_name, record.record_id
            );
            self.repo
                .update_record_storage_key(record.id, &new_key)
                .await?;
            key_moves.push((old_key, new_key));
        }

        // 3. 移动文件（幂等操作，重试安全）
        for (old_key, new_key) in &key_moves {
            self.storage.move_object(old_key, new_key).await?;
        }

        // 3. 将用户所有记录关联到新快照（确保最新快照是完整视图，而非增量快照）
        self.repo
            .update_all_records_snapshot_id(user_id, &snapshot_id)
            .await?;

        // 4. 将本次上传的 pending 附件移动到新快照，并保留上传时记录的真实 hash/storage_key。
        let attachment_ids: Vec<String> = request
            .attachments
            .iter()
            .map(|a| a.attachment_id.clone())
            .collect();
        if request.attachments_complete {
            let pending_attachments = self
                .repo
                .get_pending_attachments_by_ids(user_id, &attachment_ids)
                .await?;
            // 先更新 DB，再移动文件
            let mut att_key_moves: Vec<(String, String)> = Vec::new();
            for attachment in &pending_attachments {
                let old_key = attachment.storage_key.clone();
                let new_key = format!(
                    "{}/{}/attachments/{}/{}",
                    user_id, snapshot_id, attachment.attachment_id, attachment.filename
                );
                self.repo
                    .update_attachment_storage_key_snapshot(attachment.id, &new_key, &snapshot_id)
                    .await?;
                att_key_moves.push((old_key, new_key));
            }
            for (old_key, new_key) in &att_key_moves {
                self.storage.move_object(old_key, new_key).await?;
            }

            // 5. 更新附件元信息（客户端在 commit 时上报当前完整附件列表）。
            // 客户端无法可靠构造服务端 storage_key，仓库层会忽略空 storage_key。
            for attachment in &request.attachments {
                self.repo
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
                    .await?;
            }
            self.repo
                .delete_attachments_not_in_ids(user_id, &attachment_ids)
                .await?;
            self.repo
                .update_all_attachments_snapshot_id(user_id, &snapshot_id)
                .await?;
        }

        // 统计实际记录数
        let record_count = self.repo.count_user_records(user_id).await?;

        // 计算数据哈希（基于所有记录的 content_hash）
        let hashes = self.repo.get_user_record_hashes(user_id).await?;
        let data_hash = {
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
    async fn cleanup_old_snapshots(&self, user_id: &str, keep_count: usize) -> anyhow::Result<()> {
        let (history, _) = self
            .repo
            .get_sync_history(user_id, 0, keep_count as u32 + 1)
            .await?;
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
        let (snapshots, total) = self
            .repo
            .get_sync_history(user_id, offset, page_size)
            .await?;
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

    /// 清理过期的 pending 孤儿数据（记录 + 附件 + 存储文件）
    pub async fn cleanup_stale_pending(&self, age_hours: i64) -> anyhow::Result<CleanupStats> {
        let mut stats = CleanupStats::default();

        // 1. 清理过期 pending 记录
        let stale_records = self.repo.get_stale_pending_records(age_hours).await?;
        if !stale_records.is_empty() {
            let storage_keys: Vec<String> = stale_records
                .iter()
                .map(|r| r.storage_key.clone())
                .filter(|k| !k.is_empty())
                .collect();
            let ids: Vec<i64> = stale_records.iter().map(|r| r.id).collect();

            // 先删存储文件（单条失败不中断）
            for key in &storage_keys {
                if let Err(e) = self.storage.delete_object(key).await {
                    tracing::warn!("清理 pending 存储文件失败 key={}: {}", key, e);
                    stats.storage_errors += 1;
                }
            }
            // 再删 DB 记录
            match self.repo.delete_records_by_ids(&ids).await {
                Ok(n) => stats.records_deleted = n,
                Err(e) => tracing::error!("清理 pending 记录 DB 失败: {}", e),
            }
        }

        // 2. 清理过期 pending 附件
        let stale_attachments = self.repo.get_stale_pending_attachments(age_hours).await?;
        if !stale_attachments.is_empty() {
            let storage_keys: Vec<String> = stale_attachments
                .iter()
                .map(|a| a.storage_key.clone())
                .filter(|k| !k.is_empty())
                .collect();
            let ids: Vec<i64> = stale_attachments.iter().map(|a| a.id).collect();
            let total_size: i64 = stale_attachments.iter().map(|a| a.file_size).sum();

            // 先删存储文件
            for key in &storage_keys {
                if let Err(e) = self.storage.delete_object(key).await {
                    tracing::warn!("清理 pending 附件存储失败 key={}: {}", key, e);
                    stats.storage_errors += 1;
                }
            }
            // 再删 DB 记录
            match self.repo.delete_attachments_by_ids(&ids).await {
                Ok(n) => stats.attachments_deleted = n,
                Err(e) => tracing::error!("清理 pending 附件 DB 失败: {}", e),
            }
            stats.bytes_freed = total_size;
        }

        Ok(stats)
    }
}

/// Pending 清理统计
#[derive(Debug, Default)]
pub struct CleanupStats {
    pub records_deleted: u64,
    pub attachments_deleted: u64,
    pub bytes_freed: i64,
    pub storage_errors: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expected_chunk_count_matches_file_size() {
        assert_eq!(expected_chunk_count(0).unwrap(), 1);
        assert_eq!(
            expected_chunk_count(ATTACHMENT_CHUNK_SIZE as i64).unwrap(),
            1
        );
        assert_eq!(
            expected_chunk_count(ATTACHMENT_CHUNK_SIZE as i64 + 1).unwrap(),
            2
        );
        assert!(expected_chunk_count(-1).is_err());
        assert!(expected_chunk_count(MAX_ATTACHMENT_SIZE + 1).is_err());
    }

    #[test]
    fn attachment_hash_and_storage_names_are_safe() {
        assert!(validate_attachment_hash(&"a".repeat(64)).is_ok());
        assert!(validate_attachment_hash("not-a-hash").is_err());
        assert_eq!(safe_filename("../../photo.png"), "photo.png");
        assert_eq!(safe_filename(r"..\photo.png"), "photo.png");
        assert!(
            !attachment_storage_key("user/1", "pending", "attachment/1", "x.png")
                .contains("user/1")
        );
    }
}
