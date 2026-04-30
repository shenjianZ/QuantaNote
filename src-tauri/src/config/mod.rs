#[derive(Clone, Debug)]
pub struct AppConfig {
    pub app_name: &'static str,
    pub database_name: String,
    pub data_dir: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            app_name: "QuantaNote",
            database_name: "quanta_note.sqlite".to_string(),
            data_dir: String::new(),
        }
    }
}
