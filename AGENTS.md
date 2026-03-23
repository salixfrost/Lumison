# AGENTS.md - Lumison Development Guide

## Project Overview

Lumison is a music player desktop application built with React, TypeScript, Vite, and Tauri. It supports local file playback, cloud music search (Netease), Internet Archive streaming, and lyrics display with word-by-word synchronization.

---

## Build & Development Commands

### Development
```bash
npm run dev          # Start Vite dev server (port 3000)
npm run tauri:dev    # Start Tauri development mode
```

### Building
```bash
npm run build        # Production build with Vite
npm run preview      # Preview production build
npm run tauri:build  # Build Tauri app
```

### Testing
```bash
npm run test                    # Run all tests (Vitest)
npm run test -- --run           # Same as above (explicit)
vitest run                      # Run tests once and exit
vitest                          # Watch mode for development (recommended during TDD)

# Single test file (most common)
vitest run src/services/music/neteaseRequest.test.ts

# Run tests matching pattern
vitest run --grep "fetchNeteaseWithFallback"
vitest run --grep "should use primary"

# Run single test
vitest run src/services/music/neteaseRequest.test.ts -t "uses primary endpoint first"
```

### Type Checking
```bash
npx tsc --noEmit                # Run TypeScript type check
npx tsc --noEmit --watch        # Watch mode for type checking
```

### Linting
- No ESLint configured - code quality is maintained manually
- Follow existing code patterns in the repository

### Tauri-Specific
```bash
npm run tauri:build:windows     # Build for Windows (x86_64-pc-windows-msvc)
npm run tauri:build:macos       # Build for macOS (universal)
npm run tauri:build:linux       # Build for Linux
npm run tauri:build:android     # Build for Android
npm run generate:icon            # Generate app icons
```

---

## Code Style Guidelines

### TypeScript Configuration
- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **Path Aliases**: Use `@/*` to import from `src/` (e.g., `import { Song } from "@/types"`)
- **JSX**: react-jsx
- **Strict Mode**: Enabled via `isolatedModules`, `moduleDetection: force`

### Import Order (Enforce manually)
1. React core imports (`React, { useState, useCallback, ... }`)
2. External library imports (e.g., `@tauri-apps/api`, `@react-spring/web`)
3. Internal absolute imports (`@/services/...`, `@/hooks/...`, `@/components/...`)
4. Relative imports (`../`, `./`)

```typescript
// Correct order example
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useToast } from "./hooks/useToast";
import { PlayState, Song } from "./types";
import { fetchNeteaseWithFallback } from "@/services/music/neteaseRequest";
import Controls from "./components/player/Controls";
```

### Naming Conventions
- **Files**: PascalCase for components (`SearchModal.tsx`), camelCase for utilities (`fileHash.ts`)
- **Interfaces/Types**: PascalCase with descriptive names (`interface LyricLine`, `type MatchStatus`)
- **Enums**: PascalCase with PascalCase members (`enum PlayState { PAUSED, PLAYING }`)
- **Hooks**: camelCase with `use` prefix (`usePlayer`, `usePlaylist`)
- **Components**: PascalCase (`const App: React.FC`)
- **Constants**: SCREAMING_SNAKE_CASE for config values (`const MATCH_TIMEOUT_MS = 15000`)

### Functional Components
- Use `const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => { ... }` for typed props
- Destructure props for clarity
- Use inline types for simple callbacks when not reused

```typescript
// Good component definition
interface ControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  currentTime: number;
  duration: number;
}

const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  onPlayPause,
  currentTime,
  duration,
}) => { ... };
```

### React Patterns
- **useCallback**: Use for functions passed to child components or event handlers
- **useMemo**: Use for expensive computations and object/array dependencies
- **useRef**: Use for DOM refs and mutable values that don't trigger re-renders
- **Lazy Loading**: Use `React.lazy(() => import('./path'))` for large components

```typescript
// Lazy loading example
const importPlaylistPanel = () => import("./components/player/PlaylistPanel");
const LazyPlaylistPanel = lazy(importPlaylistPanel);

// Usage with Suspense
<Suspense fallback={null}>
  <LazyPlaylistPanel {...props} />
</Suspense>
```

### Error Handling
- Always handle async errors with try/catch
- Use meaningful error messages
- Log errors to console with context prefix

