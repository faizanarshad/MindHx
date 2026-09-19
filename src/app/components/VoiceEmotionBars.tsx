// Renders the heuristic voice-tone breakdown returned by /analyze-voice
// (and echoed back in /risk-assess's components.voice.emotion) as a set of
// labeled bars. Backend: backend/main.py's _voice_emotion_scores - a coarse
// rule-based reading of pause ratio, loudness variability, and speaking
// rate, not a trained emotion classifier. Keep the disclaimer visible
// wherever this renders.

export type VoiceEmotion = {
  calm: number;
  stress: number;
  anger: number;
  fatigue: number;
  depression_indicator: number;
};

const EMOTION_META: { key: keyof VoiceEmotion; label: string; color: string }[] = [
  { key: "calm", label: "Calm", color: "teal" },
  { key: "stress", label: "Stress", color: "orange" },
  { key: "anger", label: "Anger", color: "red" },
  { key: "fatigue", label: "Fatigue", color: "blue" },
  { key: "depression_indicator", label: "Depression indicator", color: "navy" },
];

export default function VoiceEmotionBars({ emotion, title }: { emotion: VoiceEmotion; title?: string }) {
  return (
    <div className="emotion-bars">
      {title && <p className="emotion-bars-title">{title}</p>}
      {EMOTION_META.map(({ key, label, color }) => (
        <div className="emotion-row" key={key}>
          <span className="emotion-label">{label}</span>
          <span className="emotion-track"><i className={`emotion-fill emotion-fill-${color}`} style={{ width: `${Math.round(emotion[key] * 100)}%` }} /></span>
          <span className="emotion-share">{Math.round(emotion[key] * 100)}%</span>
        </div>
      ))}
      <p className="emotion-note">A heuristic reading of pace, pauses, and loudness from your voice - not a trained emotion classifier or a diagnosis.</p>
    </div>
  );
}
