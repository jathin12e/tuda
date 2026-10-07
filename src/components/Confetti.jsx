import { useEffect, useRef, useState } from 'react';

const COLOURS = ['#f6e6b4', '#ecd08a', '#d9b25f', '#c79d48', '#fff7dc'];
const PARTICLES = 110;
const EMIT_MS = 2600; // new pieces appear during this window
const MAX_MS = 8000; // hard stop, whatever happens

/** A short burst of gold confetti on a canvas. Removes itself when finished. */
export default function Confetti() {
  const canvasRef = useRef(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx || reduceMotion) {
      setFinished(true);
      return undefined;
    }

    let width = 0;
    let height = 0;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const pieces = Array.from({ length: PARTICLES }, (_, index) => ({
      born: (index / PARTICLES) * EMIT_MS,
      x: Math.random(),
      y: -20 - Math.random() * 60,
      size: 6 + Math.random() * 7,
      speed: 110 + Math.random() * 150,
      sway: 18 + Math.random() * 34,
      phase: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 9,
      colour: COLOURS[index % COLOURS.length],
    }));

    let frame = 0;
    let startTime = 0;
    const draw = (now) => {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, width, height);

      let visible = 0;
      for (const piece of pieces) {
        const age = (elapsed - piece.born) / 1000;
        if (age < 0) {
          visible++;
          continue;
        }
        const y = piece.y + age * piece.speed + age * age * 26;
        if (y > height + 20) continue;
        visible++;
        const x = piece.x * width + Math.sin(piece.phase + age * 2.2) * piece.sway;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(piece.phase + age * piece.spin);
        ctx.globalAlpha = Math.min(1, Math.max(0, (height + 20 - y) / 160));
        ctx.fillStyle = piece.colour;
        // Squash the height over time so each piece appears to tumble.
        const tumble = piece.size * 0.6 * Math.cos(age * 5 + piece.phase);
        ctx.fillRect(-piece.size / 2, -tumble / 2, piece.size, tumble);
        ctx.restore();
      }

      if (visible === 0 || elapsed > MAX_MS) {
        ctx.clearRect(0, 0, width, height);
        setFinished(true);
        return;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  if (finished) return null;
  return <canvas ref={canvasRef} className="confetti" aria-hidden="true" />;
}
