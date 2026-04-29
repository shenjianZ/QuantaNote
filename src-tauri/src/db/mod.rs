use crate::config::AppConfig;

#[derive(Clone, Debug)]
pub struct DbState {
    pub database_name: String,
}

impl DbState {
    pub fn from_config(config: &AppConfig) -> Self {
        Self {
            database_name: config.database_name.to_string(),
        }
    }
}
