import { useCallback, useEffect, useRef, useState } from 'react';
import { sanitizeEventConfig } from '../config/eventConfig.js';
import { fetchSharedSettings, pushSharedSettings } from '../utils/sharedSettings.js';
import {
  KEYS,
  isStorageAvailable,
  isValidImageData,
  loadImage,
  loadSettings,
  loadSyncedAt,
  saveImage,
  saveSettings,
  saveSyncedAt,
} from '../utils/storage.js';

// How often an open screen checks the server for settings saved elsewhere.
const SYNC_INTERVAL_MS = 10000;

function loadImages() {
  return { logo: loadImage(KEYS.logo), background: loadImage(KEYS.background) };
}

/*
 * Event settings, options and uploaded images.
 *
 * The event wording and images are shared: they are saved on the server and
 * every device picks them up (see utils/sharedSettings.js). A copy is kept in
 * localStorage so the screen still works offline. The sound and rehearsal
 * options belong to each device and are never shared.
 */
export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);
  const [images, setImages] = useState(loadImages);
  const [storageAvailable] = useState(isStorageAvailable);
  // null = no server reachable; otherwise whether saving needs the organiser PIN.
  const [sharing, setSharing] = useState(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const syncedAtRef = useRef(loadSyncedAt());

  /** Applies wording and images to this device and stores them locally. */
  const applyEventDetails = useCallback((event, nextImages) => {
    const next = { ...settingsRef.current, event: sanitizeEventConfig(event) };
    settingsRef.current = next;
    setSettings(next);
    setImages(nextImages);
    return {
      event: next.event,
      settingsSaved: saveSettings(next),
      logoSaved: saveImage(KEYS.logo, nextImages.logo),
      backgroundSaved: saveImage(KEYS.background, nextImages.background),
    };
  }, []);

  /**
   * Saves event wording and images on this device, then shares them with every
   * other device. Resolves to what was stored locally plus `shared`:
   * 'shared' | 'pin' | 'too-large' | 'unreachable'.
   */
  const saveEventDetails = useCallback(
    async (event, nextImages, pin) => {
      const local = applyEventDetails(event, nextImages);
      const result = await pushSharedSettings({ event: local.event, ...nextImages, pin });
      if (result.status === 'shared') {
        syncedAtRef.current = result.updatedAt;
        saveSyncedAt(result.updatedAt);
      }
      return { ...local, shared: result.status };
    },
    [applyEventDetails]
  );

  /** Sets a boolean option (soundEnabled, rehearsalMode) and saves it at once. */
  const setOption = useCallback((key, value) => {
    const next = { ...settingsRef.current, [key]: Boolean(value) };
    settingsRef.current = next;
    setSettings(next);
    return saveSettings(next);
  }, []);

  // Pick up settings saved on another device, now and every few seconds.
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const data = await fetchSharedSettings(syncedAtRef.current);
      if (cancelled) return;
      if (!data) {
        setSharing(null);
        return;
      }
      setSharing({ pinRequired: data.pinRequired === true });
      const shared = data.changed ? data.settings : null;
      if (!shared || !shared.updatedAt) return;
      applyEventDetails(shared.event, {
        logo: isValidImageData(shared.logo) ? shared.logo : '',
        background: isValidImageData(shared.background) ? shared.background : '',
      });
      syncedAtRef.current = shared.updatedAt;
      saveSyncedAt(shared.updatedAt);
    };
    sync();
    const timer = setInterval(sync, SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [applyEventDetails]);

  // Keep several tabs of the same browser in step.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === null || event.key === KEYS.settings) setSettings(loadSettings());
      if (event.key === null || event.key === KEYS.logo || event.key === KEYS.background) {
        setImages(loadImages());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { settings, images, storageAvailable, sharing, saveEventDetails, setOption };
}
