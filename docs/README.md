# Lumison

English | [简体中文](README.zh-CN.md)

<div align="center">

![Lumison Logo](public/icon.svg)

**A minimalist music player with immersive visuals, synced lyrics, and desktop packaging via Tauri.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

[Live Demo](https://salixfrost.github.io/lumison/) • [Releases](https://github.com/SalixJFrost/Lumison/releases)

</div>

---

## Overview

Lumison is a music player focused on playback, lyrics, and atmosphere instead of a crowded feature surface. The current UI is intentionally streamlined: dark theme only, two background modes, lightweight controls, and a cleaner settings flow.

## Features

- Local audio playback with common formats such as MP3, FLAC, WAV, OGG, and M4A
- Two visual background modes: `Fluid` and `Melt`
- Synced lyrics view with adjustable font size
- Multi-source music import and search support
- Album art extraction and dynamic color response
- Desktop app packaging with Tauri 2
- Automatic update checks for desktop builds
- Responsive layout for desktop and mobile web

## Current Product Direction

- Theme is fixed to dark mode
- Lab / experimental panel has been removed
- Extra background effects have been removed
- Gapless playback controls have been removed from the UI
- Playback settings are kept intentionally minimal

## Recent Updates

- Fluid background motion is now visible on desktop and tuned to a slower ambient flow for reduced visual fatigue.
- Top bar now auto-hides after 10 seconds of inactivity and reappears when moving the pointer to the top area.
- External links in About are opened via the system browser in desktop builds.
- Search stability was improved for repeated queries and post-delete re-search flows.

## Development

### Requirements

- Node.js 20+
- npm
- Rust toolchain and Tauri prerequisites for desktop builds

### Install

```bash
npm install
```

### Run Web Dev Server

```bash
npm run dev
```

### Build Web Version

```bash
npm run build
```

### Build Desktop App

```bash
npm run tauri:build
```

### Regenerate App Icons

```bash
npm run generate:all-icons
```

## Tech Stack

- React 19
- TypeScript 5.8
- Vite 6
- Tailwind CSS 3
- Tauri 2
- Rust
- react-spring

## Project Structure

```text
src/
	components/     UI components
	contexts/       React context providers
	hooks/          Custom hooks
	i18n/           Localization resources
	services/       Audio, music, lyrics, and UI services
	utils/          Shared utilities
src-tauri/
	src/            Tauri backend entrypoints
	icons/          App icon sources
public/           Static assets
scripts/          Utility scripts
```

## Notes

- The web build is deployed to GitHub Pages.
- The desktop build uses Tauri-specific APIs where available.
- If GitHub Pages appears to load an old bundle, force-refresh the browser cache.

## License

MIT License.

## Credits

Inspired by Apple Music.

---

<div align="center">

Made with care.

</div>
