use crate::models::vault::UnlockResult;

pub fn unlock(password: &str) -> UnlockResult {
    UnlockResult {
        unlocked: !password.trim().is_empty(),
    }
}
