use crate::models::sync::{SyncProgress, SyncState, SyncStatus};
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

    pub fn get_state(&self) -> SyncState {
        self.state.lock().unwrap().clone()
    }

    pub fn set_status(&self, status: SyncStatus) {
        let mut state = self.state.lock().unwrap();
        state.status = status;
        self.emit_state(&state);
    }

    pub fn set_progress(&self, phase: &str, current: u32, total: u32) {
        let mut state = self.state.lock().unwrap();
        state.progress = Some(SyncProgress {
            phase: phase.to_string(),
            current,
            total,
        });
        self.emit_state(&state);
    }

    pub fn set_error(&self, error: String) {
        let mut state = self.state.lock().unwrap();
        state.status = SyncStatus::Error;
        state.last_error = Some(error);
        self.emit_state(&state);
    }

    pub fn set_completed(&self) {
        let mut state = self.state.lock().unwrap();
        state.status = SyncStatus::Completed;
        state.progress = None;
        state.last_error = None;
        state.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
        self.emit_state(&state);
    }

    pub fn clear_progress(&self) {
        let mut state = self.state.lock().unwrap();
        state.progress = None;
        self.emit_state(&state);
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
