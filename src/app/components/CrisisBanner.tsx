import { crisisCopy, type CrisisLanguage } from "../lib/crisisCopy";

// The crisis/emergency steps + notice + find-help content - shared by the
// standalone /emergency page and the banner embedded at the top of
// /results when a completed check-in itself triggers the crisis signal.
// Deliberately excludes the eyebrow/title/lede heading: each caller renders
// its own, at the heading level appropriate for that page (an h1 on the
// standalone page; an h2 when embedded above the rest of /results, which
// already has its own h1).
export default function CrisisBanner({ language }: { language: CrisisLanguage }) {
  const text = crisisCopy[language];
  return (
    <>
      <section className="emergency-steps">
        <p className="card-kicker">{text.stepsTitle}</p>
        <ol>{text.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      </section>
      <div className="crisis-card emergency-notice">{text.notDiagnosis}</div>
      <section className="therapist-contact">
        <div>
          <p className="card-kicker">{text.findHelp}</p>
          <p>{text.findHelpBody}</p>
        </div>
      </section>
    </>
  );
}
