#[tauri::command]
pub fn write_clipboard_text(window: tauri::Window, text: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hwnd = window
            .hwnd()
            .map_err(|error| format!("获取窗口句柄失败: {error}"))?;
        return write_windows_clipboard(hwnd.0, &text);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (window, text);
        Err("Windows 原生剪贴板桥接仅支持 Windows".to_string())
    }
}

#[cfg(target_os = "windows")]
fn write_windows_clipboard(
    hwnd: windows_sys::Win32::Foundation::HWND,
    text: &str,
) -> Result<(), String> {
    use std::mem::size_of;
    use std::ptr::copy_nonoverlapping;
    use windows_sys::Win32::Foundation::GlobalFree;
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
    };
    use windows_sys::Win32::System::Memory::{
        GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE,
    };

    const CF_UNICODETEXT: u32 = 13;

    let utf16: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
    let byte_len = utf16
        .len()
        .checked_mul(size_of::<u16>())
        .ok_or_else(|| "剪贴板文本过大".to_string())?;

    let memory = unsafe { GlobalAlloc(GMEM_MOVEABLE, byte_len) };
    if memory.is_null() {
        return Err(format!(
            "分配剪贴板内存失败: {}",
            std::io::Error::last_os_error()
        ));
    }

    let locked_memory = unsafe { GlobalLock(memory) };
    if locked_memory.is_null() {
        unsafe { GlobalFree(memory) };
        return Err(format!(
            "锁定剪贴板内存失败: {}",
            std::io::Error::last_os_error()
        ));
    }

    unsafe {
        copy_nonoverlapping(
            utf16.as_ptr().cast::<u8>(),
            locked_memory.cast::<u8>(),
            byte_len,
        );
        GlobalUnlock(memory);
    }

    if unsafe { OpenClipboard(hwnd) } == 0 {
        unsafe { GlobalFree(memory) };
        return Err(format!(
            "打开系统剪贴板失败: {}",
            std::io::Error::last_os_error()
        ));
    }

    if unsafe { EmptyClipboard() } == 0 {
        unsafe {
            CloseClipboard();
            GlobalFree(memory);
        }
        return Err(format!(
            "清空系统剪贴板失败: {}",
            std::io::Error::last_os_error()
        ));
    }

    if unsafe { SetClipboardData(CF_UNICODETEXT, memory).is_null() } {
        unsafe {
            CloseClipboard();
            GlobalFree(memory);
        }
        return Err(format!(
            "写入系统剪贴板失败: {}",
            std::io::Error::last_os_error()
        ));
    }

    unsafe { CloseClipboard() };
    Ok(())
}
