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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_error_database_message() {
        let err = AppError::Database("连接失败".to_string());
        assert!(err.to_string().contains("数据库错误"));
        assert!(err.to_string().contains("连接失败"));
    }

    #[test]
    fn app_error_not_found_message() {
        let err = AppError::NotFound("Item xxx".to_string());
        assert!(err.to_string().contains("未找到"));
    }

    #[test]
    fn app_error_serializes_to_string() {
        let errors = vec![
            AppError::Database("db".to_string()),
            AppError::NotFound("nf".to_string()),
            AppError::Validation("val".to_string()),
            AppError::Io("io".to_string()),
        ];
        for err in &errors {
            let json = serde_json::to_string(err).unwrap();
            assert!(json.starts_with('"'));
            assert!(json.ends_with('"'));
        }
    }
}
