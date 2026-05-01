use std::path::PathBuf;

pub fn quantanote_dir() -> PathBuf {
    if let Some(path) = std::env::var_os("QUANTANOTE_DATA_DIR") {
        return PathBuf::from(path);
    }

    home_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
        .join(".quantanote")
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}
