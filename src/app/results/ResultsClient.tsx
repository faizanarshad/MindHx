"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "../components/SiteHeader";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import { DoodleLeaf, DoodleSpeechBubble, DoodleSun } from "../components/Doodles";
import SiteFooter from "../components/SiteFooter";
import VoiceEmotionBars, { type VoiceEmotion } from "../components/VoiceEmotionBars";
import TextMoodBars from "../components/TextMoodBars";

type Result = {
  risk_score: number;
  band: string;
  routing_decision: string;
  explanation: string[];
  themes?: string[];
  components?: {
    phq9: { score: number; band: string };
    gad7: { score: number; band: string };
    k10: { score: number; band: string };
    text: { sentiment: string; signal: number; anxiety_level?: number | null; stress_level?: number | null; depression_indicator?: number | null };
    voice: { available: boolean; signal: number | null; note: string; emotion?: VoiceEmotion | null };
    attribution?: {
      method: string;
      note: string;
      total: number;
      contributions: { name: string; label: string; modality: string; signal: number; weight: number; contribution: number; share_pct: number }[];
    };
  };
  support_plan?: {
    title: string;
    next_action: string;
    professional_contact?: { recommended: boolean; action: string; what_to_say: string };
    strategies?: { name: string; steps: string }[];
    meditation?: { name: string; steps: string }[];
    support_groups?: { name: string; description: string }[];
    resources?: { name: string; description: string }[];
  };
};

