"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import { DoodleSpeechBubble, DoodleWave } from "../components/Doodles";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import ExerciseStepper from "../components/ExerciseStepper";
import MoodCheckIn from "../components/MoodCheckIn";
import { getLocalHelpfulPractices, getLocalMoods, recordHelpfulPractice, recordMood } from "../lib/wellbeing";
import { API_BASE } from "../lib/api";
import SiteFooter from "../components/SiteFooter";

type Source = { id: string; title: string; content: string; link: string };
type Exercise = { id: string; name: string; steps: { instruction: string; seconds: number }[] };
type SuggestedCta = { label: string; href: string };

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  exercise?: Exercise;
  suggestedCta?: SuggestedCta;
  isEscalation?: boolean;
};

type ScreeningContext = {
  band?: string;
  risk_score?: number;
  themes?: string[];
  phq9_score?: number;
  gad7_score?: number;
  k10_score?: number;
};

const copy = {
  English: {
    eyebrow: "02 / MINDHX AI",
    titleLine1: "Support that stays",
    titleLine2: "grounded and bounded.",
    intro: "MindHx AI provides general, source-grounded mental-health information after a safety gate. It does not diagnose, prescribe, or replace a professional.",
    chatLabel: "MINDHX AI / GROUNDED CONVERSATION",
    placeholder: "What's on your mind?",
    send: "Send",
    sending: "Thinking...",
    openReference: "Open reference ↗",
    moodPrompt: "How are you feeling right now?",
    moodThanks: "Thanks for checking in - that helps me understand the moment.",
    exerciseStart: "Start",
    exerciseRestart: "Try again",
    exerciseProgress: (current: number, total: number) => `Step ${current} of ${total}`,
    helpedButton: "That helped 👍",
    helpedThanks: "Noted - I'll remember that for next time.",
    step1Title: "01 / Safety gate",
    step1: "Risk and crisis signals are checked before any generated support - this cannot be bypassed by the conversation.",
    step2Title: "02 / Retrieval",
    step2: "Approved coping and psychoeducation content is retrieved for the situation, in your language and cultural context.",
    step3Title: "03 / Composition",
    step3: "MindHx AI (via Qwen) may compose a natural reply, but only from the retrieved material and your session's context - never inventing facts or advice.",
    boundaryTitle: "MindHx AI boundary",
    boundaryBody: "MindHx AI does not score PHQ-9, GAD-7, or K10, name or imply a diagnosis, recommend medication, provide crisis counseling, or override a MindHx crisis decision.",
    medicationRef: "Medication reference ↗",
    groundingRef: "Grounding techniques ↗",
    therapyRef: "Therapy reference ↗",
  },
  اردو: {
    eyebrow: "02 / MindHx AI",
    titleLine1: "ایسی مدد جو",
    titleLine2: "بنیادی اور محدود رہتی ہے۔",
    intro: "MindHx AI ایک حفاظتی جانچ کے بعد عمومی، مصدقہ ذہنی صحت کی معلومات فراہم کرتا ہے۔ یہ تشخیص، تجویز، یا کسی ماہر کا متبادل نہیں ہے۔",
    chatLabel: "MindHx AI / بنیادی گفتگو",
    placeholder: "آپ کے ذہن میں کیا ہے؟",
    send: "بھیجیں",
    sending: "سوچ رہا ہوں...",
    openReference: "حوالہ کھولیں ↗",
    moodPrompt: "ابھی آپ کیسا محسوس کر رہے ہیں؟",
    moodThanks: "چیک ان کرنے کا شکریہ - اس سے مجھے اس لمحے کو سمجھنے میں مدد ملتی ہے۔",
    exerciseStart: "شروع کریں",
    exerciseRestart: "دوبارہ کوشش کریں",
    exerciseProgress: (current: number, total: number) => `قدم ${current} از ${total}`,
    helpedButton: "اس سے مدد ملی 👍",
    helpedThanks: "نوٹ کر لیا - اگلی بار یاد رکھوں گا۔",
    step1Title: "01 / حفاظتی جانچ",
    step1: "کسی بھی تیار کردہ مدد سے پہلے خطرے اور بحران کے اشارے جانچے جاتے ہیں - گفتگو اسے نظرانداز نہیں کر سکتی۔",
    step2Title: "02 / بازیافت",
    step2: "صورتحال کے لیے منظور شدہ مواد آپ کی زبان اور ثقافتی سیاق میں حاصل کیا جاتا ہے۔",
    step3Title: "03 / تشکیل",
    step3: "MindHx AI (Qwen کے ذریعے) ایک فطری جواب تشکیل دے سکتا ہے، مگر صرف حاصل شدہ مواد اور آپ کے سیشن کے سیاق سے - کبھی حقائق یا مشورہ خود سے نہیں بناتا۔",
    boundaryTitle: "MindHx AI کی حد",
    boundaryBody: "MindHx AI PHQ-9، GAD-7، یا K10 اسکور نہیں کرتا، تشخیص کا نام یا اشارہ نہیں دیتا، ادویات تجویز نہیں کرتا، بحرانی مشاورت فراہم نہیں کرتا، یا MindHx کے بحرانی فیصلے کو نظرانداز نہیں کرتا۔",
    medicationRef: "ادویات کا حوالہ ↗",
    groundingRef: "گراؤنڈنگ تکنیکیں ↗",
    therapyRef: "تھراپی کا حوالہ ↗",
  },
};

