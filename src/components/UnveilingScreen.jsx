import { useEffect, useRef, useState } from 'react';

/*
 * The unveiling: golden light spreads from the button, settles into a gold
 * curtain, and the curtain parts to reveal the inaugurated screen.
 *
 *   light  0.00s  light expands from the button and covers the screen
 *   hold   1.15s  curtain is closed (the screen underneath is swapped here)
 *   open   2.10s  curtain parts
 *   done   3.20s  overlay is removed
 */
const HOLD_AT = 1150;
const OPEN_AT = 2100;
const DONE_AT = 3200;

export default function UnveilingScreen({ origin, title, onStage, onComplete }) {
  const [stage, setStage] = useState('light');
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
    return () => timers.forEach(clearTimeout);
  }, []);

  const style = origin ? { '--ox': `${origin.x}px`, '--oy': `${origin.y}px` } : undefined;

  return (
    <div className={`unveil unveil--${stage}`} style={style} aria-hidden="true">
      <div className="unveil__curtain unveil__curtain--left" />
      <div className="unveil__curtain unveil__curtain--right" />
      <div className="unveil__light" />
      {title && <p className="unveil__title">{title}</p>}
    </div>
  );
}
