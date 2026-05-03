use super::{StorageBackend, StorageMetadata, StorageObject};
use async_trait::async_trait;
use bytes::Bytes;
use std::path::{Path, PathBuf};

/// 本地文件系统存储后端
pub struct LocalStorage {
    base_path: PathBuf,
}

impl LocalStorage {
    pub fn new(base_path: &str) -> anyhow::Result<Self> {
        let path = PathBuf::from(base_path);
        if !path.exists() {
            std::fs::create_dir_all(&path)?;
        }
        Ok(Self { base_path: path })
    }

    fn full_path(&self, key: &str) -> PathBuf {
        // 防止路径穿越
        let safe_key = key.replace("..", "").replace('\0', "");
        self.base_path.join(safe_key)
    }
}

#[async_trait]
impl StorageBackend for LocalStorage {
    async fn put_object(&self, key: &str, data: Bytes, _content_type: &str) -> anyhow::Result<()> {
        let path = self.full_path(key);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&path, &data)?;
        Ok(())
    }

    async fn get_object(&self, key: &str) -> anyhow::Result<StorageObject> {
        let path = self.full_path(key);
        if !path.exists() {
            return Err(anyhow::anyhow!("对象不存在: {}", key));
        }
        let data = Bytes::from(std::fs::read(&path)?);
        let content_type = mime_from_path(&path);
        Ok(StorageObject {
            key: key.to_string(),
            data,
            content_type,
        })
    }

    async fn delete_object(&self, key: &str) -> anyhow::Result<()> {
        let path = self.full_path(key);
        if path.exists() {
            std::fs::remove_file(&path)?;
        }
        Ok(())
    }

    async fn list_objects(&self, prefix: &str) -> anyhow::Result<Vec<StorageMetadata>> {
        let dir = self.full_path(prefix);
        let mut results = Vec::new();
        if !dir.exists() {
            return Ok(results);
        }
        collect_files(&dir, &self.base_path, &mut results)?;
        Ok(results)
    }

    async fn exists(&self, key: &str) -> anyhow::Result<bool> {
        Ok(self.full_path(key).exists())
    }

    async fn move_object(&self, from_key: &str, to_key: &str) -> anyhow::Result<()> {
        let from_path = self.full_path(from_key);
        let to_path = self.full_path(to_key);

        // 幂等：目标已存在时跳过（重试场景）
        if to_path.exists() {
            if from_path.exists() && from_path != to_path {
                let _ = std::fs::remove_file(&from_path);
            }
            return Ok(());
        }

        // 源不存在时说明已经移动过，跳过
        if !from_path.exists() {
            return Ok(());
        }

        if let Some(parent) = to_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::rename(&from_path, &to_path)?;
        Ok(())
    }
}

/// 递归收集文件
#[allow(dead_code)]
fn collect_files(
    dir: &Path,
    base: &Path,
    results: &mut Vec<StorageMetadata>,
) -> anyhow::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_files(&path, base, results)?;
        } else {
            let metadata = entry.metadata()?;
            let key = path
                .strip_prefix(base)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            results.push(StorageMetadata {
                key,
                size: metadata.len(),
                last_modified: metadata.modified().ok().map(|t| chrono::DateTime::from(t)),
            });
        }
    }
    Ok(())
}

fn mime_from_path(path: &Path) -> String {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "json" => "application/json",
        "txt" => "text/plain",
        "bin" => "application/octet-stream",
        _ => "application/octet-stream",
    }
    .to_string()
}