export default function AiClient() {
  const [language, setLanguage] = useState<"English" | "اردو">("English");
  const text = copy[language];
  const isUrdu = language === "اردو";
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMoodCheckIn, setShowMoodCheckIn] = useState(true);
  const [helpedMessages, setHelpedMessages] = useState<Set<number>>(new Set());
  const screeningContext = useRef<ScreeningContext | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("mindhx:last-result");
      if (stored) {
        const result = JSON.parse(stored);
        screeningContext.current = {
          band: result.band,
          risk_score: result.risk_score,
          themes: result.themes ?? [],
          phq9_score: result.phq9?.total_score,
          gad7_score: result.gad7?.total_score,
          k10_score: result.k10?.total_score,
        };
      }
    } catch {
      screeningContext.current = null;
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          language: isUrdu ? "ur" : "en",
          risk_clear: true,
          history: nextMessages.slice(-20).map((entry) => ({ role: entry.role, content: entry.content })),
          screening_context: screeningContext.current ?? undefined,
          mood_checkins: getLocalMoods(),
          helpful_practices: getLocalHelpfulPractices(),
        }),
      });
      const body = await response.json();
      if (body.status === "escalate") {
        setMessages((current) => [...current, { role: "assistant", content: body.message, isEscalation: true }]);
      } else {
        setMessages((current) => [...current, {
          role: "assistant",
          content: body.message,
          sources: body.sources?.length ? body.sources : undefined,
          exercise: body.exercise,
          suggestedCta: body.suggested_cta,
        }]);
      }
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: isUrdu ? "معذرت، ابھی جواب نہیں مل سکا۔ دوبارہ کوشش کریں۔" : "Sorry, I couldn't get a response right now. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleMoodSelect(mood: number) {
    recordMood(mood);
    setTimeout(() => setShowMoodCheckIn(false), 1400);
  }

  return (
    <>
    <main className="resource-page" dir={isUrdu ? "rtl" : "ltr"}>
      <DoodleSpeechBubble className="doodle doodle-blue doodle-float" style={{ top: "100px", right: "5%" }} />
      <DoodleWave className="doodle doodle-teal doodle-sway" style={{ top: "58%", left: "2%" }} />
      <SiteHeader language={language} onToggleLanguage={() => setLanguage(isUrdu ? "English" : "اردو")} backLabel={isUrdu ? "چیک ان پر واپس" : "Back to check-in"} />
      <section className="resource-hero">
        <p className="eyebrow">{text.eyebrow}</p>
        <h1>{text.titleLine1}<br /><em>{text.titleLine2}</em></h1>
        <p>{text.intro}</p>
      </section>
      <NatureBanner {...naturePhotos.oceanSunrise} priority />
      {showMoodCheckIn && <MoodCheckIn prompt={text.moodPrompt} thanks={text.moodThanks} onSelect={handleMoodSelect} />}
      <section className="ai-chat">
        <div className="chat-label">{text.chatLabel}</div>
        <div className="chat-thread">
          {messages.map((entry, index) => (
            <div key={index} className={`chat-bubble ${entry.role} ${entry.isEscalation ? "escalation" : ""}`}>
              <p>{entry.content}</p>
              {entry.sources?.map((source) => (
                <article key={source.id} className="chat-source">
                  <h3>{source.title}</h3>
                  <p>{source.content}</p>
                  <Link href={source.link}>{text.openReference}</Link>
                </article>
              ))}
              {entry.exercise && (
                <ExerciseStepper
                  name={entry.exercise.name}
                  steps={entry.exercise.steps}
                  startLabel={text.exerciseStart}
                  restartLabel={text.exerciseRestart}
                  progressLabel={text.exerciseProgress}
                  onComplete={() => {
                    recordHelpfulPractice(entry.exercise!.name);
                    setHelpedMessages((current) => new Set(current).add(index));
                  }}
                />
              )}
              {entry.exercise && helpedMessages.has(index) && <p className="chat-helped-note">{text.helpedThanks}</p>}
              {entry.suggestedCta && (
                <Link href={entry.suggestedCta.href} className="chat-suggested-cta">{entry.suggestedCta.label} →</Link>
              )}
            </div>
          ))}
          {loading && <div className="chat-bubble assistant chat-loading">{text.sending}</div>}
          <div ref={threadEndRef} />
        </div>
        <div className="chat-composer">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder={text.placeholder}
            aria-label={text.placeholder}
            maxLength={4000}
          />
          <button className="result-primary" onClick={sendMessage} disabled={loading || !input.trim()}>{text.send}<span>→</span></button>
        </div>
      </section>
      <section className="ai-steps">
        <article><b>{text.step1Title}</b><p>{text.step1}</p></article>
        <article><b>{text.step2Title}</b><p>{text.step2}</p></article>
        <article><b>{text.step3Title}</b><p>{text.step3}</p></article>
      </section>
      <div className="resource-note">
        <b>{text.boundaryTitle}</b>
        <p>{text.boundaryBody}</p>
        <div className="resource-links">
          <Link href="/medication">{text.medicationRef}</Link>
          <Link href="/meditation">{text.groundingRef}</Link>
          <Link href="/therapies">{text.therapyRef}</Link>
        </div>
      </div>
    </main>
    <SiteFooter language={language} />
    </>
  );
}
