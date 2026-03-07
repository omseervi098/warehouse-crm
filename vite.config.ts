import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  base: './',
  plugins: [
    tailwindcss()
  ],
  build: {
    outDir: 'dist-react'
  },
  server: {
    port: 5123,
    strictPort: true,
  }
});
