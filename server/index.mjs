/*
 * Signal server for the TUDA inauguration app (no dependencies).
 *
 * It does two things:
 *   1. Serves the built app from dist/.
 *   2. Relays the "button pressed" signal from the ceremony screen to any
 *      operator screens (/operator) that are listening.
 *   3. Stores the event settings (wording, logo, background image) so every
 *      device shows the same thing.
 *
 * It alerts a PERSON — the fountain operator. It does not talk to the fountain,
 * PLC, pumps, lights or music system.
 *
 * Run with:  npm run build && npm start        (PORT defaults to 8080)
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT) || 8080;
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const HEARTBEAT_MS = 10000;
// Sites allowed to use the API from another domain, comma separated,
// e.g. CORS_ORIGIN=https://tuda.example.org. Not needed when this server also
// serves the app itself.
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const MAX_BODY_BYTES = 2048;

// Shared event settings are kept in one JSON file so they survive a restart.
const DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const MAX_SETTINGS_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_CHARS = 4 * 1024 * 1024;
const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
// When set, saving shared settings requires this PIN (reading never does).
const ORGANISER_PIN = (process.env.ORGANISER_PIN || '').trim();

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

/* ---- Signal state (kept in memory; a restart returns to standby) --------- */

let sequence = 0;
let state = { status: 'standby', rehearsal: false, at: null, acknowledgedAt: null, seq: 0 };
const listeners = new Set(); // open event streams: { res, operator }

function operatorCount() {
  let count = 0;
  for (const listener of listeners) if (listener.operator) count++;
  return count;
}

function snapshot() {
  return { state, operators: operatorCount(), serverNow: Date.now() };
}

function send(listener, event, data) {
  try {
    listener.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    listeners.delete(listener);
  }
}

function broadcast(event = 'state', data = snapshot()) {
  for (const listener of listeners) send(listener, event, data);
}

function applySignal(signal) {
  const type = signal && typeof signal === 'object' ? signal.type : null;

  if (type === 'go') {
    const at =
      typeof signal.at === 'string' && !Number.isNaN(Date.parse(signal.at))
        ? new Date(signal.at).toISOString()
        : new Date().toISOString();
    // The ceremony screen retries until it gets through; ignore repeats.
    if (state.status === 'go' && state.at === at) return true;
    state = {
      status: 'go',
      rehearsal: signal.rehearsal === true,
      at,
      // Server clock, so operator screens can run the countdown in step even
      // if the ceremony device's own clock is wrong.
      receivedAt: Date.now(),
      acknowledgedAt: null,
      seq: ++sequence,
    };
    console.log(`[signal] ${state.rehearsal ? 'REHEARSAL' : 'OFFICIAL'} button pressed at ${at}`);
  } else if (type === 'standby') {
    if (state.status === 'standby') return true;
    // A ceremony screen returning to its welcome screen may clear a rehearsal
    // alert, but only the organiser's reset can clear an official one.
    if (signal.onlyRehearsal === true && !state.rehearsal) return true;
    state = { status: 'standby', rehearsal: false, at: null, acknowledgedAt: null, seq: ++sequence };
    console.log('[signal] reset to standby');
  } else if (type === 'ack') {
    if (state.status !== 'go' || state.acknowledgedAt) return true;
    state = { ...state, acknowledgedAt: new Date().toISOString() };
    console.log('[signal] operator acknowledged');
  } else if (type === 'test') {
    console.log('[signal] test alert');
    broadcast('test', { serverNow: Date.now() });
    return true;
  } else {
    return false;
  }

  broadcast();
  return true;
}

/* ---- Shared settings ---------------------------------------------------- */

function loadSharedSettings() {
  try {
    const stored = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    return stored && typeof stored.updatedAt === 'string' ? stored : null;
  } catch {
    return null;
  }
}

let sharedSettings = loadSharedSettings();

function cleanImage(value) {
  if (value === '' || value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > MAX_IMAGE_CHARS) return null;
  return IMAGE_PATTERN.test(value) ? value : null;
}

// Keeps only short strings; the app itself decides which keys it understands.
function cleanEvent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > 40) return null;
  const clean = {};
  for (const [key, text] of entries) {
    if (key.length > 40 || typeof text !== 'string' || text.length > 200) return null;
    clean[key] = text;
  }
  return clean;
}

