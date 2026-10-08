import FountainAnimation from './FountainAnimation.jsx';
import { Backdrop, Brand, Guest, RehearsalBadge } from './CeremonyParts.jsx';

export default function WelcomeScreen({
  event,
  logo,
  background,
  onInaugurate,
  disabled = false,
  rehearsal = false,
  preview = false,
}) {
  return (
    <main className={`ceremony ceremony--welcome${disabled ? ' is-leaving' : ''}`}>
      <Backdrop background={background} />
      <FountainAnimation variant="ambient" />
      {rehearsal && <RehearsalBadge />}

      <div className="ceremony__scroll">
        <div className="ceremony__content">
          <Brand event={event} logo={logo} />

          <section className="hero">
            {event.welcomeLine && <p className="eyebrow">{event.welcomeLine}</p>}
            <h1 className="title">{event.projectTitle}</h1>
            {event.location && <p className="meta">{event.location}</p>}
            {event.date && <p className="meta meta--date">{event.date}</p>}
          </section>

          <section className="guests">
            <Guest
              label={event.chiefGuestIntro}
              name={event.chiefGuestName}
              title={event.chiefGuestTitle}
            />
            <Guest
              variant="other"
              label={event.dignitaryIntro}
              name={event.dignitaryName}
              title={event.dignitaryTitle}
            />
            {event.acknowledgement && <p className="ack">{event.acknowledgement}</p>}
          </section>

          <div className="action">
            <button
              type="button"
              className="inaugurate-btn"
              onClick={preview ? undefined : onInaugurate}
              disabled={disabled}
              tabIndex={preview ? -1 : undefined}
            >
              <span className="inaugurate-btn__label">{event.buttonLabel || 'SWITCH ON'}</span>
            </button>
            {event.buttonHint && <p className="action__hint">{event.buttonHint}</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