```typescript
// Good error handling
try {
  const result = await fetchNeteaseWithFallback("/cloudsearch?keywords=test", {
    retries: 0,
  });
} catch (error) {
  if (error instanceof Error) {
    console.error("Failed to fetch Netease search:", error.message);
  }
  throw new Error("All Netease API endpoints failed");
}
```

### CSS & Styling
- **Tailwind CSS**: Use utility classes for styling
- **Custom CSS**: Place in component-specific `.css` files when needed
- **Theme**: Dark theme default with `bg-black`, white text with opacity variants (`text-white/90`)
- **Transitions**: Use `transition-all duration-200` for smooth interactions
- **Backdrop blur**: Use `backdrop-blur-sm` for glassmorphism effects

```typescript
// Common Tailwind patterns in this codebase
<div className="flex flex-col items-center justify-center gap-4" />
<div className="text-white/90 text-sm font-medium" />
<button className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200" />
```

### Testing Patterns (Vitest)
- Use `describe` blocks for test suites
- Use `it` or `test` for individual tests
- Mock dependencies with `vi.mock()`
- Use `beforeEach` for setup/reset

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils", () => ({
  fetchViaProxy: vi.fn(),
}));

describe("fetchNeteaseWithFallback", () => {
  beforeEach(() => {
    mockedFetchViaProxy.mockReset();
  });

  it("uses primary endpoint first when request succeeds", async () => {
    mockedFetchViaProxy.mockResolvedValueOnce({ ok: true });
    // test logic
  });
});
```

---

## Project Structure

```
src/
├── components/       # React components
│   ├── common/       # Shared components (Icons, SmartImage, Toast)
│   ├── layout/       # Layout components (TopBar, ShaderBackground)
│   ├── modals/       # Modal dialogs
│   ├── player/       # Player controls, lyrics view
│   └── ui/           # UI components (LanguageSwitcher, KeyboardShortcuts)
├── contexts/         # React contexts (PlayerContext, ThemeContext, I18nContext)
├── hooks/            # Custom React hooks (usePlayer, usePlaylist, useToast)
├── i18n/             # Internationalization (locales: zh.ts, en.ts)
├── services/         # Business logic
│   ├── audio/        # Audio processing
│   ├── cache/        # Caching (IndexedDB, Tauri image cache)
│   ├── lyrics/       # Lyrics parsing, Netease lyrics, translations
│   ├── music/        # Music search, Netease API, audio streaming
│   └── ui/           # UI utilities (keyboard registry)
├── types.ts          # Global TypeScript interfaces/enums
├── utils/            # Utility functions
└── vendor/           # Third-party library shims
```

---

## Key Technologies

- **React 19** with TypeScript
- **Vite 6** for bundling
- **Vitest** for testing
- **Tailwind CSS 3.4** for styling
- **Tauri 2.0** for desktop app
- **@react-spring/web** for animations
- **@tauri-apps/api** for native desktop features

---

## Common Development Patterns

### Handling Tauri vs Web Build
```typescript
// Check if running in Tauri
const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;

// Conditional imports
if (isTauri) {
  // Tauri-specific code
}
```

### Performance Optimizations
- Use `useMemo` for expensive computations
- Lazy load non-critical components
- Use `requestIdleCallback` for prefetching
- Memoize callbacks passed to children

### Path Alias Usage
```typescript
// Instead of relative imports
import { Song, PlayState } from "@/types";
import { usePlayer } from "@/hooks/usePlayer";
import { fetchNeteaseWithFallback } from "@/services/music/neteaseRequest";

// Use relative for same-directory files
import Icons from "./Icons";
import Toast from "../common/Toast";
```

---

## Important Notes

1. **No ESLint/Prettier config**: Project uses default Vite/TypeScript settings. Maintain code quality manually.
2. **No built-in lint script**: Run TypeScript check via `npx tsc --noEmit`.
3. **Mobile-first Tailwind**: Many classes use mobile patterns (`sm:`, `lg:` prefixes).
4. **i18n Support**: All user-facing strings should use `useI18n()` hook for translation.
5. **Tauri API**: Use `@tauri-apps/api` for native features (process, updater, etc.).
6. **Watch mode recommended**: Use `vitest` (without run) during TDD for faster feedback.

## Cursor/Copilot Rules

- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` files found in this repository.
- Follow the guidelines in this file when working with AI assistants.
