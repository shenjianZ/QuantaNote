use super::{StorageBackend, StorageMetadata, StorageObject};
use async_trait::async_trait;
use bytes::Bytes;
use reqwest::Client;

/// OpenList REST API 存储后端
pub struct OpenListStorage {
    client: Client,
    base_url: String,
    token: String,
}

impl OpenListStorage {
    pub fn new(base_url: &str, token: &str) -> anyhow::Result<Self> {
        let base_url = base_url.trim_end_matches('/').to_string();
        Ok(Self {
            client: Client::new(),
            base_url,
            token: token.to_string(),
        })
    }

    #[allow(dead_code)]
    fn api_url(&self, path: &str) -> String {
        format!("{}/api/fs/{}", self.base_url, path.trim_start_matches('/'))
    }

    fn auth_header(&self) -> String {
        format!("{}", self.token)
    }
}

#[async_trait]
impl StorageBackend for OpenListStorage {
    async fn put_object(&self, key: &str, data: Bytes, _content_type: &str) -> anyhow::Result<()> {
        // OpenList 使用 PUT 上传文件
        let url = format!("{}/dav/{}", self.base_url, key.trim_start_matches('/'));
        self.client
            .put(&url)
            .header("Authorization", self.auth_header())
            .body(data.to_vec())
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }

    async fn get_object(&self, key: &str) -> anyhow::Result<StorageObject> {
        let url = format!("{}/dav/{}", self.base_url, key.trim_start_matches('/'));
        let resp = self
            .client
            .get(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await?
            .error_for_status()?;
        let content_type = resp
            .headers()
            .get("content-type")
            .map(|v| v.to_str().unwrap_or("application/octet-stream").to_string())
            .unwrap_or_else(|| "application/octet-stream".to_string());
        let data = Bytes::from(resp.bytes().await?);
        Ok(StorageObject {
            key: key.to_string(),
            data,
            content_type,
        })
    }

    async fn delete_object(&self, key: &str) -> anyhow::Result<()> {
        let url = format!("{}/dav/{}", self.base_url, key.trim_start_matches('/'));
        self.client
            .delete(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }

    async fn list_objects(&self, prefix: &str) -> anyhow::Result<Vec<StorageMetadata>> {
        let url = self.api_url("list");
        let resp = self
            .client
            .get(&url)
            .header("Authorization", self.auth_header())
            .query(&[("path", prefix)])
            .send()
            .await?
            .error_for_status()?;

        let body: serde_json::Value = resp.json().await?;
        let mut results = Vec::new();

        if let Some(content) = body["data"]["content"].as_array() {
            for item in content {
                let name = item["name"].as_str().unwrap_or("");
                let size = item["size"].as_u64().unwrap_or(0);
                let key = if prefix.ends_with('/') {
                    format!("{}{}", prefix, name)
                } else {
                    format!("{}/{}", prefix, name)
                };
                results.push(StorageMetadata {
                    key,
                    size,
                    last_modified: None,
                });
            }
        }

        Ok(results)
    }

    async fn exists(&self, key: &str) -> anyhow::Result<bool> {
        let url = self.api_url("get");
        let resp = self
            .client
            .get(&url)
            .header("Authorization", self.auth_header())
            .query(&[("path", key)])
            .send()
            .await?;
        Ok(resp.status().is_success())
    }
}
