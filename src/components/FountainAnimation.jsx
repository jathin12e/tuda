import { useEffect, useRef } from 'react';

/*
 * Decorative musical fountain: a small water-particle simulation on a canvas.
 * Each nozzle throws droplets that rise, slow, break up and fall back under
 * gravity, lit from below like a real fountain at night. The jets are tallest
 * at the sides and low in the centre so they frame the ceremony text.
 *
 *   variant="ambient"      quiet display for the welcome screen
 *   variant="celebration"  fuller, brighter display for the inaugurated screen
 *   active={false}         nozzles off (used while the curtain is still closed)
 */

// Light colours (r,g,b): warm gold, white, soft aqua.
const COLOURS = ['255,214,140', '240,246,255', '130,205,255'];

// offset: distance from centre as a fraction of the width; height: relative jet
// height; lean: degrees from vertical (positive leans away from the centre).
const NOZZLES = [
  { offset: 0, height: 0.26, lean: 0, colour: 1 },
  { offset: 0.07, height: 0.2, lean: 0, colour: 2 },
  { offset: 0.14, height: 0.32, lean: 0, colour: 0 },
  { offset: 0.22, height: 0.5, lean: 0, colour: 2 },
  { offset: 0.3, height: 0.74, lean: 0, colour: 0 },
  { offset: 0.38, height: 1, lean: 0, colour: 1 },
  { offset: 0.455, height: 0.7, lean: 0, colour: 0 },
  { offset: 0.38, height: 0.56, lean: -15, colour: 2 },
  { offset: 0.3, height: 0.4, lean: -22, colour: 1 },
  { offset: 0.455, height: 0.46, lean: 12, colour: 2 },
];

const SETTINGS = {
  ambient: { particles: 700, tempo: 0.55, strength: 0.82 },
  celebration: { particles: 1200, tempo: 1, strength: 1 },
};

const RISE_TIME = 0.9; // seconds for the tallest jet to reach its peak
// The stream is stroked three times: [line width, opacity], widest first.
const STREAM_LAYERS = [
  [11, 0.1],
  [5, 0.22],
  [1.8, 0.7],
];
const MAX_DPR = 1.5;

function buildJets() {
  const jets = [];
  NOZZLES.forEach((nozzle, index) => {
    const sides = nozzle.offset === 0 ? [1] : [-1, 1];
    sides.forEach((side) => {
      jets.push({
        offset: side * nozzle.offset,
        height: nozzle.height,
        lean: (side * nozzle.lean * Math.PI) / 180,
        colour: nozzle.colour,
        phase: index * 1.37,
        speed: 0.9 + (index % 4) * 0.23,
        power: 0,
        pending: 0,
      });
    });
  });
  return jets;
}

