use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct StorageConfig {
    /// 存储后端类型: "local" | "s3" | "openlist"
    #[serde(default = "default_backend_type")]
    pub backend_type: String,

    /// 本地文件系统基础路径（local 后端使用）
    pub base_path: Option<String>,

    /// S3 存储桶名称
    pub bucket: Option<String>,

    /// S3 兼容端点（MinIO 等）
    pub endpoint: Option<String>,

    /// S3 区域
    pub region: Option<String>,

    /// S3 访问密钥
    pub access_key: Option<String>,

    /// S3 秘密密钥
    pub secret_key: Option<String>,

    /// OpenList API 基础 URL
    pub openlist_url: Option<String>,

    /// OpenList 认证令牌
    pub openlist_token: Option<String>,
}

fn default_backend_type() -> String {
    "local".to_string()
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            backend_type: "local".to_string(),
            base_path: Some("./sync_data".to_string()),
            bucket: None,
            endpoint: None,
            region: Some("us-east-1".to_string()),
            access_key: None,
            secret_key: None,
            openlist_url: None,
            openlist_token: None,
        }
    }
}
