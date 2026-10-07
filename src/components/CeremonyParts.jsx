import { useState } from 'react';

/** Tracks whether an optional image actually loads, so a bad file is ignored. */
function useImageOk(src) {
  const [failedSrc, setFailedSrc] = useState(null);
  return [Boolean(src) && failedSrc !== src, () => setFailedSrc(src)];
}

/** Navy backdrop with an optional organiser-supplied background image. */
export function Backdrop({ background }) {
  const [showImage, onError] = useImageOk(background);
  return (
    <div className={`backdrop${showImage ? ' backdrop--image' : ''}`} aria-hidden="true">
      {showImage && (
        <img className="backdrop__image" src={background} alt="" draggable="false" onError={onError} />
      )}
      <div className="backdrop__shade" />
      <div className="backdrop__glow" />
    </div>
  );
}

/** Optional official logo. Renders nothing if no logo is supplied or it fails to load. */
export function Logo({ logo, name }) {
  const [showLogo, onError] = useImageOk(logo);
  if (!showLogo) return null;
  return (
    <img
      className="brand__logo"
      src={logo}
      alt={name ? `${name} logo` : 'Organiser logo'}
      draggable="false"
      onError={onError}
    />
  );
}

/** Organiser name; a clean text treatment that also works without a logo. */
export function Brand({ event, logo }) {
  return (
    <header className="brand">
      <Logo logo={logo} name={event.organiserShortName} />
      {event.organiserShortName && (
        <p className="brand__mark">
          <span className="brand__rule" aria-hidden="true" />
          <span className="brand__name">{event.organiserShortName}</span>
          <span className="brand__rule" aria-hidden="true" />
        </p>
      )}
      {event.organiserFullName && <p className="brand__full">{event.organiserFullName}</p>}
    </header>
  );
}

export function Guest({ label, name, title, variant = 'chief', className = '', style }) {
  if (!name && !title) return null;
  return (
    <div className={`guest guest--${variant} ${className}`.trim()} style={style}>
      {label && <p className="label">{label}</p>}
      {name && <p className="guest__name">{name}</p>}
      {title && <p className="guest__title">{title}</p>}
    </div>
  );
}

export function RehearsalBadge() {
  return <p className="rehearsal-badge">Rehearsal</p>;
}
