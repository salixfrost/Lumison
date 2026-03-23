# Lumison

English | [简体中文](README.zh-CN.md)

<div align="center">

![Lumison Logo](public/icon.svg)

**A minimalist music player with immersive visuals, synced lyrics, and Tauri desktop integration.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg)](https://vite.dev/)

[Live Demo](https://salixfrost.github.io/lumison/) • [Releases](https://github.com/SalixJFrost/Lumison/releases) • [Report Bug](https://github.com/SalixJFrost/Lumison/issues)

</div>

---

## Overview

Lumison is a cross-platform music player built with React, TypeScript, and Tauri. It focuses on playback experience, visual atmosphere, and synchronized lyrics rather than overwhelming users with features. The interface is intentionally streamlined with a dark theme, two background modes, and clean controls.

## Features

| Category | Features |
|----------|----------|
| **Playback** | Local audio playback (MP3, FLAC, WAV, OGG, M4A, AAC, etc.), gapless playback |
| **Visuals** | Two background modes (Fluid, Melt), album art extraction, dynamic color theming |
| **Lyrics** | Synchronized lyrics display, adjustable font size, word-by-word highlighting |
| **Search** | Multi-source music search (Netease, Internet Archive), cloud music import |
| **Desktop** | Tauri 2.0 packaging, auto-update support, system tray, keyboard shortcuts |

## Quick Start

### Web Version

1. Open [Lumison Web Demo](https://salixfrost.github.io/lumison/) in your browser
2. Click the import button or drag & drop audio files to add music
3. Use the search panel (Cmd/Ctrl+K) to find music online

### Desktop App

#### Pre-built

Download the latest release from [Releases](https://github.com/SalixJFrost/Lumison/releases) for your platform.

#### Build from Source

```bash
# Clone the repository
git clone https://github.com/SalixJFrost/Lumison.git
cd Lumison

# Install dependencies
npm install

# Build for your platform
npm run tauri:build
```

The executable will be generated in `src-tauri/target/release/` (or `target/debug/` for development build).

## Usage Guide

### Adding Music

- **Local Files**: Click the cloud icon in the playlist panel, or drag & drop files onto the player
- **URL Import**: Click the + icon to add music from a direct URL
- **Online Search**: Press `Cmd/Ctrl+K` to open the search panel and search Netease or Internet Archive

### Playback Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Play/Pause | Space | Tap the play button |
| Next Track | `→` or `Shift+Space` | Swipe left |
| Previous Track | `←` or `Shift+Space` | Swipe right |
| Volume Up/Down | `↑` / `↓` | Slider or buttons |
| Mute Toggle | `M` | Tap speaker icon |
| Toggle Playlist | `P` | Tap playlist icon |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open search panel |
| `Space` | Play/Pause |
| `←` / `→` | Previous/Next track |
| `↑` / `↓` | Volume up/down |
| `M` | Mute toggle |
| `F` | Toggle fullscreen |
| `L` | Toggle lyrics view |
| `Esc` | Close dialogs/panels |

### Visual Modes

- **Fluid Mode**: Animated gradient background that responds to album colors
- **Melt Mode**: Softer, more ambient background with blur effects

Switch between modes in the top bar or settings.

## Development

### Prerequisites

- Node.js 20+
- npm
- Rust toolchain (for desktop builds)
- Tauri CLI prerequisites

### Setup

```bash
# Install dependencies
npm install
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Build production web version |
| `npm run preview` | Preview production build locally |
| `npm run tauri:dev` | Start Tauri development mode |
| `npm run tauri:build` | Build production desktop app |

### Platform-specific Builds

```bash
# Windows (x86_64)
npm run tauri:build:windows

# macOS (Universal)
npm run tauri:build:macos

# macOS (Intel)
npm run tauri:build:macos:intel

# macOS (Apple Silicon)
npm run tauri:build:macos:silicon

# Linux (x86_64)
npm run tauri:build:linux
```

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
vitest

# Run specific test file
vitest run src/services/music/neteaseRequest.test.ts
```

## Tech Stack

- **Frontend**: React 19, TypeScript 5.8, Vite 6
- **Styling**: Tailwind CSS 3.4
- **Animation**: @react-spring/web
- **Desktop**: Tauri 2.0, Rust
- **Testing**: Vitest

## Project Structure

```
lumison/
├── src/
│   ├── components/         # React UI components
│   │   ├── common/         # Shared components (Icons, SmartImage, Toast)
│   │   ├── layout/         # Layout components (TopBar, ShaderBackground)
│   │   ├── modals/         # Modal dialogs (Search, About, FocusSession)
│   │   ├── player/         # Player controls, PlaylistPanel, AlbumMode
│   │   └── ui/             # UI utilities (LanguageSwitcher)
│   ├── contexts/           # React contexts (PlayerContext, ThemeContext, I18nContext)
│   ├── hooks/             # Custom hooks (usePlayer, usePlaylist, useKeyboardScope)
│   ├── i18n/              # Localization (zh.ts, en.ts)
│   ├── services/          # Business logic
│   │   ├── audio/         # Audio playback and processing
│   │   ├── cache/         # IndexedDB caching
│   │   ├── lyrics/        # Lyrics parsing and synchronization
│   │   ├── music/         # Music search, Netease API
│   │   └── streaming/    # Internet Archive streaming
│   ├── utils/             # Utility functions
│   └── types.ts           # TypeScript type definitions
├── src-tauri/             # Tauri backend (Rust)
│   ├── src/               # Rust source code
│   ├── icons/             # App icon assets
│   └── Cargo.toml         # Rust dependencies
├── public/                # Static assets
├── docs/                  # Documentation
├── scripts/               # Build utility scripts
└── package.json           # Node dependencies
```

## Notes

- The web version is deployed to GitHub Pages automatically on push to main.
- Desktop builds use Tauri-specific APIs where available (file system, system tray, etc.).
- If GitHub Pages shows an old version, force-refresh your browser (Ctrl+Shift+R).
- The app requires the Web Audio API - it works best in modern browsers (Chrome, Firefox, Safari, Edge).

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

- Design inspired by Apple Music
- Music search powered by [Netease API](https://github.com/Binaryify/NeteaseCloudMusicApi)
- Streaming supported by [Internet Archive](https://archive.org/)

---

<div align="center">

Built with React + Tauri

</div>