import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENT_FIELD_GROUPS, defaultEventConfig } from '../config/eventConfig.js';
import { fileToDataUrl } from '../utils/image.js';
import { queryOfflineStatus } from '../utils/offline.js';
import { fetchLinkStatus, sendSignalOnce } from '../utils/operatorLink.js';
import {
  CHIME_TAIL,
  isSoundSupported,
  isSpeechSupported,
  playCeremonyChime,
  speakAfter,
} from '../utils/sound.js';
import InauguratedScreen from './InauguratedScreen.jsx';
import WelcomeScreen from './WelcomeScreen.jsx';

/* ---- Fullscreen ---------------------------------------------------------- */

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function fullscreenSupported() {
  const root = document.documentElement;
  return (
    Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled) &&
    Boolean(root.requestFullscreen || root.webkitRequestFullscreen)
  );
}

function isStandalone() {
  return (
    window.navigator.standalone === true ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches)
  );
}

function useFullscreen() {
  const [supported] = useState(fullscreenSupported);
  const [active, setActive] = useState(() => Boolean(fullscreenElement()));

  useEffect(() => {
    const onChange = () => setActive(Boolean(fullscreenElement()));
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggle = useCallback(() => {
    try {
      const root = document.documentElement;
      const result = fullscreenElement()
        ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
        : (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch {
      // The browser refused; the button simply has no effect.
    }
  }, []);

  return { supported, active, toggle };
}

/* ---- Offline readiness --------------------------------------------------- */

const SETTLED_STATES = new Set(['ready', 'unsupported', 'insecure', 'development']);

function useOfflineStatus() {
  const [status, setStatus] = useState({ state: 'checking' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const check = async () => {
      const next = await queryOfflineStatus();
      if (cancelled) return;
      setStatus(next);
      if (!SETTLED_STATES.has(next.state)) timer = setTimeout(check, 3000);
    };
    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tick]);

  return [status, () => setTick((value) => value + 1)];
}

const OFFLINE_MESSAGES = {
  checking: ['pending', 'Checking…', ''],
  ready: [
    'ok',
    'Ready for offline use',
    'The application is stored on this device and has been verified. The ceremony screen will open without a network connection.',
  ],
  preparing: [
    'pending',
    'Preparing the offline copy…',
    'Keep this page open while connected to the network. This status updates automatically.',
  ],
  incomplete: [
    'pending',
    'Offline copy is incomplete',
    'Some files are not stored yet. Stay connected to the network; this status updates automatically.',
  ],
  uncontrolled: [
    'pending',
    'Almost ready — reload this page once',
    'The files are stored, but this page was opened before the offline copy took over. Reload the page now (before the ceremony) and check again.',
  ],
  insecure: [
    'warn',
    'Offline use is not available on this connection',
    'Offline storage only works when the site is opened over HTTPS (or on localhost). This page was opened over an insecure address, so nothing can be stored.',
  ],
  unsupported: [
    'warn',
    'Offline use is not supported in this browser',
    'This browser cannot store the application. Keep the device connected to the network during the ceremony.',
  ],
  development: [
    'warn',
    'Offline storage is switched off in the development server',
    'Use the production build to prepare and test offline use: run “npm run build”, then “npm run preview”.',
  ],
};

/* ---- Operator alert link ------------------------------------------------- */

function OperatorLinkPanel() {
  // undefined = checking, null = no signal server, object = live status
  const [status, setStatus] = useState(undefined);
  const [testMessage, setTestMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const next = await fetchLinkStatus();
      if (!cancelled) setStatus(next);
    };
    check();
    const timer = setInterval(check, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const sendTest = async () => {
    const result = await sendSignalOnce({ type: 'test' });
    if (!result) {
      setTestMessage({ tone: 'warn', text: 'The test alert could not be sent.' });
    } else if (result.operators === 0) {
      setTestMessage({ tone: 'warn', text: 'Sent, but no operator screen is open to receive it.' });
    } else {
      setTestMessage({
        tone: 'ok',
        text: `Test alert sent to ${result.operators} operator screen${result.operators === 1 ? '' : 's'}. Ask the operator to confirm they saw it.`,
      });
    }
  };

  // The separate operator web app when one is deployed, else the built-in page.
  const operatorUrl = import.meta.env.VITE_OPERATOR_URL || `${window.location.origin}/operator`;
  let tone = 'pending';
  let title = 'Checking…';
  let detail = '';
  if (status === null) {
    tone = 'warn';
    title = 'Not available — no signal server';
    detail =
      'This copy of the app is running without the signal server, so the operator will NOT be alerted by the app. Use a manual cue, or run the app with “npm start” (see the README).';
  } else if (status && status.operators === 0) {
    tone = 'warn';
    title = 'No operator screen is connected';
    detail = 'Ask the operator to open the address below on their phone and keep it open.';
  } else if (status) {
    tone = 'ok';
    title = `${status.operators} operator screen${status.operators === 1 ? '' : 's'} connected`;
    detail = 'The operator will be alerted the moment the button is pressed.';
  }

  const state = status ? status.state : null;

  return (
    <section className="panel" aria-labelledby="operator-heading">
      <h2 id="operator-heading">Operator alert</h2>
      <div className={`status status--${tone}`} role="status">
        <p className="status__title">{title}</p>
        {detail && <p className="status__detail">{detail}</p>}
        {state && state.status === 'go' && (
          <p className="status__detail">
            {state.rehearsal ? 'Rehearsal alert' : 'Official alert'} sent at{' '}
            {formatTimestamp(state.at)} —{' '}
            {state.acknowledgedAt ? 'acknowledged by the operator.' : 'not yet acknowledged.'}
          </p>
        )}
      </div>
      {status && (
        <>
          <p className="hint">
            Operator screen address: <strong className="address">{operatorUrl}</strong>
          </p>
          <div className="button-row">
            <button type="button" className="btn" onClick={sendTest}>
              Send test alert
            </button>
          </div>
          {testMessage && (
            <p className={`notice notice--${testMessage.tone}`} role="status">
              {testMessage.text}
            </p>
          )}
        </>
      )}
      <ul className="hint-list">
        <li>The alert needs a working network connection on both devices at that moment.</li>
        <li>It tells the operator when to start. It does not start or control the fountain.</li>
        <li>Always agree a manual backup cue in case the connection drops.</li>
      </ul>
    </section>
  );
}

/* ---- Small building blocks ---------------------------------------------- */

function Switch({ id, checked, onChange, label, description }) {
  return (
    <label className="switch" htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={onChange} />
      <span className="switch__track" aria-hidden="true" />
      <span className="switch__text">
        <span className="switch__label">{label}</span>
        {description && <span className="switch__description">{description}</span>}
      </span>
    </label>
  );
}

function ImageField({ id, label, hint, value, onPick, onRemove, error }) {
  const inputRef = useRef(null);
  return (
    <div className="image-field">
      <div className={`image-field__thumb${value ? '' : ' image-field__thumb--empty'}`}>
        {value ? <img src={value} alt="" /> : <span>None</span>}
      </div>
      <div className="image-field__body">
        <p className="image-field__label">{label}</p>
        <p className="hint">{hint}</p>
        <div className="button-row">
          <input
            ref={inputRef}
            id={id}
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/*"
            onChange={(event) => {
              const file = event.target.files && event.target.files[0];
              event.target.value = '';
              if (file) onPick(file);
            }}
          />
          <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
            {value ? 'Replace image' : 'Choose image'}
          </button>
          {value && (
            <button type="button" className="btn btn--quiet" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
        {error && (
          <p className="notice notice--warn" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="dialog-layer">
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">{title}</h2>
        <div className="dialog__body">{children}</div>
        <div className="button-row button-row--end">
          <button type="button" className="btn" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(iso) {
  if (!iso) return 'time not recorded';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'medium' });
  } catch {
    return iso;
  }
}

function sameEvent(a, b) {
  return Object.keys(defaultEventConfig).every((key) => a[key] === b[key]);
}

/* ---- Organiser page ------------------------------------------------------ */

export default function OrganiserPanel({
  settings,
  images,
  storageAvailable,
  ceremony,
  onSaveEvent,
  onSetOption,
  onOpenCeremony,
}) {
  const [draft, setDraft] = useState(() => ({ event: settings.event, ...images }));
  const [saveMessage, setSaveMessage] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [preview, setPreview] = useState(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);
  const [soundMessage, setSoundMessage] = useState(null);
  const fullscreen = useFullscreen();
  const [offline, recheckOffline] = useOfflineStatus();
  const [standalone] = useState(isStandalone);

  const dirty =
    !sameEvent(draft.event, settings.event) ||
    draft.logo !== images.logo ||
    draft.background !== images.background;

  const closePreview = useCallback(() => setPreview(null), []);
  const cancelReset = useCallback(() => setConfirmingReset(false), []);

  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') closePreview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, closePreview]);

  const setField = (key, value) => {
    setSaveMessage(null);
    setDraft((current) => ({ ...current, event: { ...current.event, [key]: value } }));
  };

  const pickImage = async (key, file) => {
    setSaveMessage(null);
    try {
      const dataUrl = await fileToDataUrl(
        file,
        key === 'logo'
          ? { maxSize: 640, type: 'image/png' }
          : { maxSize: 1920, type: 'image/jpeg', quality: 0.82 }
      );
      setDraft((current) => ({ ...current, [key]: dataUrl }));
      setImageErrors((current) => ({ ...current, [key]: null }));
    } catch (error) {
      setImageErrors((current) => ({ ...current, [key]: error.message }));
    }
  };

  const removeImage = (key) => {
    setSaveMessage(null);
    setDraft((current) => ({ ...current, [key]: '' }));
    setImageErrors((current) => ({ ...current, [key]: null }));
  };

  const save = () => {
    const result = onSaveEvent(draft.event, { logo: draft.logo, background: draft.background });
    setDraft((current) => ({ ...current, event: result.event }));
    if (!result.settingsSaved) {
      setSaveMessage({
        tone: 'warn',
        text: 'Applied for now, but this browser would not store the settings. They will be lost if the page is closed or refreshed.',
      });
    } else if (!result.logoSaved || !result.backgroundSaved) {
      setSaveMessage({
        tone: 'warn',
        text: 'Event details saved, but an image was too large to store on this device. It will be lost on refresh — try a smaller image.',
      });
    } else {
      setSaveMessage({ tone: 'ok', text: 'Settings saved on this device.' });
    }
  };

  const discard = () => {
    setDraft({ event: settings.event, ...images });
    setImageErrors({});
    setSaveMessage(null);
  };

  const restoreDefaults = () => {
    setDraft({ event: { ...defaultEventConfig }, logo: '', background: '' });
    setImageErrors({});
    setSaveMessage({
      tone: 'info',
      text: 'Default details loaded into the form. Press “Save settings” to apply them.',
    });
  };

  const performReset = () => {
    const wasOfficial = ceremony.official;
    const cleared = ceremony.reset();
    setConfirmingReset(false);
    if (wasOfficial && !cleared) {
      setResetMessage({
        tone: 'warn',
        text: 'The screen has been reset, but the saved record could not be cleared from this browser. It may reappear after a refresh.',
      });
    } else {
      setResetMessage({ tone: 'ok', text: 'Reset. The welcome screen is ready.' });
    }
  };

  const requestReset = () => {
    setResetMessage(null);
    if (ceremony.official) setConfirmingReset(true);
    else performReset();
  };

  const testSound = () => {
    const revealDelay = 1.5;
    const played = playCeremonyChime({ revealDelay });
    const spoken = speakAfter(draft.event.thankYouMessage, (revealDelay + CHIME_TAIL) * 1000);
    setSoundMessage(
      played || spoken
        ? {
            tone: 'info',
            text: `Chime played${spoken ? ', followed by the spoken message' : ''}. If you heard nothing, check the device volume and the silent switch.`,
          }
        : { tone: 'warn', text: 'This browser could not play sound. The ceremony will run silently.' }
    );
  };

  const inaugurated = ceremony.phase !== 'welcome';
  let statusTone = 'pending';
  let statusTitle = 'Welcome screen — awaiting inauguration';
  let statusDetail = settings.rehearsalMode
    ? 'Rehearsal Mode is ON. The next tap on the button is a rehearsal and will not be saved.'
    : 'The next tap on the button is the OFFICIAL inauguration and will be saved on this device.';
  if (inaugurated && ceremony.official) {
    statusTone = 'ok';
    statusTitle = 'Officially inaugurated';
    statusDetail = `Recorded on this device: ${formatTimestamp(ceremony.activatedAt)}. The inaugurated screen stays up, even after a refresh, until it is reset here.`;
  } else if (inaugurated) {
    statusTone = 'warn';
    statusTitle = 'Rehearsal complete — not saved';
    statusDetail =
      'The inaugurated screen is showing as a rehearsal only. Reset it to return to the welcome screen.';
  }

  const [offlineTone, offlineTitle, offlineDetail] =
    OFFLINE_MESSAGES[offline.state] || OFFLINE_MESSAGES.preparing;

  return (
    <div className="organiser">
      <div className="organiser__inner">
        <header className="organiser__header">
          <div>
            <p className="organiser__kicker">Organiser controls</p>
            <h1>{settings.event.projectTitle || 'Inauguration'}</h1>
            <p className="hint">
              For the organising team only. Nothing on this page is shown on the ceremony screen.
            </p>
          </div>
          <button type="button" className="btn btn--primary" onClick={onOpenCeremony}>
            Open ceremony screen
          </button>
        </header>

        {settings.rehearsalMode && (
          <p className="rehearsal-banner" role="status">
            <strong>Rehearsal Mode is ON.</strong> Inaugurations are not saved. Turn it off before
            the official ceremony.
          </p>
        )}

        {!storageAvailable && (
          <p className="notice notice--warn" role="alert">
            This browser is not allowing data to be saved (for example, Private Browsing). Settings
            and the inauguration record will be lost if the page is refreshed or closed.
          </p>
        )}

        {/* ---- Ceremony status ---- */}
        <section className="panel" aria-labelledby="status-heading">
          <h2 id="status-heading">Ceremony</h2>
          <div className={`status status--${statusTone}`} role="status">
            <p className="status__title">{statusTitle}</p>
            <p className="status__detail">{statusDetail}</p>
          </div>

          <div className="button-row">
            <button type="button" className="btn btn--danger" onClick={requestReset} disabled={!inaugurated}>
              {inaugurated && !ceremony.official ? 'Reset rehearsal' : 'Reset to welcome screen'}
            </button>
          </div>
          {resetMessage && (
            <p className={`notice notice--${resetMessage.tone}`} role="status">
              {resetMessage.text}
            </p>
          )}
          <p className="hint">Resetting never changes the event details or images.</p>

          <div className="panel__divider" />

          <Switch
            id="rehearsal-mode"
            checked={settings.rehearsalMode}
            onChange={(event) => onSetOption('rehearsalMode', event.target.checked)}
            label="Rehearsal Mode"
            description="Test the full inauguration animation without saving an official inauguration. A small “Rehearsal” tag appears on the ceremony screen while this is on."
          />
        </section>

        <OperatorLinkPanel />

        {/* ---- Sound ---- */}
        <section className="panel" aria-labelledby="sound-heading">
          <h2 id="sound-heading">Sound</h2>
          <Switch
            id="sound-enabled"
            checked={settings.soundEnabled}
            onChange={(event) => onSetOption('soundEnabled', event.target.checked)}
            label="Ceremony sound"
            description="Plays a brief chime when the button is touched, then speaks the message below. Off by default. Nothing ever plays when the page loads."
          />
          <p className="hint">
            Spoken after the chime:{' '}
            {draft.event.thankYouMessage ? (
              <strong>“{draft.event.thankYouMessage}”</strong>
            ) : (
              'nothing (no message set)'
            )}
            . Edit it under Event details → “Spoken message after the chime”.
            {!isSpeechSupported() && ' This browser has no built-in voice, so only the chime will play.'}
          </p>
          <div className="button-row">
            <button type="button" className="btn" onClick={testSound} disabled={!isSoundSupported()}>
              Test Sound
            </button>
          </div>
          {!isSoundSupported() && (
            <p className="notice notice--warn">This browser cannot generate sound.</p>
          )}
          {soundMessage && (
            <p className={`notice notice--${soundMessage.tone}`} role="status">
              {soundMessage.text}
            </p>
          )}
        </section>

        {/* ---- Display ---- */}
        <section className="panel" aria-labelledby="display-heading">
          <h2 id="display-heading">Display</h2>
          {standalone ? (
            <p className="notice notice--ok">
              Running from the Home Screen — the ceremony screen already fills the display.
            </p>
          ) : fullscreen.supported ? (
            <>
              <div className="button-row">
                <button type="button" className="btn" onClick={fullscreen.toggle}>
                  {fullscreen.active ? 'Exit fullscreen' : 'Enter fullscreen'}
                </button>
              </div>
              <p className="hint">
                Enter fullscreen here, then press “Open ceremony screen”. On an iPad, adding the app
                to the Home Screen gives a cleaner result than Safari’s fullscreen.
              </p>
            </>
          ) : (
            <p className="notice notice--info">
              This browser does not offer a fullscreen control. Add the app to the Home Screen
              instead (steps below).
            </p>
          )}
          {!standalone && (
            <details className="details" open={!fullscreen.supported}>
              <summary>Add to Home Screen on iPad or iPhone (Safari)</summary>
              <ol>
                <li>Open this site in Safari while connected to the network.</li>
                <li>
                  Tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>,
                  then <strong>Add</strong>.
                </li>
                <li>Open the app from its new Home Screen icon. It runs without Safari’s toolbars.</li>
                <li>
                  The Home Screen app keeps its own settings. Open this organiser page inside it
                  (tap the “Organiser” button in the top-left corner of the ceremony screen) to
                  enter the event details and confirm offline readiness there.
                </li>
              </ol>
            </details>
          )}
        </section>

        {/* ---- Event details ---- */}
        <section className="panel" aria-labelledby="details-heading">
          <h2 id="details-heading">Event details</h2>
          <p className="hint">
            Draft wording — please confirm every name, spelling and title. Leave a field empty to
            hide that line. Changes apply after “Save settings”.
          </p>

          {EVENT_FIELD_GROUPS.map((group) => (
            <fieldset className="fieldset" key={group.title}>
              <legend>{group.title}</legend>
              <div className="field-grid">
                {group.fields.map((field) => (
                  <div className="field" key={field.key}>
                    <label htmlFor={`field-${field.key}`}>{field.label}</label>
                    <input
                      id={`field-${field.key}`}
                      type="text"
                      value={draft.event[field.key]}
                      maxLength={field.maxLength}
                      autoComplete="off"
                      onChange={(event) => setField(field.key, event.target.value)}
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          ))}

          <fieldset className="fieldset">
            <legend>Images (optional)</legend>
            <ImageField
              id="logo-upload"
              label="Official logo"
              hint="Shown above the organiser name. A PNG with a transparent background works best. Without a logo, the organiser name is shown as text."
              value={draft.logo}
              error={imageErrors.logo}
              onPick={(file) => pickImage('logo', file)}
              onRemove={() => removeImage('logo')}
            />
            <ImageField
              id="background-upload"
              label="Background image"
              hint="Shown behind the ceremony text under a navy tint so the wording stays readable."
              value={draft.background}
              error={imageErrors.background}
              onPick={(file) => pickImage('background', file)}
              onRemove={() => removeImage('background')}
            />
          </fieldset>

          <div className="save-bar">
            <p className={`save-bar__state${dirty ? ' save-bar__state--dirty' : ''}`} role="status">
              {dirty ? 'Unsaved changes' : 'No unsaved changes'}
            </p>
            <div className="button-row">
              <button type="button" className="btn" onClick={() => setPreview('welcome')}>
                Preview
              </button>
              <button type="button" className="btn btn--primary" onClick={save} disabled={!dirty}>
                Save settings
              </button>
              <button type="button" className="btn btn--quiet" onClick={discard} disabled={!dirty}>
                Discard changes
              </button>
              <button type="button" className="btn btn--quiet" onClick={restoreDefaults}>
                Load defaults
              </button>
            </div>
            {saveMessage && (
              <p className={`notice notice--${saveMessage.tone}`} role="status">
                {saveMessage.text}
              </p>
            )}
          </div>
        </section>

        {/* ---- Offline readiness ---- */}
        <section className="panel" aria-labelledby="offline-heading">
          <h2 id="offline-heading">Offline readiness</h2>
          <div className={`status status--${offlineTone}`} role="status">
            <p className="status__title">{offlineTitle}</p>
            {offlineDetail && <p className="status__detail">{offlineDetail}</p>}
            {offline.state === 'ready' && (
              <p className="status__detail">{offline.total} files verified on this device.</p>
            )}
          </div>
          {offline.updateWaiting && (
            <p className="notice notice--info">
              A newer version of the app has been downloaded. It will only be used after the app is
              fully closed and reopened — nothing changes while this screen is open.
            </p>
          )}
          <div className="button-row">
            <button type="button" className="btn" onClick={recheckOffline}>
              Check again
            </button>
          </div>
          <ul className="hint-list">
            <li>The first visit needs a connection to the hosted site so the app can be stored.</li>
            <li>Offline storage needs the site to be served over HTTPS (or opened on localhost).</li>
            <li>
              To be sure, switch on Airplane Mode before the event and reopen the app as a test.
            </li>
            <li>The app never reloads itself or installs an update during the ceremony.</li>
          </ul>
        </section>

        <footer className="organiser__footer">
          <p>
            <strong>Ceremonial screen only.</strong> This app is not connected to the fountain, its
            pumps, lights or music. The fountain operator starts the real fountain manually when the
            dignitary presses the button; the operator alert only tells them when.
          </p>
          <p>This page is a convenience for organisers. It is not a secure admin area.</p>
        </footer>
      </div>

      {confirmingReset && (
        <ConfirmDialog
          title="Reset the official inauguration?"
          confirmLabel="Yes, reset"
          onConfirm={performReset}
          onCancel={cancelReset}
        >
          <p>
            This clears the saved inauguration recorded on{' '}
            <strong>{formatTimestamp(ceremony.activatedAt)}</strong> and returns the ceremony screen
            to the welcome screen.
          </p>
          <p>Event details and images are kept.</p>
        </ConfirmDialog>
      )}

      {preview && (
        <div className="preview-layer" role="dialog" aria-modal="true" aria-label="Preview">
          {preview === 'welcome' ? (
            <WelcomeScreen event={draft.event} logo={draft.logo} background={draft.background} preview />
          ) : (
            <InauguratedScreen
              event={draft.event}
              logo={draft.logo}
              background={draft.background}
              preview
            />
          )}
          <div className="preview-bar">
            <span className="preview-bar__label">Preview{dirty ? ' · unsaved' : ''}</span>
            <button
              type="button"
              className="btn btn--small"
              aria-pressed={preview === 'welcome'}
              onClick={() => setPreview('welcome')}
            >
              Welcome
            </button>
            <button
              type="button"
              className="btn btn--small"
              aria-pressed={preview === 'inaugurated'}
              onClick={() => setPreview('inaugurated')}
            >
              Inaugurated
            </button>
            <button type="button" className="btn btn--small btn--primary" onClick={closePreview} autoFocus>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
