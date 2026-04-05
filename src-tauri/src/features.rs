use serde::Serialize;
use tauri::Manager;

#[derive(Serialize, Debug, Clone)]
pub struct MonitorInfo {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
    pub is_primary: bool,
}

#[derive(Serialize, Debug, Clone)]
pub struct AudioDeviceInfo {
    pub name: String,
    pub is_default: bool,
}

#[derive(Serialize, Debug, Clone)]
pub struct CaptureSession {
    pub session_id: String,
    pub device_name: String,
    pub sample_rate: u32,
    pub channels: u16,
}

#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    Ok(vec![AudioDeviceInfo {
        name: "Default Audio Device".to_string(),
        is_default: true,
    }])
}

#[tauri::command]
pub fn start_audio_capture(
    _device_id: Option<String>,
    _sample_rate: Option<u32>,
) -> Result<CaptureSession, String> {
    #[cfg(target_os = "windows")]
    {
        let sample_rate = _sample_rate.unwrap_or(44100);
        let session_id = format!("capture_{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis());

        Ok(CaptureSession {
            session_id,
            device_name: "Default".to_string(),
            sample_rate,
            channels: 2,
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("System audio capture is only supported on Windows".to_string())
    }
}

#[tauri::command]
pub fn stop_audio_capture(session_id: String) -> Result<(), String> {
    if session_id.starts_with("capture_") {
        Ok(())
    } else {
        Err(format!("Session {} not found", session_id))
    }
}

#[tauri::command]
pub fn list_capture_sessions() -> Result<Vec<CaptureSession>, String> {
    Ok(vec![])
}

#[tauri::command]
pub fn get_available_monitors(app: tauri::AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let monitors = app
        .available_monitors()
        .map_err(|e| format!("Failed to get monitors: {}", e))?;

    let primary = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| m.name().unwrap_or(&String::new()).clone());

    Ok(monitors
        .iter()
        .map(|m| MonitorInfo {
            name: m.name().unwrap_or(&String::new()).clone(),
            width: m.size().width,
            height: m.size().height,
            scale_factor: m.scale_factor(),
            is_primary: primary.as_ref().is_some_and(|p| m.name().is_some_and(|n| n.clone() == *p)),
        })
        .collect())
}

#[tauri::command]
pub fn create_output_window(
    app: tauri::AppHandle,
    label: String,
    monitor_index: Option<u32>,
) -> Result<(), String> {
    let monitors = app
        .available_monitors()
        .map_err(|e| format!("Failed to get monitors: {}", e))?;

    let idx = monitor_index.unwrap_or(0) as usize;
    let target = monitors
        .get(idx)
        .ok_or_else(|| format!("Monitor {} not found (available: {})", idx, monitors.len()))?;

    let position = target.position();
    let size = target.size();

    tauri::WebviewWindowBuilder::new(
        &app,
        &label,
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("Lumison Output")
    .fullscreen(true)
    .decorations(false)
    .position(position.x as f64, position.y as f64)
    .inner_size(size.width as f64, size.height as f64)
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn enter_exhibition_mode(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    window
        .set_fullscreen(true)
        .map_err(|e| format!("Failed to enter fullscreen: {}", e))?;
    window
        .set_decorations(false)
        .map_err(|e| format!("Failed to hide decorations: {}", e))?;
    window
        .set_cursor_visible(false)
        .map_err(|e| format!("Failed to hide cursor: {}", e))?;
    window
        .set_always_on_top(true)
        .map_err(|e| format!("Failed to set always on top: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn exit_exhibition_mode(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    window
        .set_fullscreen(false)
        .map_err(|e| format!("Failed to exit fullscreen: {}", e))?;
    window
        .set_decorations(true)
        .map_err(|e| format!("Failed to show decorations: {}", e))?;
    window
        .set_cursor_visible(true)
        .map_err(|e| format!("Failed to show cursor: {}", e))?;
    window
        .set_always_on_top(false)
        .map_err(|e| format!("Failed to disable always on top: {}", e))?;

    Ok(())
}