function makeGlow(rgb) {
  const sprite = document.createElement('canvas');
  sprite.width = 64;
  sprite.height = 64;
  const ctx = sprite.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, `rgba(${rgb},0.9)`);
  gradient.addColorStop(0.4, `rgba(${rgb},0.32)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return sprite;
}

// A repeating wave twice the width of the drawing, so it can scroll seamlessly.
function wavePath(y, amplitude) {
  let d = `M0 ${y}`;
  for (let x = 0; x < 2400; x += 300) d += `q75 ${-amplitude} 150 0t150 0`;
  return `${d}V60H0Z`;
}

const WAVE_BACK = wavePath(14, 6);
const WAVE_FRONT = wavePath(27, 5);

export default function FountainAnimation({ variant = 'ambient', active = true }) {
  const canvasRef = useRef(null);
  const waterRef = useRef(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return undefined;

    const { particles: capacity, tempo, strength } = SETTINGS[variant] || SETTINGS.ambient;
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const jets = buildJets();
    const sprites = COLOURS.map(makeGlow);
    const totalWeight = jets.reduce((sum, jet) => sum + jet.height, 0);

    // Particle pool: position, velocity and colour index.
    const px = new Float32Array(capacity);
    const py = new Float32Array(capacity);
    const vx = new Float32Array(capacity);
    const vy = new Float32Array(capacity);
    const tint = new Uint8Array(capacity);
    let count = 0;

    let width = 0;
    let height = 0;
    let baseY = 0; // water line
    let reach = 0; // pixel height of a full-strength jet
    let gravity = 0;
    let ramp = 0; // 0 → 1 as the nozzles open
    let clock = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const water = waterRef.current ? waterRef.current.clientHeight : 30;
      baseY = height - water * 0.6;
      // Limited by width as well, so jets stay beside the text on narrow screens.
      reach = Math.min(baseY * 0.8, width * 0.42);
      gravity = (2 * reach) / (RISE_TIME * RISE_TIME);
    };

    const simulate = (dt) => {
      clock += dt;
      const target = activeRef.current ? 1 : 0;
      ramp += Math.sign(target - ramp) * Math.min(Math.abs(target - ramp), dt / 1.6);

      jets.forEach((jet, index) => {
        // Each nozzle swells and dips on its own rhythm, with a slower wave
        // travelling across the whole line.
        const own = 0.62 + 0.38 * Math.sin(clock * jet.speed * tempo + jet.phase);
        const sweep = 0.86 + 0.14 * Math.sin(clock * 0.8 * tempo - index * 0.7);
        jet.power = ramp * strength * own * sweep;
        if (jet.power < 0.04) return;

        const launch = Math.sqrt(2 * gravity * reach * jet.height * jet.power);
        const flight = (2 * launch) / gravity;
        jet.pending += ((capacity * jet.height) / totalWeight / flight) * dt;
        while (jet.pending >= 1) {
          jet.pending -= 1;
          if (count >= capacity) continue;
          // Uneven speed and direction give the jet its ragged, misty crown.
          const speed = launch * (0.84 + Math.random() * 0.17);
          const angle = jet.lean + (Math.random() - 0.5) * 0.11;
          px[count] = width * (0.5 + jet.offset) + (Math.random() - 0.5) * 3;
          py[count] = baseY;
          vx[count] = speed * Math.sin(angle);
          vy[count] = -speed * Math.cos(angle);
          tint[count] = jet.colour;
          count++;
        }
      });

      for (let i = count - 1; i >= 0; i--) {
        vy[i] += gravity * dt;
        px[i] += vx[i] * dt;
        py[i] += vy[i] * dt;
        if (py[i] > baseY) {
          // Fell back into the water: recycle by moving the last particle here.
          count--;
          px[i] = px[count];
          py[i] = py[count];
          vx[i] = vx[count];
          vy[i] = vy[count];
          tint[i] = tint[count];
        }
      }
    };

    // Traces the solid stream of one jet: straight up for a vertical nozzle,
    // a full arc for a leaning one.
    const traceStream = (jet, x) => {
      const launch = Math.sqrt(2 * gravity * reach * jet.height * jet.power) * 0.965;
      const ux = launch * Math.sin(jet.lean);
      const uy = -launch * Math.cos(jet.lean);
      const end = jet.lean === 0 ? -uy / gravity : (-2 * uy) / gravity;
      const sway = Math.sin(clock * 2.6 + jet.phase) * reach * jet.height * 0.012;
      ctx.moveTo(x, baseY);
      for (let step = 1; step <= 10; step++) {
        const t = (end * step) / 10;
        const drift = jet.lean === 0 ? sway * (step / 10) ** 2 : 0;
        ctx.lineTo(x + ux * t + drift, baseY + uy * t + 0.5 * gravity * t * t);
      }
      return sway;
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const jet of jets) {
        if (jet.power < 0.04) continue;
        const x = width * (0.5 + jet.offset);
        const sprite = sprites[jet.colour];
        const column = reach * jet.height * jet.power;

        // Light pooled on the water at the foot of the jet.
        const pool = 70 + column * 0.3;
        ctx.globalAlpha = 0.6 * Math.min(1, jet.power * 1.4);
        ctx.drawImage(sprite, x - pool / 2, baseY - pool * 0.15, pool, pool * 0.3);

        // The stream itself: a soft lit body with a bright core.
        ctx.strokeStyle = `rgb(${COLOURS[jet.colour]})`;
        let sway = 0;
        for (const [lineWidth, alpha] of STREAM_LAYERS) {
          ctx.beginPath();
          sway = traceStream(jet, x);
          ctx.lineWidth = lineWidth * (0.7 + column / 420);
          ctx.globalAlpha = alpha;
          ctx.stroke();
        }

        // The crown, where a vertical jet stalls and breaks into spray.
        if (jet.lean === 0) {
          const crown = 18 + column * 0.2;
          ctx.globalAlpha = 0.5;
          ctx.drawImage(sprite, x + sway - crown / 2, baseY - column - crown * 0.45, crown, crown);
        }
      }

      // Spray: soft droplets that swell into mist as they fall.
      for (let i = 0; i < count; i++) {
        const falling = vy[i] > 0;
        const size = falling ? Math.min(13, 5 + vy[i] * 0.014) : 4;
        ctx.globalAlpha = falling ? 0.3 : 0.2;
        ctx.drawImage(sprites[tint[i]], px[i] - size / 2, py[i] - size / 2, size, size * 1.5);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    // A settled still image, used when the device asks for reduced motion.
    const drawStill = () => {
      count = 0;
      ramp = activeRef.current ? 1 : 0;
      for (let i = 0; i < 150; i++) simulate(1 / 60);
      draw();
    };

    let frame = 0;
    let previous = 0;
    const tick = (now) => {
      // Clamp the step so a paused tab does not produce one huge jump.
      const dt = previous ? Math.min((now - previous) / 1000, 1 / 30) : 1 / 60;
      previous = now;
      simulate(dt);
      draw();
      frame = requestAnimationFrame(tick);
    };

    const onResize = () => {
      resize();
      if (reduceMotion) drawStill();
    };

    resize();
    window.addEventListener('resize', onResize);
    if (reduceMotion) drawStill();
    else frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, [variant]);

  // In reduced-motion mode nothing is animating, so redraw when the nozzles open.
  useEffect(() => {
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      window.dispatchEvent(new Event('resize'));
    }
  }, [active]);

  return (
    <div className={`fountain fountain--${variant}`} aria-hidden="true">
      <canvas ref={canvasRef} className="fountain__canvas" />
      <svg
        ref={waterRef}
        className="fountain__water"
        viewBox="0 0 1200 60"
        preserveAspectRatio="none"
        focusable="false"
      >
        <path className="fountain__wave fountain__wave--back" d={WAVE_BACK} />
        <path className="fountain__wave fountain__wave--front" d={WAVE_FRONT} />
      </svg>
    </div>
  );
}
