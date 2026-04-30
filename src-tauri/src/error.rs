use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("数据库错误: {0}")]
    Database(String),
    #[error("未找到: {0}")]
    NotFound(String),
    #[error("验证错误: {0}")]
    Validation(String),
    #[error("IO 错误: {0}")]
    Io(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
