import { defaultEventConfig, sanitizeEventConfig, sanitizeOptions } from '../config/eventConfig.js';

/*
 * Safe localStorage access. Every call is wrapped so that a blocked, full or
 * corrupted store can never break the ceremony: reads fall back to defaults
 * and writes simply report failure.
 */
export const KEYS = {
  settings: 'tuda-ceremony:settings',
  status: 'tuda-ceremony:status',
  logo: 'tuda-ceremony:logo',
  background: 'tuda-ceremony:background',
  resetSignal: 'tuda-ceremony:reset-signal',
  syncedAt: 'tuda-ceremony:synced-at',
  pin: 'tuda-ceremony:organiser-pin',
};

const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,/;

function getStore() {
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function readRaw(key) {
  try {
    const store = getStore();
    return store ? store.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeRaw(key, value) {
  try {
    const store = getStore();
    if (!store) return false;
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeRaw(key) {
  try {
    const store = getStore();
    if (!store) return false;
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function readJSON(key) {
  const raw = readRaw(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isStorageAvailable() {
  const probe = 'tuda-ceremony:probe';
  return writeRaw(probe, '1') && removeRaw(probe);
}

/* ---- Event settings ---------------------------------------------------- */

export function loadSettings() {
  const stored = readJSON(KEYS.settings);
  const valid = stored && typeof stored === 'object' && !Array.isArray(stored);
  return {
    event: valid ? sanitizeEventConfig(stored.event) : { ...defaultEventConfig },
    ...sanitizeOptions(valid ? stored : null),
  };
}

export function saveSettings(settings) {
  return writeRaw(
    KEYS.settings,
    JSON.stringify({
      version: 1,
      event: sanitizeEventConfig(settings.event),
      ...sanitizeOptions(settings),
    })
  );
}

/* ---- Uploaded images (stored as data URLs) ------------------------------ */

export function isValidImageData(value) {
  return typeof value === 'string' && IMAGE_PATTERN.test(value);
}

export function loadImage(key) {
  const raw = readRaw(key);
  return isValidImageData(raw) ? raw : '';
}

export function saveImage(key, dataUrl) {
  if (!dataUrl) {
    removeRaw(key);
    return true;
  }
  return isValidImageData(dataUrl) && writeRaw(key, dataUrl);
}

/* ---- Official inauguration record -------------------------------------- */

/** Returns `{ activatedAt }` when an official inauguration is recorded, else null. */
export function loadCeremonyRecord() {
  const stored = readJSON(KEYS.status);
  if (!stored || typeof stored !== 'object' || stored.status !== 'inaugurated') return null;
  const valid =
    typeof stored.activatedAt === 'string' && !Number.isNaN(Date.parse(stored.activatedAt));
  return { activatedAt: valid ? stored.activatedAt : null };
}

export function saveCeremonyRecord(activatedAt) {
  return writeRaw(KEYS.status, JSON.stringify({ status: 'inaugurated', activatedAt }));
}

/** Clears only the inauguration status. Event settings and images are kept. */
export function clearCeremonyRecord() {
  const removed = removeRaw(KEYS.status);
  // Lets a ceremony screen open in another tab return to the welcome screen.
  writeRaw(KEYS.resetSignal, String(Date.now()));
  return removed && readRaw(KEYS.status) === null;
}

/* ---- Shared settings bookkeeping ---------------------------------------- */

/** Version of the shared settings this device last received from the server. */
export function loadSyncedAt() {
  return readRaw(KEYS.syncedAt) || '';
}

export function saveSyncedAt(value) {
  return writeRaw(KEYS.syncedAt, String(value || ''));
}

/** Organiser PIN, remembered on this device so it is typed only once. */
export function loadPin() {
  return readRaw(KEYS.pin) || '';
}

export function savePin(value) {
  return value ? writeRaw(KEYS.pin, String(value)) : removeRaw(KEYS.pin);
}
