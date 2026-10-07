import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KEYS,
  clearCeremonyRecord,
  loadCeremonyRecord,
  saveCeremonyRecord,
} from '../utils/storage.js';

/*
 * Ceremony state machine:  welcome → unveiling → inaugurated
 *
 *   official    true when the inauguration is the real one (saved to storage),
 *               false for a rehearsal (kept in memory only).
 *   celebrate   true when the inauguration happened in this page session, so
 *               the entrance animation and confetti should play. False when
 *               the completed screen was restored after a refresh.
 */
const WELCOME = { phase: 'welcome', official: false, activatedAt: null, celebrate: false };

function restoredState() {
  const record = loadCeremonyRecord();
  if (!record) return WELCOME;
  return { phase: 'inaugurated', official: true, activatedAt: record.activatedAt, celebrate: false };
}

export function useCeremonyState() {
  const [state, setState] = useState(restoredState);
  // Synchronous guard so a double tap can never activate the ceremony twice.
  const lockedRef = useRef(state.phase !== 'welcome');

  const activate = useCallback(({ rehearsal = false } = {}) => {
    if (lockedRef.current) return null;
    lockedRef.current = true;

    const activatedAt = new Date().toISOString();
    // Persist the official record BEFORE the animation starts, so a refresh
    // during the unveiling opens the completed screen. If storage fails the
    // ceremony still proceeds in memory.
    if (!rehearsal) saveCeremonyRecord(activatedAt);

    setState({ phase: 'unveiling', official: !rehearsal, activatedAt, celebrate: true });
    return activatedAt;
  }, []);

  const complete = useCallback(() => {
    setState((current) =>
      current.phase === 'unveiling' ? { ...current, phase: 'inaugurated' } : current
    );
  }, []);

  /** Returns to the welcome screen. Event settings are not touched. */
  const reset = useCallback(() => {
    const cleared = clearCeremonyRecord();
    lockedRef.current = false;
    setState(WELCOME);
    return cleared;
  }, []);

  // Keep several tabs on the same device in step (e.g. organiser page in one
  // tab, ceremony screen in another).
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== null && event.key !== KEYS.status && event.key !== KEYS.resetSignal) return;
      const record = loadCeremonyRecord();
      if (record) {
        lockedRef.current = true;
        setState((current) =>
          current.official
            ? current
            : { phase: 'inaugurated', official: true, activatedAt: record.activatedAt, celebrate: false }
        );
      } else {
        lockedRef.current = false;
        setState(WELCOME);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { ...state, activate, complete, reset };
}
