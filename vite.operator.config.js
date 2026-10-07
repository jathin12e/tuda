import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build of the separate operator web app (operator-app/) into dist-operator/.
const proxy = { '/api': { target: 'http://localhost:8080', changeOrigin: true } };

export default defineConfig({
  root: 'operator-app',
  // Read VITE_API_URL from the project root, like the main app.
  envDir: path.resolve('.'),
  plugins: [react()],
  build: { outDir: '../dist-operator', emptyOutDir: true },
  server: { port: 5174, proxy, fs: { allow: ['..'] } },
  preview: { port: 4174, proxy },
});
