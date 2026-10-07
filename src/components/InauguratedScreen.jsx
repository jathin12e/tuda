import { fullProjectTitle } from '../config/eventConfig.js';
import Confetti from './Confetti.jsx';
import FountainAnimation from './FountainAnimation.jsx';
import { Backdrop, Guest, Logo, RehearsalBadge } from './CeremonyParts.jsx';

/*
 * The persistent acknowledgement screen.
 *
 *   celebrate  the inauguration happened in this session: play the entrance
 *              animation and confetti. False when restored after a refresh.
 *   active     false while the curtain is still closed over this screen.
 */
export default function InauguratedScreen({
  event,
  logo,
  background,
  celebrate = false,
  active = true,
  rehearsal = false,
  preview = false,
}) {
  const motionClass = !active ? ' is-waiting' : celebrate ? ' is-celebrating' : '';
  const step = (index) => ({ '--i': index });

  return (
    <main className={`ceremony ceremony--inaugurated${motionClass}`}>
      <Backdrop background={background} />
      <FountainAnimation variant="celebration" active={active} />
      {celebrate && active && !preview && <Confetti />}
      {rehearsal && <RehearsalBadge />}

      <div className="ceremony__scroll">
        <div className="ceremony__content">
          <header className="rise" style={step(0)}>
            <Logo logo={logo} name={event.organiserShortName} />
            <h1 className="title title--final">{fullProjectTitle(event)}</h1>
            {event.inauguratedHeading && (
              <p className="declared">
                <span className="declared__rule" aria-hidden="true" />
                <span className="declared__text">{event.inauguratedHeading}</span>
                <span className="declared__rule" aria-hidden="true" />
              </p>
            )}
          </header>

          <section className="guests">
            <Guest
              className="rise"
              style={step(1)}
              label={event.inauguratedByLabel}
              name={event.chiefGuestName}
              title={event.chiefGuestTitle}
            />
            <Guest
              className="rise"
              style={step(2)}
              variant="other"
              label={event.dignitaryIntro}
              name={event.dignitaryName}
              title={event.dignitaryTitle}
            />
            {event.acknowledgement && (
              <p className="ack rise" style={step(3)}>
                {event.acknowledgement}
              </p>
            )}
          </section>

          <footer className="closing rise" style={step(4)}>
            {event.date && <p className="meta meta--date">{event.date}</p>}
            {event.location && <p className="meta">{event.location}</p>}
          </footer>
        </div>
      </div>
    </main>
  );
}
