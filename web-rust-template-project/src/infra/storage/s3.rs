use super::{StorageBackend, StorageMetadata, StorageObject};
use async_trait::async_trait;
use bytes::Bytes;
use s3::creds::Credentials;
use s3::Bucket;
use std::sync::Arc;

/// S3/MinIO 兼容存储后端
pub struct S3Storage {
    bucket: Arc<Bucket>,
}

impl S3Storage {
    pub fn new(
        bucket_name: &str,
        endpoint: Option<&str>,
        region: &str,
        access_key: &str,
        secret_key: &str,
    ) -> anyhow::Result<Self> {
        let credentials = Credentials::new(
            Some(access_key),
            Some(secret_key),
            None,
            None,
            None,
        )?;

        let mut bucket = if let Some(ep) = endpoint {
            // MinIO 或其他 S3 兼容存储
            Bucket::new(
                bucket_name,
                s3::Region::Custom {
                    region: region.to_string(),
                    endpoint: ep.to_string(),
                },
                credentials,
            )?
        } else {
            Bucket::new(bucket_name, region.parse()?, credentials)?
        };

        // 设置路径风格（MinIO 需要）
        if endpoint.is_some() {
            bucket.set_path_style();
        }

        Ok(Self {
            bucket: Arc::new(*bucket),
        })
    }
}

#[async_trait]
impl StorageBackend for S3Storage {
    async fn put_object(&self, key: &str, data: Bytes, content_type: &str) -> anyhow::Result<()> {
        self.bucket
            .put_object_with_content_type(key, &data, content_type)
            .await?;
        Ok(())
    }

    async fn get_object(&self, key: &str) -> anyhow::Result<StorageObject> {
        let response = self.bucket.get_object(key).await?;
        let content_type = response
            .headers()
            .get("content-type")
            .map(|v| v.to_string())
            .unwrap_or_else(|| "application/octet-stream".to_string());
        Ok(StorageObject {
            key: key.to_string(),
            data: Bytes::from(response.to_vec()),
            content_type,
        })
    }

    async fn delete_object(&self, key: &str) -> anyhow::Result<()> {
        self.bucket.delete_object(key).await?;
        Ok(())
    }

    async fn list_objects(&self, prefix: &str) -> anyhow::Result<Vec<StorageMetadata>> {
        let list = self.bucket.list(prefix.to_string(), Some("/".to_string())).await?;
        let mut results = Vec::new();
        for item in list {
            for object in &item.contents {
                results.push(StorageMetadata {
                    key: object.key.clone(),
                    size: object.size as u64,
                    last_modified: None,
                });
            }
        }
        Ok(results)
    }

    async fn exists(&self, key: &str) -> anyhow::Result<bool> {
        match self.bucket.head_object(key).await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}
