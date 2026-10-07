import { useEffect, useRef, useState } from 'react';
import { COUNTDOWN_SECONDS } from '../config/eventConfig.js';

/*
 * The unveiling: golden light spreads from the button and becomes a gold
 * curtain showing a 3 · 2 · 1 countdown, then the curtain parts to reveal the
 * inaugurated screen. The fountain operator sees the same countdown on the
 * /operator screen and starts the fountain as it reaches zero.
 *
 *   light  0.0s  light expands from the button and covers the screen
 *   hold   0.5s  curtain is closed (the screen underneath is swapped here)
 *   open   3.0s  countdown ends, curtain parts
 *   done   4.1s  overlay is removed
 */
const HOLD_AT = 500;
const OPEN_AT = COUNTDOWN_SECONDS * 1000;
const DONE_AT = OPEN_AT + 1100;

export default function UnveilingScreen({ origin, title, onStage, onComplete }) {
  const [stage, setStage] = useState('light');
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const callbacks = useRef({ onStage, onComplete });
  callbacks.current = { onStage, onComplete };

  useEffect(() => {
    const advance = (next) => {
      setStage(next);
      callbacks.current.onStage?.(next);
    };
    const timers = [
      setTimeout(() => advance('hold'), HOLD_AT),
      setTimeout(() => advance('open'), OPEN_AT),
      setTimeout(() => callbacks.current.onComplete?.(), DONE_AT),
    ];
    for (let second = 1; second < COUNTDOWN_SECONDS; second++) {
      timers.push(setTimeout(() => setCount(COUNTDOWN_SECONDS - second), second * 1000));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  const style = origin ? { '--ox': `${origin.x}px`, '--oy': `${origin.y}px` } : undefined;

  return (
    <div className={`unveil unveil--${stage}`} style={style} aria-hidden="true">
      <div className="unveil__curtain unveil__curtain--left" />
      <div className="unveil__curtain unveil__curtain--right" />
      <div className="unveil__light" />
      <div className="unveil__centre">
        {title && <p className="unveil__title">{title}</p>}
        {/* The key restarts the pop-in animation for each number. */}
        <p className="unveil__count" key={count}>
          {count}
        </p>
      </div>
    </div>
  );
}
