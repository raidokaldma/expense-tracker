/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // npm run dev: the API server runs next to Vite (see server/dev.ts)
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
