use crate::error::AppError;
use crate::models::sync::*;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::sync::Mutex;

pub const ATTACHMENT_CHUNK_SIZE: usize = 4 * 1024 * 1024;

/// 判断 HTTP 状态码是否值得重试
fn is_retryable_status(status: reqwest::StatusCode) -> bool {
    status.is_server_error() || status == reqwest::StatusCode::TOO_MANY_REQUESTS
}

/// 判断错误是否值得重试（网络层错误）
fn is_retryable_error(err: &reqwest::Error) -> bool {
    err.is_timeout() || err.is_connect() || err.is_request()
}

/// API 响应结构
#[derive(Debug, Deserialize)]
struct ApiResponse<T> {
    code: u16,
    message: String,
    data: Option<T>,
}

/// 快照信息
#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct SnapshotInfo {
    pub snapshot_id: String,
    pub data_hash: String,
    pub record_count: i32,
    pub total_size: i64,
    pub created_at: String,
}

/// 记录元信息（从服务端返回）
#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct RecordMetaInfo {
    pub table_name: String,
    pub record_id: String,
    pub content_hash: String,
    pub updated_at: String,
}

/// 推送结果
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct PushResult {
    pub accepted: Vec<String>,
    pub skipped: Vec<String>,
}

/// 拉取结果
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct PullResult {
    pub records: Vec<SyncRecordPayload>,
    pub snapshot_id: String,
}

/// 远程附件元信息
#[derive(Debug, Deserialize, Clone)]
pub struct RemoteAttachmentInfo {
    pub attachment_id: String,
    pub file_hash: String,
    pub item_id: String,
    pub filename: String,
    pub mime_type: String,
    pub file_size: i64,
}

/// 附件差异结果
#[derive(Debug, Deserialize)]
pub struct AttachmentDiffResult {
    /// 服务端缺少的附件 hash（需要上传）
    pub missing: Vec<String>,
    /// 服务端已有的附件列表（用于判断需要下载哪些）
    pub remote_attachments: Vec<RemoteAttachmentInfo>,
}

/// 提交结果
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct CommitResult {
    pub snapshot_id: String,
    pub created_at: String,
}

/// 同步历史条目
#[derive(Debug, Serialize, Deserialize)]
pub struct SyncHistoryEntry {
    pub snapshot_id: String,
    pub record_count: i32,
    pub total_size: i64,
    pub created_at: String,
}

/// 分页同步历史响应
#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedSyncHistory {
    pub items: Vec<SyncHistoryEntry>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
}

/// 账户下的同步设备会话
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceSessionInfo {
    pub device_id: String,
    pub created_at: String,
    pub last_seen_at: String,
    pub expires_at: String,
    pub is_current: bool,
}

/// 远端附件分片上传状态
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttachmentUploadStatus {
    pub file_hash: String,
    pub total_chunks: u32,
    pub received_chunks: Vec<u32>,
}

/// 远端附件下载分段响应
#[derive(Debug)]
pub struct AttachmentDownloadRange {
    pub data: Vec<u8>,
    pub start: u64,
    pub total_size: u64,
}

/// token 刷新后的回调类型
pub type TokenRefreshCallback = Box<dyn Fn(String, String) + Send + Sync>;

/// HTTP 传输层（支持自动 token 刷新 + 设备绑定）
pub struct SyncTransport {
    client: Client,
    server_url: String,
    access_token: Arc<Mutex<String>>,
    refresh_token: Arc<Mutex<String>>,
    device_id: String,
    /// 防止并发刷新：true 表示正在刷新中
    refreshing: Arc<Mutex<bool>>,
    /// 刷新完成后通知等待者
    refresh_notify: Arc<tokio::sync::Notify>,
    /// token 刷新成功后的回调（用于即时持久化）
    on_token_refreshed: Option<Arc<TokenRefreshCallback>>,
}

impl Clone for SyncTransport {
    fn clone(&self) -> Self {
        Self {
            client: Client::new(),
            server_url: self.server_url.clone(),
            access_token: Arc::clone(&self.access_token),
            refresh_token: Arc::clone(&self.refresh_token),
            device_id: self.device_id.clone(),
            refreshing: Arc::clone(&self.refreshing),
            refresh_notify: Arc::clone(&self.refresh_notify),
            on_token_refreshed: self.on_token_refreshed.clone(),
        }
    }
}

