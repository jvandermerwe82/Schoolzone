import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // In development, API calls go to the server started with `npm run dev:server`.
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  test: { globals: true, environment: 'node' },
});
