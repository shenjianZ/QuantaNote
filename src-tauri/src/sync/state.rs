use crate::error::AppError;
use crate::models::sync::{SyncProgress, SyncQueueStatus, SyncState, SyncStatus};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

const SYNC_STATE_EVENT: &str = "sync-state-changed";

/// 同步状态管理器，通过 Tauri 事件向前端推送状态变更
pub struct SyncStateManager {
    state: Arc<Mutex<SyncState>>,
    app_handle: Option<AppHandle>,
}

impl SyncStateManager {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(SyncState::default())),
            app_handle: None,
        }
    }

    pub fn set_app_handle(&mut self, handle: AppHandle) {
        self.app_handle = Some(handle);
    }

    pub fn get_state(&self) -> Result<SyncState, AppError> {
        self.state
            .lock()
            .map(|s| s.clone())
            .map_err(|e| AppError::Database(e.to_string()))
    }

    pub fn set_status(&self, status: SyncStatus) -> Result<(), AppError> {
        let snapshot = {
            let mut state = self
                .state
                .lock()
                .map_err(|e| AppError::Database(e.to_string()))?;
            state.status = status;
            state.clone()
        };
        self.emit_state(&snapshot);
        Ok(())
    }

    pub fn set_progress(&self, phase: &str, current: u32, total: u32) -> Result<(), AppError> {
        let snapshot = {
            let mut state = self
                .state
                .lock()
                .map_err(|e| AppError::Database(e.to_string()))?;
            state.progress = Some(SyncProgress {
                phase: phase.to_string(),
                current,
                total,
            });
            state.clone()
        };
        self.emit_state(&snapshot);
        Ok(())
    }

    pub fn set_error(&self, error: String) -> Result<(), AppError> {
        let snapshot = {
            let mut state = self
                .state
                .lock()
                .map_err(|e| AppError::Database(e.to_string()))?;
            state.status = SyncStatus::Error;
            state.last_error = Some(error);
            state.clone()
        };
        self.emit_state(&snapshot);
        Ok(())
    }

    pub fn set_queue_status(&self, queue: &SyncQueueStatus) -> Result<(), AppError> {
        let snapshot = {
            let mut state = self
                .state
                .lock()
                .map_err(|e| AppError::Database(e.to_string()))?;
            state.queued = queue.queued;
            state.retry_count = queue.retry_count;
            state.next_retry_at = queue.next_retry_at.clone();
            state.paused = queue.paused;
            state.last_error = queue.last_error.clone();
            state.clone()
        };
        self.emit_state(&snapshot);
        Ok(())
    }

    pub fn set_completed(&self) -> Result<(), AppError> {
        let snapshot = {
            let mut state = self
                .state
                .lock()
                .map_err(|e| AppError::Database(e.to_string()))?;
            state.status = SyncStatus::Completed;
            state.progress = None;
            state.last_error = None;
            state.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
            state.clone()
        };
        self.emit_state(&snapshot);
        Ok(())
    }

    pub fn clear_progress(&self) -> Result<(), AppError> {
        let snapshot = {
            let mut state = self
                .state
                .lock()
                .map_err(|e| AppError::Database(e.to_string()))?;
            state.progress = None;
            state.clone()
        };
        self.emit_state(&snapshot);
        Ok(())
    }

    fn emit_state(&self, state: &SyncState) {
        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit(SYNC_STATE_EVENT, state);
        }
    }
}

impl Clone for SyncStateManager {
    fn clone(&self) -> Self {
        Self {
            state: Arc::clone(&self.state),
            app_handle: self.app_handle.clone(),
        }
    }
}