impl SyncTransport {
    pub fn new(server_url: &str, access_token: &str, refresh_token: &str, device_id: &str) -> Self {
        Self {
            client: Client::new(),
            server_url: server_url.trim_end_matches('/').to_string(),
            access_token: Arc::new(Mutex::new(access_token.to_string())),
            refresh_token: Arc::new(Mutex::new(refresh_token.to_string())),
            device_id: device_id.to_string(),
            refreshing: Arc::new(Mutex::new(false)),
            refresh_notify: Arc::new(tokio::sync::Notify::new()),
            on_token_refreshed: None,
        }
    }

    /// 创建带回调的 transport（刷新成功后立即持久化 token）
    pub fn new_with_callback(
        server_url: &str,
        access_token: &str,
        refresh_token: &str,
        device_id: &str,
        callback: TokenRefreshCallback,
    ) -> Self {
        Self {
            client: Client::new(),
            server_url: server_url.trim_end_matches('/').to_string(),
            access_token: Arc::new(Mutex::new(access_token.to_string())),
            refresh_token: Arc::new(Mutex::new(refresh_token.to_string())),
            device_id: device_id.to_string(),
            refreshing: Arc::new(Mutex::new(false)),
            refresh_notify: Arc::new(tokio::sync::Notify::new()),
            on_token_refreshed: Some(Arc::new(callback)),
        }
    }

    async fn auth_header(&self) -> String {
        let token = self.access_token.lock().await;
        format!("Bearer {}", token)
    }

    /// 获取当前 tokens（用于持久化）
    pub async fn get_tokens(&self) -> (String, String) {
        let at = self.access_token.lock().await.clone();
        let rt = self.refresh_token.lock().await.clone();
        (at, rt)
    }

    /// 刷新 access_token（带防重复刷新）
    async fn refresh_access_token(&self) -> Result<(), AppError> {
        // 检查是否已有其他请求在刷新
        {
            let mut flag = self.refreshing.lock().await;
            if *flag {
                // 已有请求在刷新，等待完成通知
                drop(flag);
                let notified = self.refresh_notify.notified();
                // notified 是 Future，等待刷新完成后会收到通知
                // 加超时防止死锁
                tokio::pin!(notified);
                let timeout = tokio::time::sleep(std::time::Duration::from_secs(5));
                tokio::pin!(timeout);
                tokio::select! {
                    _ = &mut notified => {
                        // 刷新完成，新 token 已就绪
                        return Ok(());
                    }
                    _ = &mut timeout => {
                        return Err(AppError::SyncError("等待 token 刷新超时".to_string()));
                    }
                }
            }
            *flag = true;
        }

        // 执行刷新
        let result = self.do_refresh().await;

        // 清除刷新标记并通知等待者
        *self.refreshing.lock().await = false;
        self.refresh_notify.notify_waiters();

        result
    }

