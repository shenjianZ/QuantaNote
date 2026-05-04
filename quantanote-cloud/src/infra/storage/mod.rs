pub mod local;
pub mod s3;
pub mod webdav;

use async_trait::async_trait;
use bytes::Bytes;

/// 存储对象
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct StorageObject {
    pub key: String,
    pub data: Bytes,
    pub content_type: String,
}

/// 存储对象元数据
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct StorageMetadata {
    pub key: String,
    pub size: u64,
    pub last_modified: Option<chrono::DateTime<chrono::Utc>>,
}

/// 存储后端 trait
#[async_trait]
#[allow(dead_code)]
pub trait StorageBackend: Send + Sync {
    /// 上传对象
    async fn put_object(&self, key: &str, data: Bytes, content_type: &str) -> anyhow::Result<()>;

    /// 下载对象
    async fn get_object(&self, key: &str) -> anyhow::Result<StorageObject>;

    /// 删除对象
    async fn delete_object(&self, key: &str) -> anyhow::Result<()>;

    /// 列出指定前缀下的对象
    async fn list_objects(&self, prefix: &str) -> anyhow::Result<Vec<StorageMetadata>>;

    /// 检查对象是否存在
    async fn exists(&self, key: &str) -> anyhow::Result<bool>;

    /// 移动/重命名对象（幂等：目标已存在或源不存在时跳过）
    async fn move_object(&self, from_key: &str, to_key: &str) -> anyhow::Result<()> {
        if self.exists(to_key).await? {
            if self.exists(from_key).await? && from_key != to_key {
                let _ = self.delete_object(from_key).await;
            }
            return Ok(());
        }
        if !self.exists(from_key).await? {
            return Ok(());
        }
        let obj = self.get_object(from_key).await?;
        self.put_object(to_key, obj.data, &obj.content_type).await?;
        self.delete_object(from_key).await?;
        Ok(())
    }

    /// 批量删除
    async fn delete_objects(&self, keys: &[String]) -> anyhow::Result<()> {
        for key in keys {
            self.delete_object(key).await?;
        }
        Ok(())
    }
}

/// 创建存储后端实例
pub fn create_storage_backend(
    config: &crate::config::storage::StorageConfig,
) -> anyhow::Result<Box<dyn StorageBackend>> {
    match config.backend_type.as_str() {
        "local" => {
            let base_path = config.base_path.as_deref().unwrap_or("./sync_data");
            Ok(Box::new(local::LocalStorage::new(base_path)?))
        }
        "s3" => {
            let bucket = config
                .bucket
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("S3 存储需要配置 bucket"))?;
            let endpoint = config.endpoint.as_deref();
            let region = config.region.as_deref().unwrap_or("us-east-1");
            let access_key = config
                .access_key
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("S3 存储需要配置 access_key"))?;
            let secret_key = config
                .secret_key
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("S3 存储需要配置 secret_key"))?;
            Ok(Box::new(s3::S3Storage::new(
                bucket, endpoint, region, access_key, secret_key,
            )?))
        }
        "webdav" => {
            let url = config
                .webdav_url
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("WebDAV 存储需要配置 webdav_url"))?;
            let username = config
                .webdav_username
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("WebDAV 存储需要配置 webdav_username"))?;
            let password = config
                .webdav_password
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("WebDAV 存储需要配置 webdav_password"))?;
            Ok(Box::new(webdav::WebDAVStorage::new(
                url, username, password,
            )?))
        }
        other => Err(anyhow::anyhow!("不支持的存储后端类型: {}", other)),
    }
}
