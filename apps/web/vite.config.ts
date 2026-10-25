import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 4200,
    strictPort: true,
    host: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@iptvnator/shared/interfaces': resolve(
        __dirname,
        '../../libs/shared/interfaces/src/index.ts'
      ),
      '@iptvnator/shared/m3u-utils': resolve(
        __dirname,
        '../../libs/shared/m3u-utils/src/index.ts'
      ),
    },
  },
  build: {
    outDir: resolve(__dirname, '../../dist/apps/web'),
    emptyOutDir: true,
  },
});
