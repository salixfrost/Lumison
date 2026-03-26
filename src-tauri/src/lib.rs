// Library entry point for mobile platforms (Android/iOS)

#[cfg(mobile)]
mod mobile;

#[cfg(mobile)]
pub use mobile::*;

mod sqlite_cache;

use std::process::Command;

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {

#[tauri::command]
fn write_audio_tags(options: String) -> Result<String, String> {
    let client = reqwest::blocking::Client::new();
    let response = client
        .post("http://127.0.0.1:28883/tag")
        .header("Content-Type", "application/json")
        .body(options)
        .send()
        .map_err(|e| e.to_string())?;
    
    if response.status().is_success() {
        Ok("OK".to_string())
    } else {
        Err(format!("HTTP {}", response.status()))
    }
}
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| format!("failed to open url: {e}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("failed to open url: {e}"))?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("failed to open url: {e}"))?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("unsupported platform".to_string())
}

pub type SetupHook = Box<dyn FnOnce(&mut tauri::App) -> Result<(), Box<dyn std::error::Error>> + Send>;

#[derive(Default)]
pub struct AppBuilder {
    setup: Option<SetupHook>,
}

impl AppBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    pub fn setup<F>(mut self, setup: F) -> Self
    where
        F: FnOnce(&mut tauri::App) -> Result<(), Box<dyn std::error::Error>> + Send + 'static,
    {
        self.setup.replace(Box::new(setup));
        self
    }

    pub fn run(self) {
        let setup = self.setup;
        tauri::Builder::default()
            .invoke_handler(tauri::generate_handler![
                open_external_url,
                write_audio_tags,
                sqlite_cache::get_cached_image,
                sqlite_cache::put_cached_image,
                sqlite_cache::delete_cached_image,
                sqlite_cache::list_cached_keys
            ])
            .setup(move |app| {
                if let Some(setup) = setup {
                    (setup)(app)?;
                }
                Ok(())
            })
            .plugin(tauri_plugin_process::init())
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
}
