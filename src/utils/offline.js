/*
 * Service worker registration and offline-readiness checks.
 * Readiness is only ever reported on the organiser page.
 */

/** Registers the service worker in production builds. Never forces a reload. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is optional; the ceremony works without it.
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

function askWorker(worker) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 5000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data || null);
    };
    try {
      worker.postMessage({ type: 'VERIFY_CACHE' }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Resolves to `{ state, total?, updateWaiting? }` where state is one of:
 * unsupported | insecure | development | preparing | incomplete | uncontrolled | ready
 * "ready" is only returned once the worker confirms every file is cached and
 * this page is being served by it.
 */
export async function queryOfflineStatus() {
  if (!('serviceWorker' in navigator) || !('caches' in window)) return { state: 'unsupported' };
  if (!window.isSecureContext) return { state: 'insecure' };
  if (!import.meta.env.PROD) return { state: 'development' };

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration || !registration.active) return { state: 'preparing' };

    const report = await askWorker(registration.active);
    if (!report || typeof report.missing !== 'number') return { state: 'preparing' };
    if (report.missing !== 0) return { state: 'incomplete' };

    const updateWaiting = Boolean(registration.waiting);
    if (!navigator.serviceWorker.controller) return { state: 'uncontrolled', updateWaiting };
    return { state: 'ready', total: report.total, updateWaiting };
  } catch {
    return { state: 'preparing' };
  }
}
