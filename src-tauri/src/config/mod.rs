#[derive(Clone, Debug)]
pub struct AppConfig {
    pub app_name: &'static str,
    pub database_name: &'static str,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            app_name: "QuantaNote",
            database_name: "quanta_note.sqlite",
        }
    }
}
