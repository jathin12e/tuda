import { useCallback, useEffect, useRef, useState } from 'react';
import InauguratedScreen from './components/InauguratedScreen.jsx';
import OperatorScreen from './components/OperatorScreen.jsx';
import OrganiserPanel from './components/OrganiserPanel.jsx';
import UnveilingScreen from './components/UnveilingScreen.jsx';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import { DEFAULT_BACKGROUND_URL, DEFAULT_LOGO_URL } from './config/eventConfig.js';
import { useCeremonyState } from './hooks/useCeremonyState.js';
import { useSettings } from './hooks/useSettings.js';
import { sendSignal } from './utils/operatorLink.js';
import { CHIME_TAIL, cancelSpeech, playCeremonyChime, speakAfter } from './utils/sound.js';

/* ---- Routing: "/" ceremony, "/organiser" controls, "/operator" operator alert.
        Each also works as a hash route, e.g. "/#/organiser". ---- */

function currentRoute() {
  const { hash, pathname } = window.location;
  const path = hash.startsWith('#/') ? hash.slice(1) : pathname;
  const page = path.replace(/\/+$/, '');
  if (page.endsWith('/organiser')) return 'organiser';
  if (page.endsWith('/operator')) return 'operator';
  return 'ceremony';
}

function useRoute() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const sync = () => setRoute(currentRoute());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const navigate = useCallback((next) => {
    try {
      window.history.pushState({}, '', next === 'organiser' ? '/organiser' : '/');
    } catch {
      // History is unavailable; switching the view in memory is enough.
    }
    setRoute(next);
    window.scrollTo(0, 0);
  }, []);

  return [route, navigate];
}

/*
 * Invisible organiser shortcut: press and hold the top-left corner of the
 * ceremony screen for two seconds. Needed when the app runs from the Home
 * Screen, where there is no address bar to type /organiser into.
 */
const HOLD_MS = 2000;

function OrganiserHotspot({ onOpen }) {
  const timer = useRef(0);
  const cancel = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div
      className="organiser-hotspot"
      aria-hidden="true"
      onPointerDown={() => {
        cancel();
        timer.current = setTimeout(onOpen, HOLD_MS);
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}

export default function App() {
  const [route, navigate] = useRoute();
  const { settings, images, storageAvailable, saveEventDetails, setOption } = useSettings();
  const ceremony = useCeremonyState();
  const { phase, official, celebrate, activate, complete, reset } = ceremony;

  // Progress of the unveiling overlay: light → hold → open.
  const [stage, setStage] = useState('light');
  const [origin, setOrigin] = useState(null);

  const logo = images.logo || DEFAULT_LOGO_URL;
  const background = images.background || DEFAULT_BACKGROUND_URL;

  const handleInaugurate = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const activatedAt = activate({ rehearsal: settings.rehearsalMode });
    if (!activatedAt) return;
    // Alert the fountain operator's screen, if a signal server is running.
    sendSignal({ type: 'go', rehearsal: settings.rehearsalMode, at: activatedAt });
    setStage('light');
    setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    // Started inside the tap itself, as Safari requires. Failure is silent.
    if (settings.soundEnabled) {
      const revealDelay = 2.1;
      playCeremonyChime({ revealDelay });
      speakAfter(settings.event.thankYouMessage, (revealDelay + CHIME_TAIL) * 1000);
    }
  };

  const handleReset = useCallback(() => {
    const cleared = reset();
    sendSignal({ type: 'standby' });
    return cleared;
  }, [reset]);

  const handleSetOption = (key, value) => {
    setOption(key, value);
    // Leaving rehearsal mode also clears a rehearsal that is still on screen.
    if (key === 'rehearsalMode' && !value && phase !== 'welcome' && !official) handleReset();
  };

  // If the organiser page is opened mid-animation, finish the unveiling.
  useEffect(() => {
    if (route === 'organiser' && phase === 'unveiling') complete();
  }, [route, phase, complete]);

  // A reset must not leave a spoken message waiting to play.
  useEffect(() => {
    if (phase === 'welcome') cancelSpeech();
  }, [phase]);

  // A rehearsal that ends by refreshing the ceremony screen (rather than by the
  // organiser's reset) must not leave its alert on the operator's screen.
  useEffect(() => {
    if (route === 'ceremony' && phase === 'welcome') {
      sendSignal({ type: 'standby', onlyRehearsal: true });
    }
  }, [route, phase]);

  const openOrganiser = useCallback(() => navigate('organiser'), [navigate]);
  const openCeremony = useCallback(() => navigate('ceremony'), [navigate]);

  if (route === 'operator') {
    return <OperatorScreen eventTitle={settings.event.projectTitle} />;
  }

  if (route === 'organiser') {
    return (
      <OrganiserPanel
        settings={settings}
        images={images}
        storageAvailable={storageAvailable}
        ceremony={{ ...ceremony, reset: handleReset }}
        onSaveEvent={saveEventDetails}
        onSetOption={handleSetOption}
        onOpenCeremony={openCeremony}
      />
    );
  }

  const unveiling = phase === 'unveiling';
  const showFinal = phase === 'inaugurated' || (unveiling && stage !== 'light');

  return (
    <>
      {showFinal ? (
        <InauguratedScreen
          event={settings.event}
          logo={logo}
          background={background}
          celebrate={celebrate}
          active={phase === 'inaugurated' || stage === 'open'}
          rehearsal={!official}
        />
      ) : (
        <WelcomeScreen
          event={settings.event}
          logo={logo}
          background={background}
          onInaugurate={handleInaugurate}
          disabled={phase !== 'welcome'}
          rehearsal={settings.rehearsalMode}
        />
      )}

      {unveiling && (
        <UnveilingScreen
          origin={origin}
          title={settings.event.projectTitle}
          onStage={setStage}
          onComplete={complete}
        />
      )}

      {!unveiling && <OrganiserHotspot onOpen={openOrganiser} />}
    </>
  );
}
