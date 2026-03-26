<div align="center">
<img src="https://raw.githubusercontent.com/SalixJFrost/Lumison/main/public/icon.svg" alt="Lumison Logo" width="120">

# Lumison

**A Minimalist Music Player with Immersive Visuals**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg)](https://vite.dev/)

[Live Demo](https://salixfrost.github.io/lumison/) • [Download](https://github.com/SalixJFrost/Lumison/releases) • [Report Issues](https://github.com/SalixJFrost/Lumison/issues)

</div>

---

## ✨ Features

### 🎵 Multi-Source Music
- **Local Files**: MP3, FLAC, WAV, OGG, M4A, AAC, and more
- **Online Music Search**: Search and import songs
- **Internet Archive**: Access archived audio collections
- **URL Import**: Direct audio URL support

### 🎨 Visual Experience
- **Two Background Modes**: Fluid and Melt animations
- **Dynamic Theming**: Colors adapt to album artwork
- **Album Art Display**: Full-screen album view with progress bar

### 🎤 Synchronized Lyrics
- **Real-time Sync**: Word-by-word lyrics highlighting
- **Auto-scroll**: Smooth lyrics tracking
- **Click-to-Seek**: Jump to any lyric line

### 🖥️ Desktop Experience
- **Cross-platform**: Windows, macOS, Linux
- **Keyboard Shortcuts**: Full hotkey support
- **System Integration**: Media session API, auto-updates

---

## 📸 Screenshots

<div align="center">

### Main Player Interface
<img src="https://raw.githubusercontent.com/SalixJFrost/Lumison/main/public/screenshot-main.png" alt="Main Player Interface" width="600">

### Lyrics Display
<img src="https://raw.githubusercontent.com/SalixJFrost/Lumison/main/public/screenshot-lyrics.png" alt="Lyrics Display" width="600">

### Search & Import
<img src="https://raw.githubusercontent.com/SalixJFrost/Lumison/main/public/screenshot-search.png" alt="Search and Import" width="600">

</div>

---

## 🚀 Quick Start

### Web Version

1. Visit [Lumison Web Demo](https://salixfrost.github.io/lumison/)
2. Click the cloud icon or drag & drop audio files
3. Press `Cmd/Ctrl+K` to search online

### Desktop App

Download the latest release from [GitHub Releases](https://github.com/SalixJFrost/Lumison/releases)

**Build from Source:**

```bash
# Clone and install
git clone https://github.com/SalixJFrost/Lumison.git
cd Lumison
npm install

# Build desktop app
npm run tauri:build

# Start development
npm run tauri:dev
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause |
| `←` / `→` | Previous/Next track |
| `↑` / `↓` | Volume up/down |
| `M` | Mute toggle |
| `P` | Toggle playlist |
| `F` | Toggle fullscreen |
| `L` | Toggle lyrics view |
| `Cmd/Ctrl + K` | Open search panel |
| `Esc` | Close dialogs |

---

## 🛠️ Development

### Prerequisites

- Node.js 20+
- npm
- Rust toolchain (for desktop builds)

### Commands

```bash
# Development
npm run dev              # Start web dev server
npm run tauri:dev        # Start Tauri dev mode

# Building
npm run build            # Build web version
npm run tauri:build      # Build desktop app

# Testing
npm run test             # Run tests
vitest                   # Watch mode
```

---

## 📁 Project Structure

```
lumison/
├── src/                    # Frontend (React)
│   ├── components/         # UI components
│   │   ├── common/         # Icons, SmartImage, Toast
│   │   ├── layout/         # TopBar, ShaderBackground
│   │   ├── modals/         # Search, FocusSession
│   │   └── player/         # Controls, Lyrics, Playlist
│   ├── hooks/              # Custom React hooks
│   ├── services/           # Business logic
│   │   ├── audio/          # Audio processing
│   │   ├── cache/          # IndexedDB caching
│   │   ├── lyrics/         # Lyrics parsing
│   │   ├── music/          # Music Search API
│   │   └── streaming/      # Internet Archive
│   ├── contexts/           # React contexts
│   ├── i18n/               # Internationalization
│   └── utils/              # Utility functions
├── src-tauri/              # Backend (Rust/Tauri)
│   ├── src/                # Rust source
│   └── icons/              # App icons
├── config/                 # Configuration files
├── docs/                   # Documentation
└── public/                 # Static assets
```

---

## 🌐 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 5.8, Vite 6 |
| **Styling** | Tailwind CSS 3.4 |
| **Animation** | @react-spring/web |
| **Desktop** | Tauri 2.0, Rust |
| **Testing** | Vitest |
| **i18n** | Custom (EN/ZH) |

---

## 🌍 Internationalization

Lumison supports multiple languages:
- English
- 中文 (简体)

Switch languages in Settings → Language.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Credits

- Design inspired by Apple Music
- Music search API integration
- Streaming from [Internet Archive](https://archive.org/)

---

<div align="center">

**[Download](https://github.com/SalixJFrost/Lumison/releases)** •
**[Live Demo](https://salixfrost.github.io/lumison/)** •
**[Report Issues](https://github.com/SalixJFrost/Lumison/issues)**

Made with ❤️ using React + Tauri

</div>