export default function ResultsClient() {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("mindhx:last-result");
    if (stored) {
      startTransition(() => setResult(JSON.parse(stored) as Result));
    }
  }, []);

  if (!result) {
    return <><main className="results-page empty-results"><p className="eyebrow">MINDHX / RESULTS</p><h1>Your check-in is not ready yet.</h1><p>Complete the private assessment first, then return here to review your signals.</p><button className="result-primary" onClick={() => router.push("/")}>Back to check-in <span>→</span></button></main><SiteFooter /></>;
  }

  const score = Math.round(result.risk_score * 100);
  const components = result.components;
  const contact = result.support_plan?.professional_contact;

  return (
    <>
    <main className="results-page">
      <DoodleSpeechBubble className="doodle doodle-blue doodle-float" style={{ top: "90px", left: "3%" }} />
      <DoodleSun className="doodle doodle-orange doodle-float-slow" style={{ top: "60px", right: "3%" }} />
      <DoodleLeaf className="doodle doodle-teal doodle-sway" style={{ top: "50%", left: "1%", width: "26px", height: "auto" }} />
      <SiteHeader right={<span className="results-private"><i /> Private session result</span>} backLabel="Back to check-in" />
      <NatureBanner {...naturePhotos.mountainRange} caption="A clearer picture, from higher ground." priority />
      <section className="results-hero"><div><p className="eyebrow">YOUR MINDHX CHECK-IN</p><h1>A clearer picture<br /><em>to take forward.</em></h1><p className="results-lede">These signals are a starting point for a conversation, not a diagnosis. You remain in control of what happens next.</p></div><div className="result-score-card"><p className="card-kicker">COMBINED SIGNAL</p><div className="result-score-ring"><strong>{score}</strong><span>/ 100</span></div><b className={`result-band ${result.band}`}>{result.band.replaceAll("_", " ")}</b><small>{result.routing_decision.replaceAll("_", " ")}</small></div></section>

      <section className="result-section"><div className="result-section-heading"><p className="eyebrow">01 / THE SIGNALS</p><h2>What contributed to this picture</h2><p>Each measure is shown separately so the combined estimate stays explainable.</p></div><div className="result-signal-grid">
        <Signal name="PHQ-9" score={components?.phq9.score ?? 0} max={27} band={components?.phq9.band ?? "not available"} color="orange" />
        <Signal name="GAD-7" score={components?.gad7.score ?? 0} max={21} band={components?.gad7.band ?? "not available"} color="blue" />
        <Signal name="K10" score={components?.k10.score ?? 0} max={50} band={components?.k10.band ?? "not available"} color="green" />
        <div className="result-signal-card text-result"><span className="result-signal-icon">Aa</span><div><b>WORDS</b><h3>{components?.text.sentiment ?? "not available"}</h3><p>{components?.text.signal ? `${Math.round(components.text.signal * 100)}% text signal` : "No text signal"}</p></div></div>
        <div className="result-signal-card voice-result"><span className="result-signal-icon">◉</span><div><b>VOICE</b><h3>{components?.voice.available ? `${Math.round((components.voice.signal ?? 0) * 100)}% signal` : "Not available"}</h3><p>{components?.voice.note ?? "No acoustic features returned."}</p></div></div>
      </div>{components?.text.anxiety_level != null && components.text.stress_level != null && components.text.depression_indicator != null && <TextMoodBars scores={{ anxiety_level: components.text.anxiety_level, stress_level: components.text.stress_level, depression_indicator: components.text.depression_indicator }} title="Word-choice breakdown" />}{components?.voice.emotion && <VoiceEmotionBars emotion={components.voice.emotion} title="Voice tone breakdown" />}{components?.attribution && <><div className="attribution-list">{components.attribution.contributions.map((item) => <div className="attribution-row" key={item.name}><span className="attribution-label">{item.label}<small>{item.modality}</small></span><span className="attribution-track"><i className="attribution-fill" style={{ width: `${Math.max(4, item.share_pct)}%` }} /></span><span className="attribution-share">{item.share_pct}%</span></div>)}</div><p className="attribution-note">{components.attribution.note}</p></>}</section>

      <section className="result-section support-section"><div className="result-section-heading"><p className="eyebrow">02 / WHAT NEXT</p><h2>{result.support_plan?.title ?? "A gentle next step"}</h2><p>{result.support_plan?.next_action ?? "Choose one small action that supports you today."}</p></div>{result.themes && <div className="result-themes">{result.themes.map((theme) => <span key={theme}>{theme.replaceAll("_", " ")}</span>)}</div>}<div className="result-columns">{result.support_plan?.strategies && result.support_plan.strategies.length > 0 && <SupportList title="Suggested strategies" items={result.support_plan.strategies.map((item) => `${item.name}: ${item.steps}`)} />}{result.support_plan?.meditation && result.support_plan.meditation.length > 0 && <SupportList title="Support practices" items={result.support_plan.meditation.map((item) => `${item.name}: ${item.steps}`)} />}{result.support_plan?.support_groups && <SupportList title="Connection" items={result.support_plan.support_groups.map((item) => `${item.name}: ${item.description}`)} />}</div></section>

      {contact && <section className={`contact-banner ${contact.recommended ? "recommended" : ""}`}><div><p className="eyebrow">03 / PROFESSIONAL SUPPORT</p><h2>{contact.recommended ? "Consider speaking with a professional." : "You can reach out when you need to."}</h2><p>{contact.action}</p></div><div className="contact-quote"><b>What to say</b><span>{contact.what_to_say}</span></div></section>}
      <footer className="results-footer"><span>MindHx / private session</span><button onClick={() => router.push("/")}>Return to check-in <span>↗</span></button></footer>
    </main>
    <SiteFooter />
    </>
  );
}

function Signal({ name, score, max, band, color }: { name: string; score: number; max: number; band: string; color: string }) {
  return <div className={`result-signal-card ${color}-result`}><span className="result-signal-icon">{name === "PHQ-9" ? "9" : name === "GAD-7" ? "∿" : "K"}</span><div><b>{name}</b><h3>{score}<small> / {max}</small></h3><div className="result-bar"><i style={{ width: `${Math.min(100, (score / max) * 100)}%` }} /></div><p>{band.replaceAll("_", " ")}</p></div></div>;
}

function SupportList({ title, items }: { title: string; items: string[] }) {
  return <div className="support-list"><h3>{title}</h3>{items.slice(0, 3).map((item) => <p key={item}><span>+</span>{item}</p>)}</div>;
}
