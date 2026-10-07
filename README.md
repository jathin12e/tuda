# TUDA Amani Kere Musical Fountain — Inauguration Screen

A ceremony web app for the inauguration of the Amani Kere Musical Fountain, designed for an iPad
in landscape. The dignitary touches **INAUGURATE**, the screen counts **3 · 2 · 1**, the curtain opens, and a
"Ceremonially Inaugurated" screen stays up until the organiser resets it.

> **This app does not start the fountain.**
> It is a ceremonial screen only. It is not connected to the fountain, PLC, pumps, lights or music
> system and shows no equipment status. **The fountain operator starts the real fountain manually**
> when the dignitary presses the button. The optional **operator alert** (below) tells the operator
> *when* — it still does not control anything.

React + Vite, plain CSS. No login, external fonts, CDNs or paid services. The ceremony screen itself
needs no backend; the operator alert uses a small Node server included in `server/`.

---

## Quick start

Requires [Node.js](https://nodejs.org) 20.19 or newer.

```bash
npm install
npm run dev -- --host 0.0.0.0     # development server, reachable from other devices on the network
npm run build                     # production build into dist/
npm run preview                   # serve the production build locally (http://localhost:4173)
npm start                         # serve the build WITH the operator alert (http://localhost:8080)
```

| Page | Address | Purpose |
| --- | --- | --- |
| Ceremony screen | `/` | What the dignitary and audience see |
| Organiser controls | `/organiser` (or `/#/organiser`) | Settings, rehearsal, reset, offline check |
| Operator alert | `/operator` | Opens on the fountain operator's phone; alerts them when the button is pressed |

In production the operator has a **separate web app** at its own address
(`https://tuda-operator.intelithon.in`). It contains only the operator screen — no ceremony button
and no organiser controls — with its own name ("Fountain Operator") and green Home Screen icon.
Its source is `operator-app/`; it reuses the operator screen from `src/`. The `/operator` page of
the main app shows the same screen and is what you use with `npm start` on a laptop.

## Before the ceremony — checklist

1. **Confirm the wording.** All names, spellings, titles and the date are *draft content*.
   Check them on `/organiser` (or in `src/config/eventConfig.js`).
2. Host the production build over **HTTPS** (see below).
3. On the iPad: open the site in Safari, **Add to Home Screen**, and open the app from its icon.
4. Inside the Home Screen app, open the organiser page, enter/confirm the details, and wait for
   **"Ready for offline use"**.
5. Turn on **Rehearsal Mode**, run through the inauguration, then **turn Rehearsal Mode off**.
6. Check the organiser page says *"Welcome screen — awaiting inauguration"* and that the ceremony
   screen shows no "Rehearsal" tag.
7. Set the iPad's **Auto-Lock to Never** (Settings → Display & Brightness), raise the brightness,
   and keep it on charge.
8. If using the operator alert: open `/operator` on the operator's phone, check the organiser page
   shows **"1 operator screen connected"**, and press **Send test alert**.
9. Agree a **manual backup cue** with the fountain operator in any case.

## Editing the event details

There are two ways, and they work together:

- **On the device — `/organiser`.** Edit the title, organiser, location, date, dignitary names and
  titles and the acknowledgement text; upload an optional logo and background image; press
  **Preview**, then **Save settings**. Saved values are stored in that browser only.
- **In the code — `src/config/eventConfig.js`.** This single file holds the built-in defaults.
  Edit it and rebuild to change what every device starts with. To ship a logo or background with
  the app, copy the file into `public/` and set `DEFAULT_LOGO_URL` / `DEFAULT_BACKGROUND_URL`.

Values saved on the organiser page take priority over the file. **Load defaults** on the organiser
page brings the file's values back into the form.

If no logo is supplied (or the file fails to load) the organiser name is shown as text. The app
deliberately contains no government logos, seals or portraits.

## Rehearsal and the official inauguration

**Rehearsal Mode** (organiser page → Ceremony):

- Lets you test the whole inauguration, including sound.
- Nothing is saved: a refresh returns to the welcome screen.
- A small "Rehearsal" tag is shown on the ceremony screen so it cannot be mistaken for the real one.
- **Reset rehearsal** on the organiser page returns to the welcome screen.

**Official inauguration** (Rehearsal Mode off):

- One touch activates it; further touches are ignored.
- The inauguration and its timestamp are saved *before* the animation starts, so refreshing the
  page — even mid-animation — shows the completed screen.
- The inaugurated screen stays until someone presses **Reset to welcome screen** on the organiser
  page and confirms. Resetting clears only the inauguration; event details and images are kept.

### Reaching the organiser page on the day

- In a browser: go to `/organiser`.
- In the Home Screen app (no address bar): **press and hold the top-left corner of the ceremony
  screen for two seconds.** The corner is invisible and does nothing on a short touch.

### `/organiser` is not a secure admin area

It is a convenience page with no login. Anyone who knows the address (or the corner gesture) on
that device can change the wording or reset the screen. It only affects the device it is opened on;
there is no server and nothing is shared between devices. Do not rely on it for access control —
keep the iPad supervised.

## Operator alert — telling the operator when to start

When the dignitary presses the button, the operator's phone counts **3 · 2 · 1** in step with the
ceremony screen and then shows a flashing full-screen **"START THE FOUNTAIN NOW"** (with a beeping alarm and vibration where the phone allows it).
The operator starts the fountain by hand as the count reaches zero, so the water rises as the
curtain opens. (The length of the count is `COUNTDOWN_SECONDS` in `src/config/eventConfig.js`.) In testing on one computer the alert arrived in
under a tenth of a second; on a real network expect a fraction of a second.

This needs the signal server, so the app must be run with `npm start` rather than as plain static
files. Two ways to do that:

**A. A laptop at the venue (no internet needed).**

1. Put the laptop, the iPad and the operator's phone on the **same Wi-Fi or mobile hotspot**.
2. On the laptop: `npm run build`, then `npm start`. It prints an address such as
   `http://192.168.1.20:8080`. If Windows asks about the firewall, allow access.
3. iPad: open that address. Operator's phone: open the same address ending in `/operator`.
4. Keep the laptop awake and plugged in. Closing the terminal stops the alert.

**B. An online Node host** (Render, Railway, a VPS, …): build command `npm install && npm run build`,
start command `npm start`. Both devices then need internet at the venue. This is the only option
that gives you the operator alert *and* HTTPS (offline storage, Add to Home Screen caching).

On the day:

- The operator opens `/operator`, taps **"Tap to turn on the sound alert"**, turns the volume up and
  sets the phone's Auto-Lock to Never. The page must stay open and on screen.
- The organiser page → **Operator alert** shows how many operator screens are connected, has a
  **Send test alert** button, and shows whether the operator pressed **Acknowledge**.
- A rehearsal shows the operator an amber **"Button pressed — rehearsal"** screen instead, so a
  practice run is never mistaken for the real order.
- **Reset** on the organiser page returns the operator's screen to standby.

Limits you should know about:

- If the network drops, the alert cannot arrive. The operator's screen turns red and says
  **"No connection"** within about 25 seconds, and reconnects by itself. The ceremony screen keeps
  retrying for about 30 seconds. **Always keep a manual backup cue.**
- The ceremony screen never waits for the operator: the unveiling plays even if the alert fails.
- With option A the site is plain `http://` on the local network, so offline storage is not
  available — but the iPad is loading from the laptop next to it anyway.
- There is no login. Anyone on the same network who knows the address could open these pages or
  send a false alert. Use a private hotspot rather than public Wi-Fi.
- The server keeps the alert state in memory; restarting it returns operator screens to standby.

## Sound

Off by default. When **Ceremony sound** is switched on, a short chime (generated in the browser,
no audio files) plays when the button is touched, and after the chime the device says
**"Thank you, Dr. G. Parameshwara sir"** using its built-in voice. Use **Test Sound** to hear both
and check the volume.

- The spoken message is editable on the organiser page (Event details → "Spoken message after the
  chime") or as `thankYouMessage` in `src/config/eventConfig.js`. Leave it empty for chime only.
- The voice is the device's own text-to-speech, so it sounds different on each device and may
  mispronounce names — **listen to it on the actual iPad** and adjust the spelling if needed.

- Audio only ever starts from a touch, as Safari requires. Nothing plays on page load.
- On an iPad or iPhone, check the volume and that silent mode is off.
- If audio cannot play for any reason the inauguration carries on silently.

## Hosting the production build

`npm run build` produces a static site in `dist/`. Upload that folder to any static host
(Netlify, Cloudflare Pages, Vercel, GitHub Pages with a custom domain, your own web server, …).
**Static hosting does not include the operator alert** — for that, run `npm start` on a laptop or a
Node host (see "Operator alert" above). The organiser page tells you which you have.

- **Serve it over HTTPS.** Offline support (service workers) only works over HTTPS or on `localhost`.
- **Serve it from the root of a domain or subdomain** (e.g. `https://fountain.example.org/`),
  not from a sub-folder.
- **`/organiser` needs a single-page fallback**: the host should return `index.html` for unknown
  paths. A Netlify/Cloudflare `_redirects` file is included. If your host cannot do this, use
  `/#/organiser`, which works everywhere.
- Do not cache `sw.js` for long periods (most hosts handle this correctly by default).

To test on an iPad over the local network without hosting, run
`npm run dev -- --host 0.0.0.0` and open `http://<your-computer-ip>:5173`. Everything works this way
except offline storage, which needs HTTPS and the production build.

## Opening it on an iPad and adding it to the Home Screen

1. Connect the iPad to the internet and open the hosted address in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open the app from its new icon. It runs full screen without Safari's toolbars.
4. Hold the top-left corner for two seconds to open the organiser page.

The Home Screen app has **its own storage, separate from Safari**. Settings saved in Safari do not
carry over, so enter the event details and check offline readiness *inside the Home Screen app*.

The organiser page offers an **Enter fullscreen** button only in browsers that support it. Where it
is not available (for example Safari on iPhone) it shows the Add to Home Screen steps instead; on an
iPad the Home Screen app is the recommended way to present the ceremony.

## Preparing and verifying offline use

After one successful online load, the app is stored on the device and works without a connection.

1. Open the app **while online** (the first load always needs the hosted site).
2. Go to the organiser page → **Offline readiness** and wait for **"Ready for offline use"**.
   This appears only after the app confirms every file is actually stored on the device.
3. Verify it: switch on **Airplane Mode**, close the app completely, and open it again. Run a
   rehearsal while offline.

Notes:

- Offline storage is disabled in the development server. Test it with `npm run build` followed by
  `npm run preview`, or on the hosted site.
- The app never reloads itself or installs an update while it is open. If a new version is
  deployed, it is downloaded in the background and used only after the app has been fully closed
  and reopened. **Avoid deploying changes shortly before the ceremony**; if you must, reopen the
  app afterwards and check readiness again.
- If iOS clears the storage (rare, but possible after weeks without use), simply open the app
  online again.

## How it works

```
src/
  config/eventConfig.js        event wording and defaults — edit this file
  hooks/useCeremonyState.js    state machine: welcome → unveiling → inaugurated
  hooks/useSettings.js         event settings, options and images
  utils/storage.js             safe localStorage access and validation
  utils/sound.js               locally generated chime (Web Audio)
  utils/offline.js             service worker registration and readiness check
  utils/image.js               resizes uploaded images
  utils/operatorLink.js        sends the button-pressed signal to the signal server
  components/
    WelcomeScreen.jsx          welcome screen and the INAUGURATE button
    UnveilingScreen.jsx        golden light, 3 · 2 · 1 countdown and curtain reveal
    InauguratedScreen.jsx      persistent acknowledgement screen
    FountainAnimation.jsx      decorative SVG fountain
    Confetti.jsx               short gold confetti burst (canvas)
    CeremonyParts.jsx          shared pieces: backdrop, logo, organiser name, dignitary
    OrganiserPanel.jsx         the /organiser page
    OperatorScreen.jsx         the /operator alert page
  App.jsx, main.jsx, styles.css
public/
  manifest.webmanifest, sw.js, icons/, _redirects
operator-app/                  the separate operator web app (npm run build:operator → dist-operator/)
server/index.mjs               signal server: serves dist/ and relays the alert (npm start)
scripts/generate-icons.mjs     regenerates the app icons (npm run icons)
```

What is stored in the browser (`localStorage`):

| Key | Contents |
| --- | --- |
| `tuda-ceremony:status` | Official inauguration status and activation timestamp |
| `tuda-ceremony:settings` | Event wording, sound and rehearsal options |
| `tuda-ceremony:logo`, `tuda-ceremony:background` | Uploaded images |

All storage access is guarded. If storage is blocked (for example Private Browsing), full, or holds
invalid data, the app falls back to the built-in defaults and the ceremony still runs; the organiser
page shows a warning that nothing will survive a refresh.

Accessibility and motion: the button works with touch, mouse and keyboard (Enter/Space) and has a
visible focus ring. If the device has **Reduce Motion** switched on, the animations are replaced by
simple fades and the confetti is skipped.
