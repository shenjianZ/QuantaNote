use crate::models::sync::SyncResult;
use crate::repositories::sync_repository;

pub fn sync_now() -> SyncResult {
    sync_repository::sync_now()
}
