use crate::models::vault::UnlockResult;
use crate::repositories::vault_repository;

pub fn unlock_vault(password: String) -> UnlockResult {
    vault_repository::unlock(&password)
}
