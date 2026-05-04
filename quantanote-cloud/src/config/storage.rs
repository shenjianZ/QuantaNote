use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct StorageConfig {
    /// 存储后端类型: "local" | "s3" | "webdav"
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

    /// WebDAV 服务器 URL
    pub webdav_url: Option<String>,

    /// WebDAV 用户名
    pub webdav_username: Option<String>,

    /// WebDAV 密码
    pub webdav_password: Option<String>,
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
            webdav_url: None,
            webdav_username: None,
            webdav_password: None,
        }
    }
}
