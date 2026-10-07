import { useEffect, useRef, useState } from 'react';
import { EVENTS_URL, sendSignalOnce } from '../utils/operatorLink.js';
import { playBeep, startAlarm, stopAlarm, unlockAudio } from '../utils/sound.js';

/*
 * Operator screen (/operator). Open it on the fountain operator's phone.
 * It listens to the signal server and shows a full-screen alert the moment the
 * dignitary presses the button. The operator then starts the fountain by hand:
 * this screen controls nothing.
 */

// The server sends a heartbeat every 10 seconds; silence for longer than this
// means the link is down and the operator must rely on the manual cue.
const SILENCE_LIMIT_MS = 25000;

function formatClock(iso) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'medium' });
  } catch {
    return '';
  }
}

function formatElapsed(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
}

export default function OperatorScreen({ eventTitle }) {
  const [link, setLink] = useState('connecting'); // connecting | live | lost
  const [signal, setSignal] = useState(null);
  const [silenced, setSilenced] = useState(0); // seq of the alert the operator has silenced
  const [soundOn, setSoundOn] = useState(false);
  const [testFlash, setTestFlash] = useState(false);
  const [now, setNow] = useState(Date.now());
  const clockOffset = useRef(0);
  const soundOnRef = useRef(false);
  soundOnRef.current = soundOn;

  // Live connection with automatic reconnection and a silence watchdog.
  useEffect(() => {
    let source = null;
    let watchdog = 0;
    let retry = 0;
    let testTimer = 0;
    let closed = false;

    const connect = () => {
      if (closed) return;
      clearTimeout(watchdog);
      if (source) source.close();

      const alive = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => {
          setLink('lost');
          connect();
        }, SILENCE_LIMIT_MS);
      };

      try {
        source = new EventSource(EVENTS_URL);
      } catch {
        setLink('lost');
        retry = setTimeout(connect, 3000);
        return;
      }

      source.addEventListener('state', (event) => {
        try {
          const data = JSON.parse(event.data);
          clockOffset.current = Date.now() - data.serverNow;
          setSignal(data.state);
          setLink('live');
          alive();
        } catch {
          // Ignore a malformed message; the next heartbeat will follow.
        }
      });
      source.addEventListener('test', () => {
        alive();
        setTestFlash(true);
        if (soundOnRef.current) playBeep();
        if (navigator.vibrate) navigator.vibrate(300);
        clearTimeout(testTimer);
        testTimer = setTimeout(() => setTestFlash(false), 5000);
      });
      source.onerror = () => {
        // EventSource retries by itself; show the problem meanwhile.
        setLink((current) => (current === 'live' ? 'lost' : current));
        if (source.readyState === EventSource.CLOSED) {
          clearTimeout(retry);
          retry = setTimeout(connect, 3000);
        }
      };
      alive();
    };

    connect();
    const online = () => connect();
    window.addEventListener('online', online);

    return () => {
      closed = true;
      clearTimeout(watchdog);
      clearTimeout(retry);
      clearTimeout(testTimer);
      window.removeEventListener('online', online);
      if (source) source.close();
    };
  }, []);

  // Keep the phone awake where the browser allows it.
  useEffect(() => {
    let lock = null;
    let released = false;
    const request = async () => {
      try {
        if (!released && navigator.wakeLock && document.visibilityState === 'visible') {
          lock = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Not available; the operator should set Auto-Lock to Never.
      }
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', request);
      if (lock) lock.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const go = Boolean(signal && signal.status === 'go');
  const acknowledged = go && Boolean(signal.acknowledgedAt);
  const alerting = go && !acknowledged && silenced !== signal.seq;

  // Alarm and vibration while an alert is waiting to be acknowledged.
  useEffect(() => {
    if (!alerting) return undefined;
    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500, 200, 900]);
    if (soundOn) startAlarm();
    return () => {
      stopAlarm();
      if (navigator.vibrate) navigator.vibrate(0);
    };
  }, [alerting, soundOn]);

  const enableSound = () => {
    if (unlockAudio()) {
      setSoundOn(true);
      playBeep();
    }
  };

  const acknowledge = () => {
    setSilenced(signal.seq);
    sendSignalOnce({ type: 'ack' });
  };

  const elapsed = go ? formatElapsed(now - clockOffset.current - Date.parse(signal.at)) : '';
  let mode = 'standby';
  if (link !== 'live') mode = 'lost';
  else if (go) mode = signal.rehearsal ? 'rehearsal' : 'go';

  return (
    <main className={`operator operator--${mode}${alerting && link === 'live' ? ' is-alerting' : ''}`}>
      <header className="operator__bar">
        <span className={`operator__link operator__link--${link}`}>
          {link === 'live' ? 'Connected' : link === 'connecting' ? 'Connecting…' : 'No connection'}
        </span>
        <span className="operator__event">{eventTitle}</span>
      </header>

      <div className="operator__body" role="status" aria-live="assertive">
        {mode === 'lost' && (
          <>
            <p className="operator__headline">
              {link === 'connecting' ? 'Connecting…' : 'No connection'}
            </p>
            <p className="operator__detail">
              This screen is not receiving the signal. Watch for the manual cue and keep this page
              open — it reconnects by itself.
            </p>
          </>
        )}

        {mode === 'standby' && (
          <>
            <p className="operator__kicker">Standby</p>
            <p className="operator__headline">Waiting for the button</p>
            <p className="operator__detail">
              This screen will alert you the moment the dignitary presses INAUGURATE. Keep it open
              and in view.
            </p>
          </>
        )}

        {mode === 'go' && (
          <>
            <p className="operator__kicker">Button pressed</p>
            <p className="operator__headline operator__headline--go">Start the fountain now</p>
            <p className="operator__detail">
              Pressed at {formatClock(signal.at)} — {elapsed}
            </p>
          </>
        )}

        {mode === 'rehearsal' && (
          <>
            <p className="operator__kicker">Rehearsal only</p>
            <p className="operator__headline">Button pressed — rehearsal</p>
            <p className="operator__detail">
              This is a practice run, not the official inauguration. Pressed at{' '}
              {formatClock(signal.at)} — {elapsed}
            </p>
          </>
        )}

        {go && link === 'live' && (
          <div className="operator__actions">
            {acknowledged || silenced === signal.seq ? (
              <p className="operator__acknowledged">Acknowledged</p>
            ) : (
              <button type="button" className="operator__button" onClick={acknowledge}>
                Acknowledge
              </button>
            )}
          </div>
        )}
      </div>

      <footer className="operator__footer">
        {testFlash && <p className="operator__test">Test alert received — the link is working.</p>}
        {soundOn ? (
          <p className="operator__note">Sound alert is on. Turn the phone volume up.</p>
        ) : (
          <button type="button" className="operator__button operator__button--quiet" onClick={enableSound}>
            Tap to turn on the sound alert
          </button>
        )}
        <p className="operator__note">
          This screen only alerts you. You start the fountain yourself.
        </p>
      </footer>
    </main>
  );
}
