# YouTube Music API Setup

## Requirements

```bash
pip install ytmusicapi
```

## Setup Authentication

### Method 1: OAuth (Recommended)
1. Run the setup command:
   ```bash
   ytmusicapi oauth
   ```
2. Follow the browser authentication instructions
3. Rename the generated `oauth.json` to `scripts/ytmusic/oauth.json`

### Method 2: Browser Credentials
1. Open YouTube Music in your browser
2. Open Developer Tools → Network tab
3. Find a request to `music.youtube.com` and copy the request headers
4. Save to `scripts/ytmusic/credentials.json`

## Usage

### Search for tracks
```bash
python scripts/ytmusic/ytmusic_wrapper.py search "Oasis Wonderwall"
```

### Create playlist
```bash
python scripts/ytmusic/ytmusic_wrapper.py playlist create "My Favorites" "Description here"
```

### Add tracks to playlist
```bash
python scripts/ytmusic/ytmusic_wrapper.py playlist add "PLxxxxxxxxxxxxx" "video_id1" "video_id2"
```

### Get track info
```bash
python scripts/ytmusic/ytmusic_wrapper.py track "video_id"
```

## Tauri Integration (Optional)

To use this from the frontend, you can add a Tauri command in `src-tauri/src/lib.rs`:

```rust
#[tauri::command]
fn search_youtube_music(query: String) -> Result<String, String> {
    let output = Command::new("python")
        .args(&["scripts/ytmusic/ytmusic_wrapper.py", "search", &query])
        .output()
        .map_err(|e| e.to_string())?;
    
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
```