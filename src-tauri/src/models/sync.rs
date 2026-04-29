use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SyncResult {
    pub status: String,
    pub message: String,
}
