import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@workspace/api-client-react': path.resolve(__dirname, 'src/api-client-react/index.ts'),
    },
  },
  base: './', // CRITICAL: Ensures all compiled JS, CSS, and asset files use relative paths so Electron can load them from the file system.
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
