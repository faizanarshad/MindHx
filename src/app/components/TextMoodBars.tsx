// Renders the linguistic anxiety/stress/depression breakdown returned by
// /analyze-text (and echoed back in /risk-assess's components.text) as
// labeled bars - a second, independent read of the same free text beyond
// its single positive/neutral/negative sentiment label. Backend:
// backend/main.py's _linguistic_indicators - a lexicon-and-ratio heuristic
// informed by published psycholinguistic markers (first-person-singular
// density, absolutist language), not a trained classifier or a diagnosis.
// Keep the disclaimer visible wherever this renders.

export type TextMoodScores = {
  anxiety_level: number;
  stress_level: number;
  depression_indicator: number;
};

const MOOD_META: { key: keyof TextMoodScores; label: string; color: string }[] = [
  { key: "anxiety_level", label: "Anxiety", color: "orange" },
  { key: "stress_level", label: "Stress", color: "red" },
  { key: "depression_indicator", label: "Depression indicator", color: "navy" },
];

export default function TextMoodBars({ scores, title }: { scores: TextMoodScores; title?: string }) {
  return (
    <div className="emotion-bars">
      {title && <p className="emotion-bars-title">{title}</p>}
      {MOOD_META.map(({ key, label, color }) => (
        <div className="emotion-row" key={key}>
          <span className="emotion-label">{label}</span>
          <span className="emotion-track"><i className={`emotion-fill emotion-fill-${color}`} style={{ width: `${Math.round(scores[key] * 100)}%` }} /></span>
          <span className="emotion-share">{Math.round(scores[key] * 100)}%</span>
        </div>
      ))}
      <p className="emotion-note">A heuristic reading of word choice (worry/pressure/absolutist language, self-focus) - not a trained classifier or a diagnosis.</p>
    </div>
  );
}
