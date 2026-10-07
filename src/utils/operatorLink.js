/*
 * Link to the optional signal server (server/index.mjs), which relays the
 * "button pressed" moment to the fountain operator's screen at /operator.
 *
 * Everything here is best-effort. When the app is hosted as plain static files
 * there is no signal server, every call fails quietly, and the ceremony is
 * unaffected.
 */
// Same server by default (`npm start`). When the API is hosted on its own
// domain, set VITE_API_URL at build time, e.g. https://tuda-api.example.org/api
const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const SIGNAL_URL = `${API_URL}/signal`;
const STATE_URL = `${API_URL}/state`;
export const EVENTS_URL = `${API_URL}/events?role=operator`;

const RETRY_DELAY_MS = 2000;
const MAX_ATTEMPTS = 15;

async function post(payload) {
  const response = await fetch(SIGNAL_URL, {
    method: 'POST',
    // Sent as plain text (still JSON inside) so that a cross-domain API needs
    // no CORS preflight round-trip before the alert goes out.
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
    keepalive: true,
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = new Error(`Signal server replied ${response.status}`);
    // 404/405 means this is plain static hosting with no signal server at all.
    error.permanent = response.status === 404 || response.status === 405;
    throw error;
  }
  const data = await response.json();
  if (!data || data.ok !== true) throw new Error('Unexpected reply');
  return data;
}

let pending = 0;

/**
 * Sends a signal and keeps retrying in the background for about 30 seconds.
 * Never throws and never blocks: the ceremony does not wait for it.
 * A newer signal replaces any that is still being retried.
 */
export function sendSignal(payload) {
  const ticket = ++pending;
  let attempts = 0;
  const attempt = () => {
    if (ticket !== pending) return;
    attempts++;
    post(payload).catch((error) => {
      // Network trouble: try again for a while, quietly. No server: give up.
      if (error && error.permanent) return;
      if (attempts < MAX_ATTEMPTS && ticket === pending) setTimeout(attempt, RETRY_DELAY_MS);
    });
  };
  try {
    attempt();
  } catch {
    // Signalling is optional.
  }
}

/** One-off signal with a result, for buttons on the organiser/operator pages. */
export async function sendSignalOnce(payload) {
  try {
    return await post(payload);
  } catch {
    return null;
  }
}

/** Resolves to `{ state, operators, serverNow }`, or null if there is no signal server. */
export async function fetchLinkStatus() {
  try {
    const response = await fetch(STATE_URL, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    return data && data.ok === true && data.state ? data : null;
  } catch {
    return null;
  }
}
