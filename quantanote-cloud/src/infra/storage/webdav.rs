use super::{StorageBackend, StorageMetadata, StorageObject};
use async_trait::async_trait;
use bytes::Bytes;
use reqwest::Client;

/// WebDAV 存储后端（兼容 OpenList、NextCloud、坚果云等）
pub struct WebDAVStorage {
    client: Client,
    base_url: String,
    username: String,
    password: String,
}

impl WebDAVStorage {
    pub fn new(url: &str, username: &str, password: &str) -> anyhow::Result<Self> {
        let base_url = url.trim_end_matches('/').to_string();
        Ok(Self {
            client: Client::new(),
            base_url,
            username: username.to_string(),
            password: password.to_string(),
        })
    }

    fn object_url(&self, key: &str) -> String {
        format!("{}/{}", self.base_url, key.trim_start_matches('/'))
    }
}

#[async_trait]
impl StorageBackend for WebDAVStorage {
    async fn put_object(&self, key: &str, data: Bytes, _content_type: &str) -> anyhow::Result<()> {
        let url = self.object_url(key);
        self.client
            .put(&url)
            .basic_auth(&self.username, Some(&self.password))
            .body(data.to_vec())
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }

    async fn get_object(&self, key: &str) -> anyhow::Result<StorageObject> {
        let url = self.object_url(key);
        let resp = self
            .client
            .get(&url)
            .basic_auth(&self.username, Some(&self.password))
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
        let url = self.object_url(key);
        self.client
            .delete(&url)
            .basic_auth(&self.username, Some(&self.password))
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }

    async fn list_objects(&self, prefix: &str) -> anyhow::Result<Vec<StorageMetadata>> {
        let url = self.object_url(prefix);
        let depth = if prefix.ends_with('/') { "1" } else { "0" };
        let body = r#"<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:getcontentlength/>
    <d:getlastmodified/>
  </d:prop>
</d:propfind>"#;
        let resp = self
            .client
            .request(reqwest::Method::from_bytes(b"PROPFIND")?, &url)
            .basic_auth(&self.username, Some(&self.password))
            .header("Depth", depth)
            .header("Content-Type", "application/xml")
            .body(body)
            .send()
            .await?;

        // 尚未上传过该附件时，部分 WebDAV 服务不会自动创建分片目录，而是返回 404。
        // 对列表语义来说这等价于“当前没有已接收分片”，不应阻断首次续传。
        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(Vec::new());
        }
        let resp = resp.error_for_status()?;

        let text = resp.text().await?;
        parse_propfind_response(&text, prefix)
    }

    async fn exists(&self, key: &str) -> anyhow::Result<bool> {
        let url = self.object_url(key);
        let resp = self
            .client
            .head(&url)
            .basic_auth(&self.username, Some(&self.password))
            .send()
            .await?;
        Ok(resp.status().is_success())
    }
}

/// 解析 PROPFIND XML 响应，提取文件列表
#[allow(dead_code)]
fn parse_propfind_response(xml: &str, prefix: &str) -> anyhow::Result<Vec<StorageMetadata>> {
    let mut results = Vec::new();

    // 简单 XML 解析：提取 <d:href> 和 <d:getcontentlength> 对
    let hrefs: Vec<&str> = xml
        .split("<d:href>")
        .skip(1)
        .filter_map(|s| s.split("</d:href>").next())
        .collect();

    let sizes: Vec<&str> = xml
        .split("<d:getcontentlength>")
        .skip(1)
        .filter_map(|s| s.split("</d:getcontentlength>").next())
        .collect();

    // hrefs[0] 是目录自身，从 [1] 开始是子项
    for (i, href) in hrefs.iter().enumerate().skip(1) {
        let decoded = urldecode(href);
        let name = decoded
            .trim_end_matches('/')
            .rsplit('/')
            .next()
            .unwrap_or("");

        if name.is_empty() {
            continue;
        }

        let key = if prefix.ends_with('/') {
            format!("{}{}", prefix, name)
        } else {
            format!("{}/{}", prefix, name)
        };

        let size: u64 = sizes
            .get(i)
            .and_then(|s| s.trim().parse().ok())
            .unwrap_or(0);

        results.push(StorageMetadata {
            key,
            size,
            last_modified: None,
        });
    }

    Ok(results)
}

/// 简易 URL 解码
#[allow(dead_code)]
fn urldecode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.bytes();
    while let Some(b) = chars.next() {
        if b == b'%' {
            let hi = chars.next().unwrap_or(b'0');
            let lo = chars.next().unwrap_or(b'0');
            let val = hex_val(hi) << 4 | hex_val(lo);
            result.push(val as char);
        } else if b == b'+' {
            result.push(' ');
        } else {
            result.push(b as char);
        }
    }
    result
}

#[allow(dead_code)]
fn hex_val(b: u8) -> u8 {
    match b {
        b'0'..=b'9' => b - b'0',
        b'a'..=b'f' => b - b'a' + 10,
        b'A'..=b'F' => b - b'A' + 10,
        _ => 0,
    }
}
