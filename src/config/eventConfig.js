/*
 * EVENT DETAILS — the single place to edit the ceremony wording.
 *
 * Everything below is DRAFT content. Please confirm every name, spelling,
 * title and date with the organiser before the ceremony.
 *
 * These are the built-in defaults. Anything saved on the /organiser page is
 * stored on that device and takes priority over the values here.
 */
export const defaultEventConfig = {
  // Organiser
  organiserShortName: 'TUDA',
  organiserFullName: 'Tumkuru Urban Development Authority',

  // Event
  welcomeLine: 'Welcome to the Inauguration',
  projectTitle: 'Amani Kere Musical Fountain',
  location: 'Amani Kere Lake, Tumkuru',
  date: '11 October 2026',

  // Chief guest
  chiefGuestIntro: 'To be inaugurated by',
  chiefGuestName: 'Dr. G. Parameshwara',
  chiefGuestTitle: 'Hon’ble Deputy Chief Minister, Karnataka',

  // Other dignitary
  dignitaryIntro: 'In the presence of',
  dignitaryName: 'Shubha Kalyan',
  dignitaryTitle: 'District Collector',

  // Acknowledgement
  acknowledgement: 'With the TUDA Team',

  // Welcome screen button
  buttonLabel: 'INAUGURATE',
  buttonHint: 'Touch to unveil',

  // Spoken aloud by the device after the chime (only when Ceremony sound is on).
  // Leave empty for no spoken message.
  thankYouMessage: 'Thank you, Dr. G. Parameshwara sir',

  // Inaugurated screen
  inauguratedHeading: 'Ceremonially Inaugurated',
  inauguratedByLabel: 'Inaugurated by',
};

/*
 * Optional images shipped with the app. To use them, copy the file into the
 * `public/` folder and put its path here, e.g. '/tuda-logo.png'.
 * Images uploaded on the /organiser page take priority. If a file is missing
 * or fails to load, the app falls back to the text treatment.
 */
export const DEFAULT_LOGO_URL = '';
export const DEFAULT_BACKGROUND_URL = '';

export const defaultOptions = {
  soundEnabled: false,
  rehearsalMode: false,
};

/* Form layout for the organiser page (also the list of valid setting keys). */
export const EVENT_FIELD_GROUPS = [
  {
    title: 'Organiser',
    fields: [
      { key: 'organiserShortName', label: 'Organiser short name', maxLength: 24 },
      { key: 'organiserFullName', label: 'Organiser full name', maxLength: 80 },
    ],
  },
  {
    title: 'Event',
    fields: [
      { key: 'welcomeLine', label: 'Welcome line', maxLength: 80 },
      { key: 'projectTitle', label: 'Event title', maxLength: 80 },
      { key: 'location', label: 'Location', maxLength: 80 },
      { key: 'date', label: 'Date', maxLength: 40 },
    ],
  },
  {
    title: 'Chief guest',
    fields: [
      { key: 'chiefGuestIntro', label: 'Line before the ceremony', maxLength: 60 },
      { key: 'inauguratedByLabel', label: 'Line after the ceremony', maxLength: 60 },
      { key: 'chiefGuestName', label: 'Name', maxLength: 80 },
      { key: 'chiefGuestTitle', label: 'Designation', maxLength: 120 },
    ],
  },
  {
    title: 'Other dignitary',
    fields: [
      { key: 'dignitaryIntro', label: 'Introductory line', maxLength: 60 },
      { key: 'dignitaryName', label: 'Name', maxLength: 80 },
      { key: 'dignitaryTitle', label: 'Designation', maxLength: 120 },
    ],
  },
  {
    title: 'Acknowledgement and wording',
    fields: [
      { key: 'acknowledgement', label: 'Acknowledgement text', maxLength: 80 },
      { key: 'inauguratedHeading', label: 'Heading after the ceremony', maxLength: 60 },
      { key: 'buttonLabel', label: 'Button label', maxLength: 24 },
      { key: 'buttonHint', label: 'Instruction under the button', maxLength: 60 },
      { key: 'thankYouMessage', label: 'Spoken message after the chime', maxLength: 120 },
    ],
  },
];

const EVENT_FIELDS = EVENT_FIELD_GROUPS.flatMap((group) => group.fields);

/**
 * Returns a complete, safe event configuration. Unknown keys are dropped, and
 * any value that is missing or not a sensible string falls back to the default.
 * An empty string is allowed: that line is simply not shown.
 */
export function sanitizeEventConfig(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const clean = {};
  for (const { key, maxLength } of EVENT_FIELDS) {
    const value = source[key];
    clean[key] =
      typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
        : defaultEventConfig[key];
  }
  return clean;
}

export function sanitizeOptions(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    soundEnabled:
      typeof source.soundEnabled === 'boolean' ? source.soundEnabled : defaultOptions.soundEnabled,
    rehearsalMode:
      typeof source.rehearsalMode === 'boolean' ? source.rehearsalMode : defaultOptions.rehearsalMode,
  };
}

/** Title used once the ceremony is complete, e.g. "TUDA Amani Kere Musical Fountain". */
export function fullProjectTitle(event) {
  return [event.organiserShortName, event.projectTitle].filter(Boolean).join(' ');
}