function storeSharedSettings(next) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temporary = `${SETTINGS_FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(next));
  fs.renameSync(temporary, SETTINGS_FILE);
  sharedSettings = next;
}

/* ---- HTTP ---------------------------------------------------------------- */

function corsHeaders(req) {
  const origin = req.headers.origin;
  if (!origin || !CORS_ORIGINS.includes(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...corsHeaders(res.req),
  });
  res.end(JSON.stringify(body));
}

function handleEvents(req, res, url) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...corsHeaders(req),
  });
  res.write('retry: 2000\n\n');

  const listener = { res, operator: url.searchParams.get('role') === 'operator' };
  listeners.add(listener);
  broadcast(); // everyone learns the new operator count

  req.on('close', () => {
    listeners.delete(listener);
    broadcast();
  });
}

function handleSignal(req, res) {
  let body = '';
  let tooLarge = false;
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY_BYTES) tooLarge = true;
  });
  req.on('end', () => {
    if (tooLarge) return json(res, 413, { ok: false });
    let signal = null;
    try {
      signal = JSON.parse(body);
    } catch {
      return json(res, 400, { ok: false });
    }
    if (!applySignal(signal)) return json(res, 400, { ok: false });
    return json(res, 200, { ok: true, ...snapshot() });
  });
}

function handleGetSettings(res, url) {
  const current = sharedSettings ? sharedSettings.updatedAt : '';
  const unchanged = url.searchParams.get('since') === current;
  json(res, 200, {
    ok: true,
    pinRequired: Boolean(ORGANISER_PIN),
    changed: !unchanged,
    settings: unchanged ? undefined : sharedSettings,
  });
}

function handleSaveSettings(req, res) {
  const chunks = [];
  let size = 0;
  let tooLarge = false;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_SETTINGS_BYTES) tooLarge = true;
    else chunks.push(chunk);
  });
  req.on('end', () => {
    if (tooLarge) return json(res, 413, { ok: false });
    let body = null;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return json(res, 400, { ok: false });
    }
    if (!body || typeof body !== 'object') return json(res, 400, { ok: false });

    if (ORGANISER_PIN && String(body.pin || '').trim() !== ORGANISER_PIN) {
      // A short pause makes guessing the PIN slow.
      return setTimeout(() => json(res, 401, { ok: false }), 800);
    }

    const event = cleanEvent(body.event);
    const logo = cleanImage(body.logo);
    const background = cleanImage(body.background);
    if (!event || logo === null || background === null) return json(res, 400, { ok: false });

    try {
      storeSharedSettings({ updatedAt: new Date().toISOString(), event, logo, background });
    } catch (error) {
      console.error('[settings] could not save:', error.message);
      return json(res, 500, { ok: false });
    }
    console.log(`[settings] saved (${Math.round(size / 1024)} KB)`);
    return json(res, 200, { ok: true, updatedAt: sharedSettings.updatedAt });
  });
}

function serveStatic(req, res, url) {
  let relative;
  try {
    relative = decodeURIComponent(url.pathname);
  } catch {
    relative = '/';
  }
  let file = path.normalize(path.join(DIST, relative));
  if (!file.startsWith(DIST)) file = path.join(DIST, 'index.html');

  // Pages such as /organiser and /operator are all served by the app shell.
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (path.extname(relative)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    file = path.join(DIST, 'index.html');
  }

  if (!fs.existsSync(file)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('The app has not been built yet. Run "npm run build" first.');
    return;
  }

  const name = path.basename(file);
  const immutable = file.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': immutable
      ? 'public, max-age=31536000, immutable'
      : name === 'sw.js' || name === 'index.html'
        ? 'no-cache'
        : 'public, max-age=3600',
  });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.startsWith('/api/') && req.method === 'OPTIONS') {
    res.writeHead(204, {
      ...corsHeaders(req),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }
  if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true });
  if (url.pathname === '/api/settings' && req.method === 'GET') return handleGetSettings(res, url);
  if (url.pathname === '/api/settings' && req.method === 'POST') return handleSaveSettings(req, res);
  if (url.pathname === '/api/state' && req.method === 'GET') return json(res, 200, { ok: true, ...snapshot() });
  if (url.pathname === '/api/events' && req.method === 'GET') return handleEvents(req, res, url);
  if (url.pathname === '/api/signal' && req.method === 'POST') return handleSignal(req, res);
  if (url.pathname.startsWith('/api/')) return json(res, 404, { ok: false });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }
  return serveStatic(req, res, url);
});

// Regular heartbeat so operator screens can tell at once if the link drops.
setInterval(() => broadcast(), HEARTBEAT_MS).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nTUDA inauguration app with operator signal — port ${PORT}\n`);
  console.log(`  This computer:    http://localhost:${PORT}`);
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        console.log(`  On the network:   http://${address.address}:${PORT}`);
      }
    }
  }
  console.log('\n  Ceremony screen:  /');
  console.log('  Organiser:        /organiser');
  console.log('  Operator screen:  /operator\n');
});
