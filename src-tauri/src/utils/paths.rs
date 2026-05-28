use std::path::PathBuf;
use std::sync::OnceLock;

#[cfg(target_os = "android")]
const ANDROID_APP_IDENTIFIER: &str = "com.quantanote.desktop";

/// 缓存数据目录路径，避免重复解析和创建
static DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

pub fn quantanote_dir() -> PathBuf {
    DATA_DIR
        .get_or_init(|| {
            if let Some(path) = std::env::var_os("QUANTANOTE_DATA_DIR") {
                return PathBuf::from(path);
            }

            let dir = resolve_data_dir();

            // 确保目录存在（日志插件在 setup 之前初始化，需要可写路径）
            let _ = std::fs::create_dir_all(&dir);

            // 缓存到环境变量，让子模块也能读到
            std::env::set_var("QUANTANOTE_DATA_DIR", &dir);
            dir
        })
        .clone()
}

fn resolve_data_dir() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        android_data_dir()
    }
    #[cfg(not(target_os = "android"))]
    {
        home_dir()
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
            .join(".quantanote")
    }
}

#[cfg(target_os = "android")]
fn android_data_dir() -> PathBuf {
    let external_storage_root = std::env::var_os("EXTERNAL_STORAGE")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/storage/emulated/0"));

    external_storage_root
        .join("Android")
        .join("data")
        .join(ANDROID_APP_IDENTIFIER)
        .join("files")
        .join("quantanote")
}

#[cfg(not(target_os = "android"))]
fn home_dir() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}
