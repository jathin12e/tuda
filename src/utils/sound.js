/*
 * Ceremony chime, generated locally with the Web Audio API (no audio files).
 *
 * Audio is only ever started from inside a user gesture (the INAUGURATE tap or
 * the organiser's "Test Sound" button), which is what Safari requires. Every
 * call is defensive: if audio is unavailable the function returns false and
 * the ceremony carries on silently.
 */
let context = null;

function getContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!context || context.state === 'closed') context = new AudioContextClass();
  return context;
}

export function isSoundSupported() {
  return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
}

function bell(ac, output, frequency, start, duration, peak) {
  const envelope = ac.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  envelope.connect(output);

  // A fundamental plus two quiet overtones gives a soft bell colour.
  [
    [1, 1],
    [2, 0.28],
    [3.01, 0.1],
  ].forEach(([ratio, level]) => {
    const oscillator = ac.createOscillator();
    const partial = ac.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency * ratio, start);
    partial.gain.setValueAtTime(level, start);
    oscillator.connect(partial);
    partial.connect(envelope);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.1);
  });
}

/* ---- Spoken message (device's built-in voice, works offline) ------------ */

let speechTimer = 0;

function getSpeech() {
  const available =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function';
  return available ? window.speechSynthesis : null;
}

export function isSpeechSupported() {
  return Boolean(getSpeech());
}

export function cancelSpeech() {
  clearTimeout(speechTimer);
  try {
    getSpeech()?.cancel();
  } catch {
    // Nothing to cancel.
  }
}

/**
 * Speaks `text` after `delayMs`. Must be called from inside a user gesture:
 * a silent utterance is spoken straight away so Safari allows the delayed one.
 * Returns true if the message was scheduled.
 */
export function speakAfter(text, delayMs) {
  const message = (text || '').trim();
  const speech = getSpeech();
  if (!message || !speech) return false;
  try {
    cancelSpeech();
    const primer = new SpeechSynthesisUtterance(' ');
    primer.volume = 0;
    speech.speak(primer);

    speechTimer = setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(message);
        const voices = speech.getVoices();
        const voice =
          voices.find((item) => item.lang === 'en-IN') ||
          voices.find((item) => item.lang && item.lang.startsWith('en'));
        if (voice) utterance.voice = voice;
        utterance.lang = voice ? voice.lang : 'en-IN';
        utterance.rate = 0.9;
        speech.speak(utterance);
      } catch {
        // Speech is optional; stay silent.
      }
    }, delayMs);
    return true;
  } catch {
    return false;
  }
}

/** Seconds from the start of the chime until it has rung out enough to speak over. */
export const CHIME_TAIL = 2.3;

/**
 * Plays one rising bell per second of the countdown, then a brighter chime
 * after `revealDelay` seconds (the moment the curtain opens).
 * Returns true if the sound was scheduled.
 */
export function playCeremonyChime({ revealDelay = 3 } = {}) {
  try {
    const ac = getContext();
    if (!ac) return false;
    if (ac.state === 'suspended') {
      const resumed = ac.resume();
      if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {});
    }

    const master = ac.createGain();
    master.gain.value = 0.55;
    master.connect(ac.destination);
    const start = ac.currentTime + 0.04;

    // Countdown: G4, C5, E5 — one bell for each number, spread evenly.
    const beats = [392.0, 523.25, 659.25];
    beats.forEach((frequency, index) => {
      bell(ac, master, frequency, start + (index * revealDelay) / beats.length, 1.2, 0.13);
    });

    // Reveal: C5, E5, G5, C6, E6 arpeggio with a sustained root
    const reveal = start + revealDelay;
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((frequency, index) => {
      bell(ac, master, frequency, reveal + index * 0.1, 2.6, 0.17);
    });
    bell(ac, master, 261.63, reveal, 3, 0.12);

    return true;
  } catch {
    return false;
  }
}

/* ---- Operator alert (used only on the /operator screen) ----------------- */

let alarmTimer = 0;

/** Call from a tap so later alert sounds are allowed. Returns true if audio is available. */
export function unlockAudio() {
  try {
    const ac = getContext();
    if (!ac) return false;
    if (ac.state === 'suspended') {
      const resumed = ac.resume();
      if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

/** A short two-tone beep. */
export function playBeep() {
  try {
    const ac = getContext();
    if (!ac) return false;
    const start = ac.currentTime + 0.02;
    [880, 1174.66].forEach((frequency, index) => {
      const oscillator = ac.createOscillator();
      const gain = ac.createGain();
      const at = start + index * 0.18;
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.3, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      oscillator.connect(gain);
      gain.connect(ac.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.2);
    });
    return true;
  } catch {
    return false;
  }
}

/** Repeats the beep until stopAlarm() is called (or for one minute at most). */
export function startAlarm() {
  stopAlarm();
  let remaining = 85;
  playBeep();
  alarmTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) stopAlarm();
    else playBeep();
  }, 700);
}

export function stopAlarm() {
  clearInterval(alarmTimer);
  alarmTimer = 0;
}
