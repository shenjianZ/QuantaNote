use crate::error::AppError;
use crate::models::sync::*;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

/// API 响应结构
#[derive(Debug, Deserialize)]
struct ApiResponse<T> {
    code: u16,
    message: String,
    data: Option<T>,
}

/// 快照信息
#[derive(Debug, Deserialize, Clone)]
pub struct SnapshotInfo {
    pub snapshot_id: String,
    pub data_hash: String,
    pub record_count: i32,
    pub total_size: i64,
    pub created_at: String,
}

/// 记录元信息（从服务端返回）
#[derive(Debug, Deserialize, Clone)]
pub struct RecordMetaInfo {
    pub table_name: String,
    pub record_id: String,
    pub content_hash: String,
    pub updated_at: String,
}

/// 推送结果
#[derive(Debug, Deserialize)]
pub struct PushResult {
    pub accepted: Vec<String>,
    pub skipped: Vec<String>,
}

/// 拉取结果
#[derive(Debug, Deserialize)]
pub struct PullResult {
    pub records: Vec<SyncRecordPayload>,
    pub snapshot_id: String,
}

/// 附件差异结果
#[derive(Debug, Deserialize)]
pub struct AttachmentDiffResult {
    pub missing: Vec<String>,
}

/// 提交结果
#[derive(Debug, Deserialize)]
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
                // 已有请求在刷新，等待完成后直接返回（新 token 已就绪）
                drop(flag);
                for _ in 0..50 {
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                    if !*self.refreshing.lock().await {
                        return Ok(());
                    }
                }
                return Err(AppError::SyncError("等待 token 刷新超时".to_string()));
            }
            *flag = true;
        }

        // 执行刷新
        let result = self.do_refresh().await;

        // 清除刷新标记
        *self.refreshing.lock().await = false;

        result
    }

    /// 实际执行 token 刷新
    async fn do_refresh(&self) -> Result<(), AppError> {
        let rt = self.refresh_token.lock().await.clone();
        let url = format!("{}/auth/refresh", self.server_url);
        let resp = self.client
            .post(&url)
            .json(&serde_json::json!({ "refresh_token": rt }))
            .send()
            .await
            .map_err(|e| AppError::SyncError(format!("刷新 token 请求失败: {}", e)))?;

        let body: ApiResponse<RefreshResult> = resp.json().await.map_err(|e| {
            AppError::SyncError(format!("解析刷新响应失败: {}", e))
        })?;

        if body.code == 200 {
            if let Some(data) = body.data {
                // 更新内存中的 token
                *self.access_token.lock().await = data.access_token.clone();
                *self.refresh_token.lock().await = data.refresh_token.clone();
                // 立即持久化（在返回 Ok 之前，确保不丢失）
                if let Some(ref cb) = self.on_token_refreshed {
                    cb(data.access_token, data.refresh_token);
                }
                Ok(())
            } else {
                Err(AppError::SyncError("刷新响应数据为空".to_string()))
            }
        } else {
            Err(AppError::SyncError(format!("刷新 token 失败: {}", body.message)))
        }
    }

    pub async fn handle_response<T: for<'de> Deserialize<'de>>(
        &self,
        resp: reqwest::Response,
    ) -> Result<T, AppError> {
        let status = resp.status();
        let body: ApiResponse<T> = resp.json().await.map_err(|e| {
            AppError::SyncError(format!("解析响应失败: {}", e))
        })?;

        if status.is_success() && body.code == 200 {
            body.data.ok_or_else(|| AppError::SyncError("响应数据为空".to_string()))
        } else {
            Err(AppError::SyncError(format!("请求失败: {}", body.message)))
        }
    }

    /// 发送带认证的请求，遇到 401 自动刷新 token 并重试
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

        let resp = self.client
            .execute(req.try_clone().ok_or_else(|| AppError::SyncError("无法克隆请求".to_string()))?)
            .await
            .map_err(|e| AppError::SyncError(format!("请求失败: {}", e)))?;

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

        let resp2 = self.client
            .execute(req2)
            .await
            .map_err(|e| AppError::SyncError(format!("重试请求失败: {}", e)))?;

        Ok(resp2)
    }

    /// 登录
    pub async fn login(&self, email: &str, password: &str) -> Result<SyncLoginResult, AppError> {
        let url = format!("{}/auth/login", self.server_url);
        let resp = self.client
            .post(&url)
            .json(&serde_json::json!({
                "email": email,
                "password": password,
                "device_id": self.device_id
            }))
            .send()
            .await
            .map_err(|e| AppError::SyncError(format!("请求失败: {}", e)))?;

        let body: ApiResponse<SyncLoginResult> = resp.json().await.map_err(|e| {
            AppError::SyncError(format!("解析响应失败: {}", e))
        })?;

        if body.code == 200 {
            body.data.ok_or_else(|| AppError::SyncError("响应数据为空".to_string()))
        } else {
            Err(AppError::SyncError(format!("登录失败: {}", body.message)))
        }
    }

    /// 注册
    pub async fn register(&self, email: &str, password: &str) -> Result<SyncLoginResult, AppError> {
        let url = format!("{}/auth/register", self.server_url);
        let resp = self.client
            .post(&url)
            .json(&serde_json::json!({
                "email": email,
                "password": password,
                "device_id": self.device_id
            }))
            .send()
            .await
            .map_err(|e| AppError::SyncError(format!("请求失败: {}", e)))?;

        let body: ApiResponse<SyncLoginResult> = resp.json().await.map_err(|e| {
            AppError::SyncError(format!("解析响应失败: {}", e))
        })?;

        if body.code == 200 {
            body.data.ok_or_else(|| AppError::SyncError("响应数据为空".to_string()))
        } else {
            Err(AppError::SyncError(format!("注册失败: {}", body.message)))
        }
    }

    /// 忘记密码
    pub async fn forgot_password(&self, email: &str) -> Result<String, AppError> {
        let url = format!("{}/auth/forgot-password", self.server_url);
        let resp = self.client
            .post(&url)
            .json(&serde_json::json!({ "email": email }))
            .send()
            .await
            .map_err(|e| AppError::SyncError(format!("请求失败: {}", e)))?;

        let body: ApiResponse<serde_json::Value> = resp.json().await.map_err(|e| {
            AppError::SyncError(format!("解析响应失败: {}", e))
        })?;

        if body.code == 200 {
            let data = body.data.ok_or_else(|| AppError::SyncError("响应数据为空".to_string()))?;
            data["reset_token"]
                .as_str()
                .map(|s| s.to_string())
                .ok_or_else(|| AppError::SyncError("未返回重置令牌".to_string()))
        } else {
            Err(AppError::SyncError(format!("请求失败: {}", body.message)))
        }
    }

    /// 重置密码
    pub async fn reset_password(&self, email: &str, reset_token: &str, new_password: &str) -> Result<(), AppError> {
        let url = format!("{}/auth/reset-password", self.server_url);
        let resp = self.client
            .post(&url)
            .json(&serde_json::json!({
                "email": email,
                "reset_token": reset_token,
                "new_password": new_password
            }))
            .send()
            .await
            .map_err(|e| AppError::SyncError(format!("请求失败: {}", e)))?;

        let body: ApiResponse<serde_json::Value> = resp.json().await.map_err(|e| {
            AppError::SyncError(format!("解析响应失败: {}", e))
        })?;

        if body.code == 200 {
            Ok(())
        } else {
            Err(AppError::SyncError(format!("重置密码失败: {}", body.message)))
        }
    }

    /// 测试连接
    pub async fn test_connection(&self) -> Result<bool, AppError> {
        let url = format!("{}/health", self.server_url);
        let resp = self.client
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

        let body: ApiResponse<SnapshotInfo> = resp.json().await.map_err(|e| {
            AppError::SyncError(format!("解析响应失败: {}", e))
        })?;

        if body.code == 200 {
            Ok(body.data)
        } else {
            Err(AppError::SyncError(format!("请求失败: {}", body.message)))
        }
    }

    /// 获取快照记录
    pub async fn get_snapshot_records(&self, snapshot_id: &str) -> Result<Vec<RecordMetaInfo>, AppError> {
        let url = format!("{}/sync/snapshot/{}/records", self.server_url, snapshot_id);
        let builder = self.client.get(&url);
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }

    /// 推送记录
    pub async fn push_records(&self, records: Vec<SyncRecordPayload>) -> Result<PushResult, AppError> {
        let url = format!("{}/sync/records/push", self.server_url);
        let builder = self.client.post(&url).json(&serde_json::json!({ "records": records }));
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }

    /// 拉取记录
    pub async fn pull_records(&self, since_snapshot_id: Option<&str>) -> Result<PullResult, AppError> {
        let url = format!("{}/sync/records/pull", self.server_url);
        let builder = self.client.post(&url).json(&serde_json::json!({ "since_snapshot_id": since_snapshot_id }));
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }

    /// 附件差异
    pub async fn diff_attachments(&self, hashes: Vec<String>) -> Result<AttachmentDiffResult, AppError> {
        let url = format!("{}/sync/attachments/diff", self.server_url);
        let builder = self.client.post(&url).json(&serde_json::json!({ "hashes": hashes }));
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
        snapshot_id: &str,
        data: Vec<u8>,
    ) -> Result<String, AppError> {
        let url = format!(
            "{}/sync/attachments/upload?attachment_id={}&item_id={}&filename={}&mime_type={}&file_hash={}&snapshot_id={}",
            self.server_url, attachment_id, item_id, filename, mime_type, file_hash, snapshot_id
        );
        let builder = self.client.post(&url).body(data);
        let resp = self.send_auth_with_refresh(builder).await?;

        let body: ApiResponse<serde_json::Value> = resp.json().await.map_err(|e| {
            AppError::SyncError(format!("解析响应失败: {}", e))
        })?;

        if body.code == 200 {
            let data = body.data.ok_or_else(|| AppError::SyncError("响应数据为空".to_string()))?;
            data["storage_key"]
                .as_str()
                .map(|s| s.to_string())
                .ok_or_else(|| AppError::SyncError("未返回存储键".to_string()))
        } else {
            Err(AppError::SyncError(format!("上传失败: {}", body.message)))
        }
    }

    /// 下载附件
    pub async fn download_attachment(&self, attachment_id: &str) -> Result<Vec<u8>, AppError> {
        let url = format!("{}/sync/attachments/download/{}", self.server_url, attachment_id);
        let builder = self.client.get(&url);
        let resp = self.send_auth_with_refresh(builder).await?;

        if resp.status().is_success() {
            resp.bytes().await
                .map(|b| b.to_vec())
                .map_err(|e| AppError::SyncError(format!("读取响应失败: {}", e)))
        } else {
            Err(AppError::SyncError("下载附件失败".to_string()))
        }
    }

    /// 获取同步历史
    pub async fn get_sync_history(&self) -> Result<Vec<SyncHistoryEntry>, AppError> {
        let url = format!("{}/sync/history", self.server_url);
        let builder = self.client.get(&url);
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }

    /// 提交同步
    pub async fn commit_sync(
        &self,
        records: Vec<serde_json::Value>,
        attachments: Vec<serde_json::Value>,
    ) -> Result<CommitResult, AppError> {
        let url = format!("{}/sync/commit", self.server_url);
        let builder = self.client.post(&url).json(&serde_json::json!({
            "records": records,
            "attachments": attachments
        }));
        let resp = self.send_auth_with_refresh(builder).await?;
        self.handle_response(resp).await
    }
}
