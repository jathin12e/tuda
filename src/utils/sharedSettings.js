/*
 * Shared settings: the event wording, logo and background image are stored on
 * the signal server so that every device and browser shows the same thing.
 * Each device also keeps its own copy (localStorage) so it still works offline.
 *
 * Everything here is best-effort: with no server, the app simply uses the
 * copy saved on the device.
 */
import { API_URL } from './operatorLink.js';

const SETTINGS_URL = `${API_URL}/settings`;

/**
 * Asks the server for the shared settings.
 * `since` is the version this device already has; if it is still current the
 * server answers without sending the images again.
 * Resolves to `{ changed, settings, pinRequired }`, or null if unreachable.
 */
export async function fetchSharedSettings(since) {
  try {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    const response = await fetch(SETTINGS_URL + query, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    return data && data.ok === true ? data : null;
  } catch {
    return null;
  }
}

/**
 * Saves the settings for every device.
 * Resolves to `{ status, updatedAt? }` where status is one of:
 *   shared       stored on the server
 *   pin          the organiser PIN was missing or wrong
 *   too-large    the images are too big for the server to accept
 *   unreachable  no server, or no connection
 */
export async function pushSharedSettings({ event, logo, background, pin }) {
  try {
    const response = await fetch(SETTINGS_URL, {
      method: 'POST',
      // Plain text (JSON inside) avoids a CORS preflight on a cross-domain API.
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ event, logo, background, pin }),
      cache: 'no-store',
    });
    if (response.status === 401) return { status: 'pin' };
    if (response.status === 413) return { status: 'too-large' };
    if (!response.ok) return { status: 'unreachable' };
    const data = await response.json();
    if (!data || data.ok !== true) return { status: 'unreachable' };
    return { status: 'shared', updatedAt: data.updatedAt };
  } catch {
    return { status: 'unreachable' };
  }
}
