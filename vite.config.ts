import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: '/rafrelay/',
  server: { allowedHosts: ['terminal.local'] },
  build: { sourcemap: true },
});
