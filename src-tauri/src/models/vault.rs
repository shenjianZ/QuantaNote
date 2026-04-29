use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct UnlockResult {
    pub unlocked: bool,
}
