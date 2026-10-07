import { useCallback, useEffect, useRef, useState } from 'react';
import { sanitizeEventConfig } from '../config/eventConfig.js';
import {
  KEYS,
  isStorageAvailable,
  loadImage,
  loadSettings,
  saveImage,
  saveSettings,
} from '../utils/storage.js';

function loadImages() {
  return { logo: loadImage(KEYS.logo), background: loadImage(KEYS.background) };
}

/** Event settings, options and uploaded images, kept in localStorage. */
export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);
  const [images, setImages] = useState(loadImages);
  const [storageAvailable] = useState(isStorageAvailable);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  /** Saves event wording and images. Returns what was actually persisted. */
  const saveEventDetails = useCallback((event, nextImages) => {
    const next = { ...settingsRef.current, event: sanitizeEventConfig(event) };
    setSettings(next);
    setImages(nextImages);
    return {
      event: next.event,
      settingsSaved: saveSettings(next),
      logoSaved: saveImage(KEYS.logo, nextImages.logo),
      backgroundSaved: saveImage(KEYS.background, nextImages.background),
    };
  }, []);

  /** Sets a boolean option (soundEnabled, rehearsalMode) and saves it at once. */
  const setOption = useCallback((key, value) => {
    const next = { ...settingsRef.current, [key]: Boolean(value) };
    setSettings(next);
    return saveSettings(next);
  }, []);

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

  return { settings, images, storageAvailable, saveEventDetails, setOption };
}