    /// 实际执行 token 刷新
    async fn do_refresh(&self) -> Result<(), AppError> {
        let rt = self.refresh_token.lock().await.clone();
        let url = format!("{}/auth/refresh", self.server_url);
        log::debug!("POST {}", url);
        let resp = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "refresh_token": rt,
                "device_id": self.device_id
            }))
            .send()
            .await
            .map_err(|e| AppError::SyncError(format!("刷新 token 请求失败: {}", e)))?;

        let body: ApiResponse<RefreshResult> = resp
            .json()
            .await
            .map_err(|e| AppError::SyncError(format!("解析刷新响应失败: {}", e)))?;

        if body.code == 200 {
            if let Some(data) = body.data {
                // 原子更新内存中的 token（同时持有两把锁，避免中间状态）
                {
                    let mut at = self.access_token.lock().await;
                    let mut rt = self.refresh_token.lock().await;
                    *at = data.access_token.clone();
                    *rt = data.refresh_token.clone();
                }
                // 立即持久化（在返回 Ok 之前，确保不丢失）
                if let Some(ref cb) = self.on_token_refreshed {
                    cb(data.access_token, data.refresh_token);
                }
                Ok(())
            } else {
                Err(AppError::TokenExpired)
            }
        } else {
            Err(AppError::TokenExpired)
        }
    }

    pub async fn handle_response<T: for<'de> Deserialize<'de>>(
        &self,
        resp: reqwest::Response,
    ) -> Result<T, AppError> {
        let status = resp.status();

        if !status.is_success() {
            // 非 2xx：先读取原始 body 文本，尽可能保留错误信息
            let body_text = resp
                .text()
                .await
                .unwrap_or_else(|_| "无法读取响应体".to_string());
            // 尝试解析为 JSON 获取 message 字段
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body_text) {
                let msg = json["message"].as_str().unwrap_or(&body_text);
                return Err(AppError::SyncError(format!(
                    "HTTP {}: {}",
                    status.as_u16(),
                    msg
                )));
            }
            return Err(AppError::SyncError(format!(
                "HTTP {}: {}",
                status.as_u16(),
                body_text
            )));
        }

        let body: ApiResponse<T> = resp
            .json()
            .await
            .map_err(|e| AppError::SyncError(format!("解析响应失败: {}", e)))?;

        if body.code == 200 {
            body.data
                .ok_or_else(|| AppError::SyncError("响应数据为空".to_string()))
        } else {
            Err(AppError::SyncError(format!(
                "业务错误 ({}): {}",
                body.code, body.message
            )))
        }
    }

    /// 带指数退避的请求执行（对可重试的瞬态错误自动重试）
    async fn execute_with_retry(
        &self,
        req: reqwest::Request,
    ) -> Result<reqwest::Response, AppError> {
        const MAX_RETRIES: u32 = 3;
        const INITIAL_BACKOFF_MS: u64 = 500;

        log::debug!("{} {}", req.method(), req.url());

        let mut last_err: Option<String> = None;

        for attempt in 0..MAX_RETRIES {
            let req_clone = req
                .try_clone()
                .ok_or_else(|| AppError::SyncError("无法克隆请求".to_string()))?;

            match self.client.execute(req_clone).await {
                Ok(resp) => {
                    if is_retryable_status(resp.status()) && attempt < MAX_RETRIES - 1 {
                        let backoff = INITIAL_BACKOFF_MS * 2u64.pow(attempt);
                        last_err = Some(format!("HTTP {}", resp.status().as_u16()));
                        tokio::time::sleep(std::time::Duration::from_millis(backoff)).await;
                        continue;
                    }
                    return Ok(resp);
                }
                Err(e) => {
                    if is_retryable_error(&e) && attempt < MAX_RETRIES - 1 {
                        let backoff = INITIAL_BACKOFF_MS * 2u64.pow(attempt);
                        last_err = Some(format!("网络错误: {}", e));
                        tokio::time::sleep(std::time::Duration::from_millis(backoff)).await;
                        continue;
                    }
                    return Err(AppError::SyncError(format!("请求失败: {}", e)));
                }
            }
        }

        Err(AppError::SyncError(format!(
            "请求失败（已重试 {} 次）: {}",
            MAX_RETRIES,
            last_err.unwrap_or_else(|| "未知错误".to_string())
        )))
    }

    /// 发送带认证的请求，遇到 401 自动刷新 token 并重试，其他瞬态错误自动重试
    async fn send_auth_with_refresh(
        &self,
        builder: reqwest::RequestBuilder,
    ) -> Result<reqwest::Response, AppError> {
        // 构建 request（不带 auth header），用于 clone 重试
        let mut req = builder
            .build()
            .map_err(|e| AppError::SyncError(format!("构建请求失败: {}", e)))?;

        // 第一次尝试：添加当前 token
        req.headers_mut().insert(
            reqwest::header::AUTHORIZATION,
            reqwest::header::HeaderValue::from_str(&self.auth_header().await)
                .map_err(|e| AppError::SyncError(format!("无效的 auth header: {}", e)))?,
        );

        let resp = self
            .execute_with_retry(
                req.try_clone()
                    .ok_or_else(|| AppError::SyncError("无法克隆请求".to_string()))?,
            )
            .await?;

        if resp.status() != reqwest::StatusCode::UNAUTHORIZED {
            return Ok(resp);
        }

        // 401 → 刷新 token
        self.refresh_access_token().await?;

        // 用新 token 重试
        let mut req2 = req;
        req2.headers_mut().insert(
            reqwest::header::AUTHORIZATION,
            reqwest::header::HeaderValue::from_str(&self.auth_header().await)
                .map_err(|e| AppError::SyncError(format!("无效的 auth header: {}", e)))?,
        );

        let resp2 = self.execute_with_retry(req2).await?;

        Ok(resp2)
    }

    /// 登录
    pub async fn login(&self, email: &str, password: &str) -> Result<SyncLoginResult, AppError> {
        let url = format!("{}/auth/login", self.server_url);
        log::debug!("POST {}", url);
        let resp = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "email": email,
                "password": password,
                "device_id": self.device_id
            }))
            .send()
            .await
            .map_err(|e| AppError::SyncError(format!("请求失败: {}", e)))?;

        let body: ApiResponse<SyncLoginResult> = resp
            .json()
            .await
            .map_err(|e| AppError::SyncError(format!("解析响应失败: {}", e)))?;

        if body.code == 200 {
            body.data
                .ok_or_else(|| AppError::SyncError("响应数据为空".to_string()))
        } else {
            Err(AppError::SyncError(format!("登录失败: {}", body.message)))
        }
    }

    /// 注册
    pub async fn register(
        &self,
        email: &str,
        password: &str,
        verify_code: Option<&str>,
    ) -> Result<SyncLoginResult, AppError> {
        let url = format!("{}/auth/register", self.server_url);
        log::debug!("POST {}", url);
        let mut body = serde_json::json!({
            "email": email,
            "password": password,
            "device_id": self.device_id
        });
        if let Some(code) = verify_code {
            body["verify_code"] = serde_json::Value::String(code.to_string());
        }
        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::SyncError(format!("请求失败: {}", e)))?;

        let body: ApiResponse<SyncLoginResult> = resp
            .json()
            .await
            .map_err(|e| AppError::SyncError(format!("解析响应失败: {}", e)))?;

        if body.code == 200 {
            body.data
                .ok_or_else(|| AppError::SyncError("响应数据为空".to_string()))
        } else {
            Err(AppError::SyncError(format!("注册失败: {}", body.message)))
        }
    }

    /// 发送验证码
    pub async fn send_verify_code(&self, email: &str, lang: &str) -> Result<(), AppError> {
        let url = format!("{}/auth/send-verify-code", self.server_url);
        log::debug!("POST {}", url);
        let resp = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "email": email,
                "lang": lang
            }))
            .send()
            .await
            .map_err(|e| AppError::SyncError(format!("请求失败: {}", e)))?;

        let body: ApiResponse<serde_json::Value> = resp
            .json()
            .await
            .map_err(|e| AppError::SyncError(format!("解析响应失败: {}", e)))?;

        if body.code == 200 {
            Ok(())
        } else {
            Err(AppError::SyncError(format!(
                "发送验证码失败: {}",
                body.message
            )))
        }
    }

    /// 忘记密码
    pub async fn forgot_password(
        &self,
        email: &str,
        lang: &str,
    ) -> Result<Option<String>, AppError> {
        let url = format!("{}/auth/forgot-password", self.server_url);
        log::debug!("POST {}", url);
        let resp = self
            .client
            .post(&url)
            .json(&serde_json::json!({ "email": email, "lang": lang }))
            .send()
            .await
            .map_err(|e| AppError::SyncError(format!("请求失败: {}", e)))?;

        let body: ApiResponse<serde_json::Value> = resp
            .json()
            .await
            .map_err(|e| AppError::SyncError(format!("解析响应失败: {}", e)))?;

        if body.code == 200 {
            let data = body
                .data
                .ok_or_else(|| AppError::SyncError("响应数据为空".to_string()))?;
            // reset_token 可能为 null（邮件模式）或有值（开发模式）
            let token = data["reset_token"].as_str().map(|s| s.to_string());
            Ok(token)
        } else {
            Err(AppError::SyncError(format!("请求失败: {}", body.message)))
        }
    }

    /// 重置密码
    pub async fn reset_password(
        &self,
        email: &str,
        reset_token: &str,
        new_password: &str,
    ) -> Result<(), AppError> {
        let url = format!("{}/auth/reset-password", self.server_url);
        log::debug!("POST {}", url);
        let resp = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "email": email,
                "reset_token": reset_token,
                "new_password": new_password
            }))
            .send()
            .await
            .map_err(|e| AppError::SyncError(format!("请求失败: {}", e)))?;

        let body: ApiResponse<serde_json::Value> = resp
            .json()
            .await
            .map_err(|e| AppError::SyncError(format!("解析响应失败: {}", e)))?;

        if body.code == 200 {
            Ok(())
        } else {
            Err(AppError::SyncError(format!(
                "重置密码失败: {}",
                body.message
            )))
        }
    }

    /// 测试连接
    pub async fn test_connection(&self) -> Result<bool, AppError> {
        let url = format!("{}/health", self.server_url);
        log::debug!("GET {}", url);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::SyncError(format!("连接失败: {}", e)))?;
        Ok(resp.status().is_success())
    }

    /// 获取最新快照（data 为 null 表示尚无快照，返回 Ok(None)）
    pub async fn get_latest_snapshot(&self) -> Result<Option<SnapshotInfo>, AppError> {
        let url = format!("{}/sync/snapshot/latest", self.server_url);
        let builder = self.client.get(&url);
        let resp = self.send_auth_with_refresh(builder).await?;

        let body: ApiResponse<SnapshotInfo> = resp
            .json()
            .await
            .map_err(|e| AppError::SyncError(format!("解析响应失败: {}", e)))?;

        if body.code == 200 {
            Ok(body.data)
        } else {
            Err(AppError::SyncError(format!("请求失败: {}", body.message)))
        }
    }

    /// 获取快照记录
    pub async fn get_snapshot_records(
        &self,
        snapshot_id: &str,
    ) -> Result<Vec<RecordMetaInfo>, AppError> {
        let url = format!("{}/sync/snapshot/{}/records", self.server_url, snapshot_id);
        let builder = self.client.get(&url);
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }

    /// 推送记录
    pub async fn push_records(
        &self,
        records: Vec<SyncRecordPayload>,
    ) -> Result<PushResult, AppError> {
        let url = format!("{}/sync/records/push", self.server_url);
        let builder = self
            .client
            .post(&url)
            .json(&serde_json::json!({ "records": records }));
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }

    /// 拉取记录
    pub async fn pull_records(
        &self,
        since_snapshot_id: Option<&str>,
    ) -> Result<PullResult, AppError> {
        let url = format!("{}/sync/records/pull", self.server_url);
        let builder = self
            .client
            .post(&url)
            .json(&serde_json::json!({ "since_snapshot_id": since_snapshot_id }));
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }

    /// 附件差异
    pub async fn diff_attachments(
        &self,
        hashes: Vec<String>,
    ) -> Result<AttachmentDiffResult, AppError> {
        let url = format!("{}/sync/attachments/diff", self.server_url);
        let builder = self
            .client
            .post(&url)
            .json(&serde_json::json!({ "hashes": hashes }));
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }

    /// 上传附件
    pub async fn upload_attachment(
        &self,
        attachment_id: &str,
        item_id: &str,
        filename: &str,
        mime_type: &str,
        file_hash: &str,
        file_size: i64,
        snapshot_id: &str,
        data: Vec<u8>,
    ) -> Result<String, AppError> {
        let mut url = reqwest::Url::parse(&format!("{}/sync/attachments/upload", self.server_url))
            .map_err(|e| AppError::SyncError(format!("URL 解析失败: {}", e)))?;
        url.query_pairs_mut()
            .append_pair("attachment_id", attachment_id)
            .append_pair("item_id", item_id)
            .append_pair("filename", filename)
            .append_pair("mime_type", mime_type)
            .append_pair("file_hash", file_hash)
            .append_pair("file_size", &file_size.to_string())
            .append_pair("snapshot_id", snapshot_id);
        let builder = self.client.post(url).body(data);
        let resp = self.send_auth_with_refresh(builder).await?;

        let body: ApiResponse<serde_json::Value> = resp
            .json()
            .await
            .map_err(|e| AppError::SyncError(format!("解析响应失败: {}", e)))?;

        if body.code == 200 {
            let data = body
                .data
                .ok_or_else(|| AppError::SyncError("响应数据为空".to_string()))?;
            data["storage_key"]
                .as_str()
                .map(|s| s.to_string())
                .ok_or_else(|| AppError::SyncError("未返回存储键".to_string()))
        } else {
            Err(AppError::SyncError(format!("上传失败: {}", body.message)))
        }
    }

    /// 使用分片协议上传附件，并在服务端可用时复用已完成分片。
    /// 对不支持分片端点的旧服务端回退到完整上传。
    pub async fn upload_attachment_resumable(
        &self,
        attachment_id: &str,
        item_id: &str,
        filename: &str,
        mime_type: &str,
        file_hash: &str,
        snapshot_id: &str,
        data: Vec<u8>,
    ) -> Result<String, AppError> {
        let total_chunks = std::cmp::max(
            1,
            (data.len() + ATTACHMENT_CHUNK_SIZE - 1) / ATTACHMENT_CHUNK_SIZE,
        ) as u32;
        let status = match self
            .get_attachment_upload_status(file_hash, total_chunks)
            .await
        {
            Ok(status) => status,
            Err(AppError::SyncError(message))
                if message.contains("HTTP 404") || message.contains("HTTP 405") =>
            {
                return self
                    .upload_attachment(
                        attachment_id,
                        item_id,
                        filename,
                        mime_type,
                        file_hash,
                        data.len() as i64,
                        snapshot_id,
                        data,
                    )
                    .await;
            }
            Err(error) => return Err(error),
        };

        for chunk_index in 0..total_chunks {
            if status.received_chunks.contains(&chunk_index) {
                continue;
            }
            let start = chunk_index as usize * ATTACHMENT_CHUNK_SIZE;
            let end = std::cmp::min(start + ATTACHMENT_CHUNK_SIZE, data.len());
            let chunk = data[start..end].to_vec();
            let mut hasher = Sha256::new();
            hasher.update(&chunk);
            let chunk_hash = format!("{:x}", hasher.finalize());
            self.upload_attachment_chunk(
                attachment_id,
                item_id,
                filename,
                mime_type,
                file_hash,
                data.len() as i64,
                snapshot_id,
                chunk_index,
                total_chunks,
                &chunk_hash,
                chunk,
            )
            .await?;
        }

        self.complete_attachment_upload(
            attachment_id,
            item_id,
            filename,
            mime_type,
            file_hash,
            data.len() as i64,
            snapshot_id,
            total_chunks,
        )
        .await
    }

    async fn upload_attachment_chunk(
        &self,
        attachment_id: &str,
        item_id: &str,
        filename: &str,
        mime_type: &str,
        file_hash: &str,
        file_size: i64,
        snapshot_id: &str,
        chunk_index: u32,
        total_chunks: u32,
        chunk_hash: &str,
        data: Vec<u8>,
    ) -> Result<(), AppError> {
        let mut url = reqwest::Url::parse(&format!(
            "{}/sync/attachments/upload/chunk",
            self.server_url
        ))
        .map_err(|e| AppError::SyncError(format!("URL 解析失败: {}", e)))?;
        url.query_pairs_mut()
            .append_pair("attachment_id", attachment_id)
            .append_pair("item_id", item_id)
            .append_pair("filename", filename)
            .append_pair("mime_type", mime_type)
            .append_pair("file_hash", file_hash)
            .append_pair("file_size", &file_size.to_string())
            .append_pair("snapshot_id", snapshot_id)
            .append_pair("chunk_index", &chunk_index.to_string())
            .append_pair("total_chunks", &total_chunks.to_string())
            .append_pair("chunk_hash", chunk_hash);
        let builder = self.client.post(url).body(data);
        let resp = self.send_auth_with_refresh(builder).await?;
        let _: serde_json::Value = self.handle_response(resp).await?;
        Ok(())
    }

    async fn get_attachment_upload_status(
        &self,
        file_hash: &str,
        total_chunks: u32,
    ) -> Result<AttachmentUploadStatus, AppError> {
        let mut url = reqwest::Url::parse(&format!(
            "{}/sync/attachments/upload/status",
            self.server_url
        ))
        .map_err(|e| AppError::SyncError(format!("URL 解析失败: {}", e)))?;
        url.query_pairs_mut()
            .append_pair("file_hash", file_hash)
            .append_pair("total_chunks", &total_chunks.to_string());
        let builder = self.client.get(url);
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }

    async fn complete_attachment_upload(
        &self,
        attachment_id: &str,
        item_id: &str,
        filename: &str,
        mime_type: &str,
        file_hash: &str,
        file_size: i64,
        snapshot_id: &str,
        total_chunks: u32,
    ) -> Result<String, AppError> {
        let mut url = reqwest::Url::parse(&format!(
            "{}/sync/attachments/upload/complete",
            self.server_url
        ))
        .map_err(|e| AppError::SyncError(format!("URL 解析失败: {}", e)))?;
        url.query_pairs_mut()
            .append_pair("attachment_id", attachment_id)
            .append_pair("item_id", item_id)
            .append_pair("filename", filename)
            .append_pair("mime_type", mime_type)
            .append_pair("file_hash", file_hash)
            .append_pair("file_size", &file_size.to_string())
            .append_pair("snapshot_id", snapshot_id)
            .append_pair("total_chunks", &total_chunks.to_string());
        let builder = self.client.post(url);
        let resp = self.send_auth_with_refresh(builder).await?;
        let body: ApiResponse<serde_json::Value> = resp
            .json()
            .await
            .map_err(|e| AppError::SyncError(format!("解析响应失败: {}", e)))?;
        if body.code == 200 {
            body.data
                .and_then(|data| data["storage_key"].as_str().map(ToString::to_string))
                .ok_or_else(|| AppError::SyncError("未返回存储键".to_string()))
        } else {
            Err(AppError::SyncError(format!(
                "合并附件失败: {}",
                body.message
            )))
        }
    }

    /// 按字节范围下载附件。旧服务端忽略 Range 时返回完整文件并将 start 设为 0。
    pub async fn download_attachment_range(
        &self,
        attachment_id: &str,
        start: u64,
        end: u64,
    ) -> Result<AttachmentDownloadRange, AppError> {
        let url = format!(
            "{}/sync/attachments/download/{}",
            self.server_url, attachment_id
        );
        let builder = self
            .client
            .get(&url)
            .header(reqwest::header::RANGE, format!("bytes={}-{}", start, end));
        let resp = self.send_auth_with_refresh(builder).await?;
        let status = resp.status();
        if status == reqwest::StatusCode::PARTIAL_CONTENT {
            let content_range = resp
                .headers()
                .get(reqwest::header::CONTENT_RANGE)
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned)
                .ok_or_else(|| AppError::SyncError("缺少 Content-Range".to_string()))?;
            let (_, range) = content_range
                .split_once(' ')
                .ok_or_else(|| AppError::SyncError("Content-Range 格式无效".to_string()))?;
            let (range, total) = range
                .split_once('/')
                .ok_or_else(|| AppError::SyncError("Content-Range 格式无效".to_string()))?;
            let (range_start, _) = range
                .split_once('-')
                .ok_or_else(|| AppError::SyncError("Content-Range 格式无效".to_string()))?;
            let data = resp
                .bytes()
                .await
                .map_err(|e| AppError::SyncError(format!("读取响应失败: {}", e)))?;
            return Ok(AttachmentDownloadRange {
                data: data.to_vec(),
                start: range_start
                    .parse()
                    .map_err(|_| AppError::SyncError("Content-Range 起点无效".to_string()))?,
                total_size: total
                    .parse()
                    .map_err(|_| AppError::SyncError("Content-Range 总大小无效".to_string()))?,
            });
        }

        if status == reqwest::StatusCode::OK {
            let data = resp
                .bytes()
                .await
                .map_err(|e| AppError::SyncError(format!("读取响应失败: {}", e)))?;
            return Ok(AttachmentDownloadRange {
                total_size: data.len() as u64,
                start: 0,
                data: data.to_vec(),
            });
        }

        Err(AppError::SyncError(format!(
            "下载附件分片失败: HTTP {}",
            status.as_u16()
        )))
    }

    /// 下载附件（兼容旧调用方；同步主链路使用分段下载）
    #[allow(dead_code)]
    pub async fn download_attachment(&self, attachment_id: &str) -> Result<Vec<u8>, AppError> {
        let url = format!(
            "{}/sync/attachments/download/{}",
            self.server_url, attachment_id
        );
        let builder = self.client.get(&url);
        let resp = self.send_auth_with_refresh(builder).await?;

        if resp.status().is_success() {
            resp.bytes()
                .await
                .map(|b| b.to_vec())
                .map_err(|e| AppError::SyncError(format!("读取响应失败: {}", e)))
        } else {
            Err(AppError::SyncError("下载附件失败".to_string()))
        }
    }

    /// 获取同步历史（分页）
    pub async fn get_sync_history(
        &self,
        page: u32,
        page_size: u32,
    ) -> Result<PaginatedSyncHistory, AppError> {
        let url = format!(
            "{}/sync/history?page={}&page_size={}",
            self.server_url, page, page_size
        );
        let builder = self.client.get(&url);
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }

    /// 获取当前账户的有效设备会话
    pub async fn list_devices(&self) -> Result<Vec<DeviceSessionInfo>, AppError> {
        let url = format!("{}/auth/devices", self.server_url);
        let builder = self.client.get(&url);
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }

    /// 撤销当前账户下指定设备的同步会话
    pub async fn revoke_device(&self, device_id: &str) -> Result<(), AppError> {
        let url = format!("{}/auth/devices/revoke", self.server_url);
        let builder = self
            .client
            .post(&url)
            .json(&serde_json::json!({ "device_id": device_id }));
        let resp = self.send_auth_with_refresh(builder).await?;
        let body: ApiResponse<serde_json::Value> = resp
            .json()
            .await
            .map_err(|e| AppError::SyncError(format!("解析响应失败: {}", e)))?;

        if body.code == 200 {
            Ok(())
        } else {
            Err(AppError::SyncError(format!(
                "撤销设备失败: {}",
                body.message
            )))
        }
    }

    /// 提交同步
    pub async fn commit_sync(
        &self,
        pushed_records: Vec<crate::models::sync::PushedRecord>,
        attachments: Vec<serde_json::Value>,
        attachments_complete: bool,
    ) -> Result<CommitResult, AppError> {
        let url = format!("{}/sync/commit", self.server_url);
        let builder = self.client.post(&url).json(&serde_json::json!({
            "pushed_records": pushed_records,
            "attachments_complete": attachments_complete,
            "attachments": attachments
        }));
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }

    pub async fn get_profile(&self) -> Result<crate::models::user::UserProfile, AppError> {
        let url = format!("{}/user/profile", self.server_url);
        let builder = self.client.get(&url);
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }

    pub async fn update_profile(
        &self,
        updates: &crate::models::user::UpdateProfilePayload,
    ) -> Result<crate::models::user::UserProfile, AppError> {
        let url = format!("{}/user/profile", self.server_url);
        let builder = self.client.post(&url).json(updates);
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }

    pub async fn change_password(
        &self,
        old_password: &str,
        new_password: &str,
    ) -> Result<(), AppError> {
        let url = format!("{}/user/password", self.server_url);
        let builder = self.client.post(&url).json(&serde_json::json!({
            "old_password": old_password,
            "new_password": new_password
        }));
        let resp = self.send_auth_with_refresh(builder).await?;
        let status = resp.status();
        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body_text) {
                let msg = json["message"].as_str().unwrap_or(&body_text);
                return Err(AppError::SyncError(msg.to_string()));
            }
            return Err(AppError::SyncError(body_text));
        }
        Ok(())
    }

    /// 删除账号
    pub async fn delete_account(&self) -> Result<(), AppError> {
        let url = format!("{}/auth/delete", self.server_url);
        let builder = self.client.post(&url).json(&serde_json::json!({}));
        let resp = self.send_auth_with_refresh(builder).await?;
        let status = resp.status();
        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body_text) {
                let msg = json["message"].as_str().unwrap_or(&body_text);
                return Err(AppError::SyncError(msg.to_string()));
            }
            return Err(AppError::SyncError(body_text));
        }
        Ok(())
    }

    /// 上传头像
    pub async fn upload_avatar(
        &self,
        mime_type: &str,
        data: Vec<u8>,
    ) -> Result<crate::models::user::UserProfile, AppError> {
        let mut url = reqwest::Url::parse(&format!("{}/user/avatar", self.server_url))
            .map_err(|e| AppError::SyncError(format!("URL 解析失败: {}", e)))?;
        url.query_pairs_mut().append_pair("mime_type", mime_type);
        let builder = self.client.put(url).body(data);
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }
}
