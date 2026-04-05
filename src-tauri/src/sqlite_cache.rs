use rusqlite::{Connection, params, OptionalExtension};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use std::path::Path;
use serde::{Serialize, Deserialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

#[derive(Serialize, Deserialize, Debug)]
pub struct CachedImage {
    pub key: String,
    pub data: Vec<u8>,
    pub mime_type: String,
    pub width: u32,
    pub height: u32,
    pub dpr_scale: u32,
    pub accessed_at: u64,
    pub size_bytes: u64,
}

pub struct SqliteCache {
    conn: Connection,
    max_size_bytes: u64,
}

impl SqliteCache {
    pub fn new(path: impl AsRef<Path>, max_size_mb: u64) -> rusqlite::Result<Self> {
        let max_size_bytes = max_size_mb * 1024 * 1024;
        let conn = Connection::open(path)?;

        // Enable WAL mode for better concurrency
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;

        // Create tables
        conn.execute(
            "CREATE TABLE IF NOT EXISTS images (
                key TEXT PRIMARY KEY,
                data BLOB NOT NULL,
                mime_type TEXT NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                dpr_scale INTEGER NOT NULL,
                accessed_at INTEGER NOT NULL,
                size_bytes INTEGER NOT NULL
            )",
            [],
        )?;

        // Create indexes
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_images_accessed ON images (accessed_at)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_images_size ON images (size_bytes)",
            [],
        )?;

        Ok(Self { conn, max_size_bytes })
    }

    pub fn get_total_size(&self) -> rusqlite::Result<u64> {
        self.conn.query_row(
            "SELECT COALESCE(SUM(size_bytes), 0) FROM images",
            [],
            |row| row.get(0),
        )
    }

    fn evict_if_needed(&self) -> rusqlite::Result<()> {
        let mut total = self.get_total_size()?;

        while total > self.max_size_bytes {
            // Find oldest small-to-medium entry to evict (not necessarily LRU)
            let evicted = self.conn.execute(
                "DELETE FROM images WHERE key = (
                    SELECT key FROM images
                    ORDER BY accessed_at ASC, size_bytes DESC
                    LIMIT 1
                )",
                [],
            )?;

            if evicted == 0 {
                break; // No more entries to evict
            }

            total = self.get_total_size()?;
        }

        Ok(())
    }

    pub fn get_image(&self, key: &str) -> rusqlite::Result<Option<CachedImage>> {
        let mut stmt = self.conn.prepare(
            "SELECT key, data, mime_type, width, height, dpr_scale, accessed_at, size_bytes
             FROM images WHERE key = ?"
        )?;

        let result = stmt.query_row([key], |row| {
            Ok(CachedImage {
                key: row.get(0)?,
                data: row.get(1)?,
                mime_type: row.get(2)?,
                width: row.get(3)?,
                height: row.get(4)?,
                dpr_scale: row.get(5)?,
                accessed_at: row.get(6)?,
                size_bytes: row.get(7)?,
            })
        }).optional()?;

        // Update accessed_at on hit
        if let Some(_) = result.as_ref() {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();

            self.conn.execute(
                "UPDATE images SET accessed_at = ? WHERE key = ?",
                params![now, key],
            )?;
        }

        Ok(result)
    }

    pub fn put_image(&self, image: &CachedImage) -> rusqlite::Result<()> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        self.conn.execute(
            "INSERT OR REPLACE INTO images
             (key, data, mime_type, width, height, dpr_scale, accessed_at, size_bytes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                &image.key,
                &image.data,
                &image.mime_type,
                image.width,
                image.height,
                image.dpr_scale,
                now,
                image.size_bytes,
            ],
        )?;

        self.evict_if_needed()?;
        Ok(())
    }

    pub fn delete_image(&self, key: &str) -> rusqlite::Result<()> {
        self.conn.execute("DELETE FROM images WHERE key = ?", [key])?;
        Ok(())
    }

    pub fn list_all_images(&self) -> rusqlite::Result<Vec<CachedImage>> {
        let mut stmt = self.conn.prepare(
            "SELECT key, data, mime_type, width, height, dpr_scale, accessed_at, size_bytes
             FROM images ORDER BY accessed_at DESC"
        )?;

        let images = stmt.query_map([], |row| {
            Ok(CachedImage {
                key: row.get(0)?,
                data: row.get(1)?,
                mime_type: row.get(2)?,
                width: row.get(3)?,
                height: row.get(4)?,
                dpr_scale: row.get(5)?,
                accessed_at: row.get(6)?,
                size_bytes: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(images)
    }

    pub fn list_all_keys(&self) -> rusqlite::Result<Vec<String>> {
        let mut stmt = self.conn.prepare("SELECT key FROM images ORDER BY accessed_at DESC")?;
        let keys = stmt.query_map([], |row| row.get(0))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(keys)
    }

    pub fn clear(&self) -> rusqlite::Result<()> {
        self.conn.execute("DELETE FROM images", [])?;
        Ok(())
    }
}

// Helper functions for Tauri commands
#[tauri::command]
pub async fn get_cached_image(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let cache_path = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("cache.db");

    let cache = SqliteCache::new(cache_path, 200) // 200MB default
        .map_err(|e| format!("Failed to open cache: {}", e))?;

    let image = cache.get_image(&key)
        .map_err(|e| format!("Failed to get image: {}", e))?;

    Ok(image.map(|img| BASE64.encode(&img.data)))
}

#[tauri::command]
pub async fn put_cached_image(
    app: tauri::AppHandle,
    key: String,
    data_base64: String,
    mime_type: String,
    width: u32,
    height: u32,
    dpr_scale: u32,
) -> Result<(), String> {
    let data = BASE64.decode(&data_base64)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    let size_bytes = data.len() as u64;

    let cache_path = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("cache.db");

    let cache = SqliteCache::new(cache_path, 200)
        .map_err(|e| format!("Failed to open cache: {}", e))?;

    let image = CachedImage {
        key,
        data,
        mime_type,
        width,
        height,
        dpr_scale,
        accessed_at: 0, // Will be set by put_image
        size_bytes,
    };

    cache.put_image(&image)
        .map_err(|e| format!("Failed to store image: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_cached_image(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let cache_path = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("cache.db");

    let cache = SqliteCache::new(cache_path, 200)
        .map_err(|e| format!("Failed to open cache: {}", e))?;

    cache.delete_image(&key)
        .map_err(|e| format!("Failed to delete image: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn list_cached_keys(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let cache_path = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("cache.db");

    let cache = SqliteCache::new(cache_path, 200)
        .map_err(|e| format!("Failed to open cache: {}", e))?;

    let keys = cache.list_all_keys()
        .map_err(|e| format!("Failed to list keys: {}", e))?;

    Ok(keys)
}

#[tauri::command]
pub async fn clear_cached_images(app: tauri::AppHandle) -> Result<(), String> {
    let cache_path = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("cache.db");

    let cache = SqliteCache::new(cache_path, 200)
        .map_err(|e| format!("Failed to open cache: {}", e))?;

    cache.clear()
        .map_err(|e| format!("Failed to clear cache: {}", e))?;

    Ok(())
}