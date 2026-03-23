# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lumison is a minimalist music player built with **React 19 + TypeScript + Vite** on the frontend and **Tauri 2 + Rust** for desktop packaging. It features local audio playback, synced lyrics, visual backgrounds (Fluid/Melt modes), and multi-source music search.

## Common Commands

```bash
# Development
npm run dev              # Start Vite dev server (web only)
npm run tauri:dev        # Start Tauri dev mode (desktop app with Rust backend)

# Building
npm run build            # Build web version to dist/
npm run tauri:build      # Build desktop app for current platform
npm run tauri:build:windows   # Windows x64
npm run tauri:build:macos     # macOS universal
npm run tauri:build:linux     # Linux x64

# Testing
npm test                 # Run Vitest tests

# Icons
npm run generate:all-icons    # Regenerate all app icons from public/icon.svg
```

## Architecture

### Frontend-Backend Bridge

Tauri commands are defined in `src-tauri/src/lib.rs` and invoked via `@tauri-apps/api`. Current commands:
- `open_external_url` - Open URLs in system browser
- `sqlite_cache::*` - Image caching via SQLite (get, put, delete, list)

### State Management Pattern

The app uses a hybrid React Context + custom hooks architecture:

1. **PlayerContext** (`src/contexts/PlayerContext.tsx`) - Provides the player state container
2. **usePlayer hook** (`src/hooks/usePlayer.ts`) - Core player logic (~800 lines), manages audio element, playback state, lyrics matching
3. **usePlaylist hook** (`src/hooks/usePlaylist.ts`) - Queue management, shuffle/repeat logic

State flows: User interaction → Context → Hook → Service → Audio element

### Service Layer Structure

Services are organized by domain in `src/services/`:

- `audio/` - SpatialAudioEngine for Web Audio API processing
- `music/` - Audio streaming, lyrics fetching, Netease API integration
- `lyrics/` - Lyrics parsing and multi-platform lyrics matching
- `cache.ts` - In-memory resource caching with size limits
- `streaming/` - Streaming proxy for external audio sources

Key pattern: Services export pure functions or class instances, not React hooks.

### Lyrics System

Multi-layered lyrics fetching with fallback:
1. Check local embedded lyrics (ID3 tags loaded during scan)
2. Fetch from Netease Cloud Music API by ID match
3. Search and match by title/artist/album similarity
4. Cache successful matches to avoid repeated API calls

Implementation: `src/services/music/lyricsService.ts` and `src/services/music/multiPlatformLyrics.ts`

### Image Caching

Desktop builds use SQLite for persistent image caching:
- Rust: `src-tauri/src/sqlite_cache.rs`
- Keys are hashed (SHA256), blobs stored in SQLite
- Web builds fallback to in-memory Map

### i18n

Simple object-based translation in `src/i18n/`:
- `index.ts` - Translation loader with interpolation
- `locales/en.ts`, `locales/zh.ts` - Translation dictionaries
- Use `I18nContext` for translations in components

## File Organization

```
src/
  components/
    common/          # Reusable UI (Icons, SmartImage, Toast)
    layout/          # Layout shell (TopBar, FluidBackground, ShaderBackground)
    modals/          # Dialog components
    player/          # Player UI pieces
    ui/              # Feature UI (AlbumMode, KeyboardShortcuts)
  hooks/             # All custom hooks (usePlayer, usePlaylist, etc.)
  contexts/          # React contexts (Player, Theme, I18n)
  services/          # Business logic layer
  utils/             # Pure utility functions
  vendor/            # Third-party code (shaders, etc.)
  config/            # App configuration (performance settings)
src-tauri/
  src/
    lib.rs           # Tauri commands and app builder
    sqlite_cache.rs  # SQLite image cache implementation
```

## Important Patterns

### Song ID Generation

Songs use deterministic IDs based on file path hash: `generateSongId(path)` in `src/services/utils.ts`. This ensures stable identity across playlist operations.

### Audio Element Reference

The audio element is created and managed in `usePlayer.ts`, stored in a ref (`audioRef`), and exposed via context. Components access it through `usePlayerContext()` for controls like play/pause/seek.

### Color Extraction

Album art colors are extracted using `extractColors()` in `src/services/utils.ts`, which uses `colorthief` and feeds into the Fluid background shader uniforms.

### Performance Config

Global performance settings (animation quality, background FPS) are in `src/config/performance.ts`.

## Testing

Tests use Vitest. Run with `npm test`. Tests are colocated with source files (e.g., `neteaseRequest.test.ts` next to `neteaseRequest.ts`).

## Desktop vs Web

- **Web**: Runs without Tauri APIs, some features disabled (external URL opening uses `window.open`)
- **Desktop**: Full Tauri integration, SQLite cache, auto-updater support

Check for Tauri availability with `typeof window.__TAURI__ !== 'undefined'` where needed.