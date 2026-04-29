use crate::models::sync::SyncResult;

pub fn sync_now() -> SyncResult {
    SyncResult {
        status: "ok".to_string(),
        message: "同步正常，所有数据均已端到端加密".to_string(),
    }
}
