use serde::Serialize;

#[allow(dead_code)]
#[derive(Debug, Serialize)]
pub struct AppError {
    pub message: String,
}

#[allow(dead_code)]
impl AppError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}
