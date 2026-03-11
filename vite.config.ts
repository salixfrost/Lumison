import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

// Plugin to dynamically update manifest.json based on base path
function manifestPlugin(base: string): Plugin {
  return {
    name: 'manifest-plugin',
    apply: 'build',
    closeBundle() {
      // Only modify if not root path
      if (base === '/') return;

      const manifestPath = path.resolve(__dirname, 'dist/manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

        // Update paths to include base
        manifest.start_url = base;
        manifest.icons = manifest.icons.map((icon: any) => {
          // Handle both relative and absolute paths
          const iconSrc = icon.src.startsWith('/') ? icon.src.slice(1) : icon.src;
          return {
            ...icon,
            src: base + iconSrc
          };
        });

        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log('✓ Updated manifest.json for GitHub Pages');
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;
  const base = isTauri ? '/' : '/lumison/';

  return {
    // Use root path for Tauri, repo name for GitHub Pages
    base,
    root: '.',

    // Tauri uses a different server configuration
    server: {
      port: isTauri ? 1420 : 3000,
      host: '0.0.0.0',
      strictPort: true,
    },

    plugins: [react(), manifestPlugin(base)],

    // Ensure Tauri API is available in desktop mode
    define: {
      '__TAURI__': isTauri,
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        // Fix jsmediatags module resolution - use minified browser build
        'jsmediatags': path.resolve(__dirname, 'node_modules/jsmediatags/dist/jsmediatags.min.js'),
      },
    },

    // Optimize dependencies
    optimizeDeps: {
      include: ['jsmediatags'],
    },

    // Optimize for desktop builds
    build: {
      target: isTauri ? 'esnext' : 'es2015',
      minify: mode === 'production',
      sourcemap: mode === 'development',
    },
  };
});
