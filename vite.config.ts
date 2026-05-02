/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { resolve } from 'path';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [cloudflare()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
    },
  },
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
});