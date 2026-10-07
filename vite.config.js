import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Files in dist/ that the service worker should not precache.
const PRECACHE_EXCLUDE = new Set(['sw.js', 'index.html', '_redirects']);

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full, base);
    return [path.relative(base, full).split(path.sep).join('/')];
  });
}

/**
 * After the build, writes the list of built files (and a version derived from
 * their contents) into dist/sw.js so the service worker can cache the whole
 * application for offline use.
 */
function precacheManifest() {
  let outDir = 'dist';
  return {
    name: 'tuda-precache-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const swPath = path.join(outDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;

      const files = listFiles(outDir).sort();
      const hash = createHash('sha256');
      for (const file of files) {
        if (file === 'sw.js') continue;
        hash.update(file);
        hash.update(fs.readFileSync(path.join(outDir, file)));
      }
      const version = hash.digest('hex').slice(0, 12);
      const urls = files.filter((file) => !PRECACHE_EXCLUDE.has(file)).map((file) => `./${file}`);

      const source = fs
        .readFileSync(swPath, 'utf8')
        .replace("'__SW_VERSION__'", JSON.stringify(version))
        .replace("['__PRECACHE_URLS__']", JSON.stringify(urls));
      fs.writeFileSync(swPath, source);
    },
  };
}

// In development and preview, pass operator-signal requests to the signal
// server (start it with `npm start`).
const proxy = { '/api': { target: 'http://localhost:8080', changeOrigin: true } };

export default defineConfig({
  plugins: [react(), precacheManifest()],
  server: { proxy },
  preview: { proxy },
});
