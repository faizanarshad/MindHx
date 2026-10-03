"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NatureBanner from "./components/NatureBanner";
import { naturePhotos } from "./components/naturePhotos";
import SiteFooter from "./components/SiteFooter";
import AccountChip from "./components/AccountChip";
import FeatureCarousel from "./components/FeatureCarousel";
import InnovationGrid from "./components/InnovationGrid";
import TreeScene from "./components/TreeScene";
import { ClinicalSignalGraphic, VoiceSignalGraphic, WordsSignalGraphic } from "./components/SignalGraphics";
import VoiceEmotionBars, { type VoiceEmotion } from "./components/VoiceEmotionBars";
import TextMoodBars, { type TextMoodScores } from "./components/TextMoodBars";
import { fetchCheckInEligibility, isLoggedIn, type CheckInEligibility } from "./lib/auth";
import { resetSaveProgress, setPendingAnswers } from "./lib/checkinHistory";
import { loadQuestionnaireDraft } from "./lib/questionnaireDraft";
import { useLanguage } from "./lib/language";
import { API_BASE } from "./lib/api";
import { answerOptions, gadQuestions, gadQuestionsEn, k10Options, k10Questions, k10QuestionsEn, questions, questionsEn } from "./lib/questionnaires";

const copy = {
  English: {
    eyebrow: "EARLY SIGNALS, HUMAN CARE", title: "Check in with yourself.", intro: "A quiet, private way to notice changes in how you're feeling. MindHx brings together your voice, words, and a short clinical questionnaire.", ready: "Session ready", private: "Private & secure", sound: "How you sound", soundDescription: "Share a short voice note in English or Urdu. We listen for changes in vocal patterns, not the words themselves.", record: "Record a voice note", stop: "Stop recording", listening: "Listening... tap to finish", processing: "Transcribing securely...", recordingHint: "Up to 60 seconds · Nothing is saved", transcriptReady: "Transcript added below", voiceError: "Microphone or transcription unavailable", words: "What you say", wordsDescription: "Write a little about how things have been lately. Be as brief or open as feels right.", placeholder: "I've been feeling...", optional: "Required", speakUrdu: "Hear this in Urdu", speaking: "Generating Urdu voice...", speechError: "Urdu voice generation unavailable", submitText: "Submit", submittingText: "Analyzing...", textSentiment: "Sentiment read", textSubmitHint: "Analysed right away. Kept only inside your saved check-in report, which you can delete from your dashboard.", clinical: "Clinical check-in", clinicalDescription: "The PHQ-9 is a validated questionnaire used by healthcare professionals. Think about the last two weeks.", question: "QUESTION", back: "Back", next: "Next test", review: "Review answers", estimate: "LIVE ESTIMATE", picture: "Your combined picture", pictureDescription: "Complete your check-in to see how the signals come together.", seeCheckIn: "See my check-in", disclaimer: "MindHx is a screening and triage aid, not a diagnosis. Your results are a starting point for a conversation with a qualified professional.", modalEyebrow: "YOUR PRIVATE CHECK-IN", modalTitle: "Your signals are ready to review.", modalDescription: "MindHx combines the three signals into an explainable estimate. A professional should interpret this result with you.", modalScore: "estimated signal strength", continue: "Continue to results", bannerCaption: "Slow down. Notice the signal.", aboutEyebrow: "ABOUT MINDHX", aboutTitle: "Understanding MindHx", aboutTeaserBody: "Why this exists, how the three signals work together, what we keep and what we don't, and who it's built for.", aboutTeaserCta: "Read the full story", startTests: "Start the tests", continueTests: "Continue the tests", reviewTests: "Review your answers",
    heroTitleA: "Notice the signal.", heroTitleB: "Keep the human.", voiceOptional: "Optional", recordingHintFull: "Up to 60 seconds · stops automatically · the audio itself is never saved", voiceTone: "Voice tone", wordChoice: "Word-choice breakdown", signInToView: "Sign in or create an account to view your results.",
    contextKicker: "PRIVATE SESSION CONTEXT", contextReady: "Your context is ready for this session.", contextPrompt: "Personal context helps MindHx tailor support.", contextBody: "Only age range, optional gender, relationship status, and life context are used, in memory, for this session - they are not saved to your account.", contextEdit: "Edit context", contextSet: "Set session context",
    modalContextTitle: "Share only what helps.", modalContextBody: "These fields are optional except age range. They stay in memory for this session and are not saved to your account.", ageRange: "Age range", genderOptional: "Gender (optional)", relationship: "Relationship status", lifeContext: "Life context (optional)", preferNot: "Prefer not to say", updateContext: "Update session context", continuePrivately: "Continue privately", modalAuthA: "Sign in", modalAuthOr: "or", modalAuthB: "create an account", modalAuthC: "to view your check-in results and save your history.", closeLabel: "Close", openProfile: "Open private profile",
    options: { Woman: "Woman", Man: "Man", "Non-binary": "Non-binary", "Prefer not to say": "Prefer not to say", Single: "Single", Partnered: "Partnered", Married: "Married", Student: "Student", Working: "Working", Retired: "Retired", "Between roles": "Between roles", Caregiving: "Caregiving" }
  },
  اردو: {
    eyebrow: "ابتدائی اشارے، انسانی نگہداشت", title: "اپنا حال جانچیں۔", intro: "اپنی کیفیت میں آنے والی تبدیلیوں کو سمجھنے کا ایک پُرسکون اور نجی طریقہ۔ MindHx آپ کی آواز، الفاظ اور مختصر طبی سوالنامے کو یکجا کرتا ہے۔", ready: "سیشن تیار ہے", private: "نجی اور محفوظ", sound: "آپ کی آواز", soundDescription: "انگریزی یا اردو میں ایک مختصر صوتی پیغام ریکارڈ کریں۔ ہم الفاظ کے بجائے آواز کے انداز میں آنے والی تبدیلیوں کو دیکھتے ہیں۔", record: "صوتی پیغام ریکارڈ کریں", stop: "ریکارڈنگ روکیں", listening: "سن رہے ہیں... مکمل کرنے کے لیے دبائیں", processing: "محفوظ طریقے سے متن تیار کیا جا رہا ہے...", recordingHint: "60 سیکنڈ تک · کچھ محفوظ نہیں کیا جاتا", transcriptReady: "متن نیچے شامل کر دیا گیا ہے", voiceError: "مائیکروفون یا متن کی سہولت دستیاب نہیں", words: "آپ کے الفاظ", wordsDescription: "حال ہی میں آپ کیسا محسوس کر رہے ہیں، اس کے بارے میں کچھ لکھیں۔ جتنا مناسب لگے اتنا ہی لکھیں۔", placeholder: "میں محسوس کر رہا/رہی ہوں...", optional: "ضروری", speakUrdu: "یہ اردو میں سنیں", speaking: "اردو آواز تیار ہو رہی ہے...", speechError: "اردو آواز دستیاب نہیں", submitText: "جمع کریں", submittingText: "تجزیہ ہو رہا ہے...", textSentiment: "جذباتی کیفیت", textSubmitHint: "فوراً تجزیہ کیا جاتا ہے۔ صرف آپ کی محفوظ شدہ جائزہ رپورٹ میں رکھا جاتا ہے، جسے آپ اپنے ڈیش بورڈ سے حذف کر سکتے ہیں۔", clinical: "طبی جائزہ", clinicalDescription: "PHQ-9 ایک مستند سوالنامہ ہے جسے ماہرین صحت استعمال کرتے ہیں۔ گزشتہ دو ہفتوں کے بارے میں سوچیں۔", question: "سوال", back: "واپس", next: "اگلا ٹیسٹ", review: "جوابات کا جائزہ", estimate: "موجودہ اندازہ", picture: "آپ کی مجموعی کیفیت", pictureDescription: "اپنا جائزہ مکمل کریں تاکہ تمام اشارے ایک ساتھ دیکھے جا سکیں۔", seeCheckIn: "میرا جائزہ دیکھیں", disclaimer: "MindHx ایک ابتدائی اسکریننگ اور رہنمائی کا ذریعہ ہے، تشخیص نہیں۔ آپ کے نتائج کسی مستند ماہر سے گفتگو کا آغاز ہیں۔ سوالنامے کا اردو متن اس سیشن کے لیے ترجمہ کیا گیا ہے؛ حتمی الفاظ کے لیے انگریزی نسخہ ملاحظہ کریں۔", modalEyebrow: "آپ کا نجی جائزہ", modalTitle: "آپ کے اشارے جائزے کے لیے تیار ہیں۔", modalDescription: "MindHx تینوں اشاروں کو ایک قابلِ وضاحت اندازے میں یکجا کرتا ہے۔ اس نتیجے کی تشریح کسی ماہر کو آپ کے ساتھ کرنی چاہیے۔", modalScore: "اندازاً سگنل کی شدت", continue: "نتائج کی طرف جائیں", bannerCaption: "آہستہ چلیں۔ اشارے کو محسوس کریں۔", aboutEyebrow: "MindHx کے بارے میں", aboutTitle: "MindHx کو سمجھنا", aboutTeaserBody: "یہ کیوں موجود ہے، تینوں اشارے مل کر کیسے کام کرتے ہیں، ہم کیا محفوظ کرتے ہیں اور کیا نہیں، اور یہ کس کے لیے بنایا گیا ہے۔", aboutTeaserCta: "مکمل کہانی پڑھیں", startTests: "ٹیسٹ شروع کریں", continueTests: "ٹیسٹ جاری رکھیں", reviewTests: "اپنے جوابات کا جائزہ لیں",
    heroTitleA: "اشارے کو پہچانیں۔", heroTitleB: "انسانی رابطہ برقرار رکھیں۔", voiceOptional: "اختیاری", recordingHintFull: "60 سیکنڈ تک · خود بخود رک جاتا ہے · آواز کبھی محفوظ نہیں کی جاتی", voiceTone: "آواز کا انداز", wordChoice: "الفاظ کے انتخاب کا جائزہ", signInToView: "نتائج دیکھنے کے لیے سائن ان کریں یا اکاؤنٹ بنائیں۔",
    contextKicker: "نجی سیشن کا سیاق", contextReady: "اس سیشن کے لیے آپ کا سیاق تیار ہے۔", contextPrompt: "ذاتی سیاق MindHx کو بہتر مدد دینے میں مدد کرتا ہے۔", contextBody: "صرف عمر کی حد، اور اختیاری طور پر جنس، ازدواجی حیثیت اور زندگی کی صورتحال، اسی سیشن کے دوران استعمال ہوتی ہیں - یہ آپ کے اکاؤنٹ میں محفوظ نہیں ہوتیں۔", contextEdit: "سیاق میں ترمیم کریں", contextSet: "سیشن کا سیاق طے کریں",
    modalContextTitle: "صرف وہی بتائیں جو مددگار ہو۔", modalContextBody: "عمر کی حد کے علاوہ یہ تمام خانے اختیاری ہیں۔ یہ صرف اسی سیشن کے دوران یادداشت میں رہتے ہیں اور آپ کے اکاؤنٹ میں محفوظ نہیں ہوتے۔", ageRange: "عمر کی حد", genderOptional: "جنس (اختیاری)", relationship: "ازدواجی حیثیت", lifeContext: "زندگی کی صورتحال (اختیاری)", preferNot: "بتانا نہیں چاہتے", updateContext: "سیشن کا سیاق اپ ڈیٹ کریں", continuePrivately: "نجی طور پر جاری رکھیں", modalAuthA: "سائن ان کریں", modalAuthOr: "یا", modalAuthB: "اکاؤنٹ بنائیں", modalAuthC: "تاکہ اپنے جائزے کے نتائج دیکھ سکیں اور اپنی تاریخ محفوظ کر سکیں۔", closeLabel: "بند کریں", openProfile: "نجی پروفائل کھولیں",
    options: { Woman: "خاتون", Man: "مرد", "Non-binary": "نان بائنری", "Prefer not to say": "بتانا نہیں چاہتے", Single: "غیر شادی شدہ", Partnered: "رشتے میں", Married: "شادی شدہ", Student: "طالب علم", Working: "ملازمت پیشہ", Retired: "ریٹائرڈ", "Between roles": "فی الحال بے روزگار", Caregiving: "نگہداشت کرنے والے" }
  }
};

// Live pre-submission estimate only: combines whichever of PHQ-9/GAD-7/K10 are answered
// so far, weighted the same way the backend weights them in the final risk assessment
// (proportionally re-normalized over just the scales answered). Text and voice signals
// are not folded in here since they aren't available until the check-in is submitted;
// the real combined_signal from /risk-assess (which does include them) replaces this
// once the assessment completes.
function combinedLiveEstimate(answers: number[], gadAnswers: number[], k10Answers: number[]) {
  const scales = [
    { values: answers, weight: 0.3, maxIndex: 3 },
    { values: gadAnswers, weight: 0.22, maxIndex: 3 },
    { values: k10Answers, weight: 0.22, maxIndex: 4 },
  ];
  let weightedSum = 0;
  let weightTotal = 0;
  for (const { values, weight, maxIndex } of scales) {
    const answered = values.filter((value) => value > -1);
    if (!answered.length) continue;
    const signal = answered.reduce((sum, value) => sum + value, 0) / (answered.length * maxIndex);
    weightedSum += signal * weight;
    weightTotal += weight;
  }
  return weightTotal ? Math.round((weightedSum / weightTotal) * 100) : 0;
}

// Holds the in-progress check-in (recording, answers, profile) across the
// redirect to sign in - viewing results now requires an account, but
// bouncing someone to /login shouldn't throw away what they just recorded.
const CHECKIN_DRAFT_KEY = "mindhx:pending-checkin";

function cooldownMessage(eligibility: CheckInEligibility, isUrdu: boolean): string {
  const days = eligibility.cooldown_days;
  const opens = eligibility.next_available_at
    ? new Date(eligibility.next_available_at).toLocaleString(isUrdu ? "ur-PK" : undefined, { dateStyle: "full", timeStyle: "short" })
    : "";
  return isUrdu
    ? `آپ پچھلے ${days} دنوں میں اپنا جائزہ مکمل کر چکے ہیں۔ آپ کا اگلا جائزہ ${opens} کو دستیاب ہوگا۔ اس دوران آپ اپنی پیش رفت ڈیش بورڈ پر دیکھ سکتے ہیں۔`
    : `You've completed a check-in in the last ${days} days. Your next one opens ${opens}. Meanwhile, you can follow your progress on your dashboard.`;
}

const MAX_RECORDING_MS = 60_000;
const MAX_TYPED_TEXT = 500;

// MediaRecorder formats differ by browser: Chrome/Firefox record WebM,
// Safari (including iPhone) records MP4/AAC. Both are accepted by the
// transcription and voice-analysis endpoints.
function pickRecordingFormat(): { mimeType?: string; extension: string } {
  const candidates = [
    { mimeType: "audio/webm;codecs=opus", extension: "webm" },
    { mimeType: "audio/webm", extension: "webm" },
    { mimeType: "audio/mp4", extension: "m4a" },
    { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
  ];
  const supported = typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function"
    ? candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType))
    : undefined;
  return supported ?? { extension: "webm" };
}

export default function HomeClient() {
  const router = useRouter();
  const [answers, setAnswers] = useState(Array(questionsEn.length).fill(-1));
  const [gadAnswers, setGadAnswers] = useState(Array(gadQuestionsEn.length).fill(-1));
  const [k10Answers, setK10Answers] = useState(Array(k10QuestionsEn.length).fill(-1));
  const [profile, setProfile] = useState({ ageRange: "", gender: "", maritalStatus: "", lifeContext: "", preferredLanguage: "en" });
  const [sessionToken, setSessionToken] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [language, setLanguage] = useLanguage();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [voiceFeatures, setVoiceFeatures] = useState<{ risk_signal?: number; pause_ratio?: number; energy_variability?: number; speaking_rate?: number; emotion?: VoiceEmotion }>({});
  const [typedText, setTypedText] = useState("");
  const [textSubmitting, setTextSubmitting] = useState(false);
  const [textSubmitError, setTextSubmitError] = useState("");
  const [textSubmitResult, setTextSubmitResult] = useState<({ sentiment: string } & TextMoodScores) | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState("");
  const [resumeNotice, setResumeNotice] = useState("");
  // Set while this account is inside its check-in cooldown (one saved
  // check-in per CHECKIN_COOLDOWN_DAYS, enforced by the backend).
  const [cooldown, setCooldown] = useState<CheckInEligibility | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const answered = answers.filter((answer) => answer > -1).length;
  const isComplete = answered === questionsEn.length;
  const score = combinedLiveEstimate(answers, gadAnswers, k10Answers);
  const liveScores = { phq9: answers.reduce((sum, answer) => sum + Math.max(0, answer), 0), gad7: gadAnswers.reduce((sum, answer) => sum + Math.max(0, answer), 0), k10: k10Answers.reduce((sum, answer) => sum + (answer > -1 ? answer + 1 : 0), 0) };
  const text = copy[language as keyof typeof copy];
  const profileOption = (value: keyof typeof copy.English.options) => <option value={value}>{text.options[value]}</option>;
  const languageKey = language as keyof typeof questions;
  const completedScales = [isComplete, gadAnswers.every((answer) => answer > -1), k10Answers.every((answer) => answer > -1)].filter(Boolean).length;

  useEffect(() => {
    const loggedIn = isLoggedIn();
    startTransition(() => setHasAccount(loggedIn));

    // The actual PHQ-9/GAD-7/K10 answering happens on /questionnaire now;
    // pick up whatever progress is saved there every time this page mounts
    // (including right after navigating back from it).
    const draft = loadQuestionnaireDraft({
      answers: Array(questionsEn.length).fill(-1),
      gadAnswers: Array(gadQuestionsEn.length).fill(-1),
      k10Answers: Array(k10QuestionsEn.length).fill(-1),
    });
    startTransition(() => {
      setAnswers(draft.answers);
      setGadAnswers(draft.gadAnswers);
      setK10Answers(draft.k10Answers);
    });

    if (!loggedIn) return;
    fetchCheckInEligibility().then((eligibility) => {
      startTransition(() => setCooldown(eligibility && !eligibility.can_check_in ? eligibility : null));
    });
    try {
      const raw = sessionStorage.getItem(CHECKIN_DRAFT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(CHECKIN_DRAFT_KEY);
      const draft = JSON.parse(raw);
      startTransition(() => {
        if (typeof draft.transcript === "string") setTranscript(draft.transcript);
        if (typeof draft.typedText === "string") setTypedText(draft.typedText);
        if (Array.isArray(draft.answers)) setAnswers(draft.answers);
        if (Array.isArray(draft.gadAnswers)) setGadAnswers(draft.gadAnswers);
        if (Array.isArray(draft.k10Answers)) setK10Answers(draft.k10Answers);
        if (draft.profile) setProfile(draft.profile);
        if (typeof draft.language === "string") setLanguage(draft.language);
        if (draft.voiceFeatures) setVoiceFeatures(draft.voiceFeatures);
        if (typeof draft.sessionToken === "string") setSessionToken(draft.sessionToken);
        setResumeNotice(
          draft.language === "اردو"
            ? "خوش آمدید - آپ کے جوابات بحال کر دیے گئے ہیں۔ نتائج دیکھنے کے لیے دوبارہ \"میرا جائزہ دیکھیں\" دبائیں۔"
            : "Welcome back - your answers were restored. Click “See my check-in” again to view your results."
        );
      });
    } catch {
      // Corrupt or unavailable draft - nothing to restore, no harm done.
    }
    // setLanguage (from useLanguage) is listed because it's a real dependency
    // ESLint can see; it's useCallback-memoized so this still only runs once.
  }, [setLanguage]);

  async function handleSubmitText() {
    if (!typedText.trim()) return;
    setTextSubmitting(true);
    setTextSubmitError("");
    setTextSubmitResult(null);
    try {
      const response = await fetch(`${API_BASE}/analyze-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: typedText, language: language === "اردو" ? "ur" : "en" }),
      });
      if (!response.ok) throw new Error("Text analysis unavailable");
      const result = await response.json() as { sentiment: string; crisis_language: boolean } & TextMoodScores;
      if (result.crisis_language) {
        sessionStorage.setItem("mindhx:crisis-context", JSON.stringify({ source: "text_crisis_language", language: language === "اردو" ? "ur" : "en" }));
        router.push("/emergency");
        return;
      }
      setTextSubmitResult({ sentiment: result.sentiment, anxiety_level: result.anxiety_level, stress_level: result.stress_level, depression_indicator: result.depression_indicator });
    } catch {
      setTextSubmitError(language === "اردو" ? "متن جمع نہیں ہو سکا۔" : "Could not submit your text right now.");
    } finally {
      setTextSubmitting(false);
    }
  }

  async function createPrivateSession() {
    if (!profile.ageRange) {
      setAssessmentError(language === "اردو" ? "سیشن شروع کرنے کے لیے عمر کی حد منتخب کریں۔" : "Choose an age range to start the session.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/session/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: { age_range: profile.ageRange || null, gender: profile.gender || null, marital_status: profile.maritalStatus || null, life_context: profile.lifeContext || null, preferred_language: language === "اردو" ? "ur" : "en" } }) });
      if (!response.ok) throw new Error("Session unavailable");
      const result = await response.json() as { session_token: string };
      setSessionToken(result.session_token);
      setShowProfile(false);
    } catch {
      setAssessmentError(language === "اردو" ? "نجی سیشن شروع نہیں ہو سکا۔" : "Private session could not be started.");
    }
  }

  function stopRecording() {
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
    recordingTimer.current = null;
    if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
    setRecording(false);
  }

  useEffect(() => () => {
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
  }, []);

  async function handleVoiceToggle() {
    if (recording) {
      stopRecording();
      return;
    }

    try {
      setVoiceError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const format = pickRecordingFormat();
      const recorder = format.mimeType ? new MediaRecorder(stream, { mimeType: format.mimeType }) : new MediaRecorder(stream);
      const fileName = `mindhx-voice.${format.extension}`;
      audioChunks.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setTranscribing(true);
        const audioBlob = new Blob(audioChunks.current, { type: recorder.mimeType || format.mimeType || "audio/webm" });
        try {
          const formData = new FormData();
          formData.append("file", audioBlob, fileName);
          formData.append("language", language === "اردو" ? "ur" : "en");
          const response = await fetch(`${API_BASE}/transcribe`, { method: "POST", body: formData });
          if (!response.ok) throw new Error("Transcription failed");
          const result = await response.json() as { text: string };
          setTranscript(result.text);
        } catch {
          setVoiceError(text.voiceError);
        } finally {
          setTranscribing(false);
        }
        try {
          const voiceFormData = new FormData();
          voiceFormData.append("file", audioBlob, fileName);
          const voiceResponse = await fetch(`${API_BASE}/analyze-voice`, { method: "POST", body: voiceFormData });
          if (!voiceResponse.ok) throw new Error("Voice analysis unavailable");
          const voiceResult = await voiceResponse.json() as { risk_signal: number; pause_ratio: number; energy_variability: number; speaking_rate: number; emotion: VoiceEmotion };
          setVoiceFeatures({ risk_signal: voiceResult.risk_signal, pause_ratio: voiceResult.pause_ratio, energy_variability: voiceResult.energy_variability, speaking_rate: voiceResult.speaking_rate, emotion: voiceResult.emotion });
        } catch {
          setVoiceFeatures({});
        }
      };
      mediaRecorder.current = recorder;
      recorder.start();
      setRecording(true);
      recordingTimer.current = setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
      setVoiceError(text.voiceError);
    }
  }

  function goToEmergency(source: "phq9_item9" | "text_crisis_language") {
    try {
      sessionStorage.setItem("mindhx:crisis-context", JSON.stringify({ source, language: language === "اردو" ? "ur" : "en" }));
    } catch {
      // Storage unavailable - /emergency still renders its full content without it.
    }
    router.push("/emergency");
  }

  async function handleCheckIn() {
    const isUrdu = language === "اردو";
    const languageCode = isUrdu ? "ur" : "en";
    const combinedText = `${transcript}\n${typedText}`.trim();
    setAssessmentError("");

    // Safety first: a crisis signal is checked before anything else - before
    // the "finish every section" check and before the sign-in requirement -
    // so someone who has answered PHQ-9 item 9 or written about wanting to
    // die is never sent to a login form or told to finish a questionnaire.
    let textAnalysis: ({ crisis_language?: boolean } & Record<string, unknown>) | null = null;
    if (combinedText) {
      setAssessmentLoading(true);
      try {
        const textResponse = await fetch(`${API_BASE}/analyze-text`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: combinedText, language: languageCode }) });
        if (textResponse.ok) textAnalysis = await textResponse.json();
      } catch {
        // Carry on - /risk-assess re-checks the same text server-side.
      } finally {
        setAssessmentLoading(false);
      }
    }
    const crisisSource = answers[8] > 0 ? "phq9_item9" : textAnalysis?.crisis_language ? "text_crisis_language" : null;
    // Full results (with the crisis banner on top) are only possible once
    // signed in with an age range and a complete PHQ-9; otherwise go straight
    // to emergency support rather than asking for any of that first.
    if (crisisSource && !(isLoggedIn() && profile.ageRange && isComplete)) {
      goToEmergency(crisisSource);
      return;
    }

    if (!crisisSource) {
      // The voice note is optional: it needs a microphone, a supported browser,
      // and a configured speech-to-text service, none of which should stand
      // between someone and their questionnaire results.
      const missingSteps: string[] = [];
      if (!typedText.trim()) missingSteps.push(isUrdu ? "تحریری جواب" : "written reflection");
      if (!isComplete) missingSteps.push("PHQ-9");
      if (!gadAnswers.every((answer) => answer > -1)) missingSteps.push("GAD-7");
      if (!k10Answers.every((answer) => answer > -1)) missingSteps.push("K10");
      if (missingSteps.length > 0) {
        setAssessmentError(
          isUrdu
            ? `نتائج دیکھنے سے پہلے یہ مکمل کریں: ${missingSteps.join("، ")}۔`
            : `Complete these before you can see your results: ${missingSteps.join(", ")}.`
        );
        return;
      }
      if (!isLoggedIn()) {
        try {
          sessionStorage.setItem(CHECKIN_DRAFT_KEY, JSON.stringify({
            transcript, typedText, answers, gadAnswers, k10Answers, profile, language, voiceFeatures, sessionToken,
          }));
        } catch {
          // Storage unavailable - proceed anyway; they'll just re-enter answers after signing in.
        }
        router.push("/login?next=%2F");
        return;
      }
      if (!profile.ageRange) {
        setAssessmentError(isUrdu ? "پہلے نجی سیشن کا سیاق مکمل کریں۔" : "Set your private session context before starting the assessment.");
        setShowProfile(true);
        return;
      }
    }

    // One saved check-in per cooldown window. Checked fresh (not from state)
    // in case a check-in was just saved from another tab. A crisis signal
    // still goes to emergency support rather than stopping here.
    const eligibility = await fetchCheckInEligibility();
    if (eligibility && !eligibility.can_check_in) {
      if (crisisSource) {
        goToEmergency(crisisSource);
        return;
      }
      setCooldown(eligibility);
      setAssessmentError(cooldownMessage(eligibility, isUrdu));
      return;
    }

    setAssessmentLoading(true);
    try {
      // PHQ-9 and the crisis flags are always recomputed by /risk-assess from
      // the raw answers and text; textAnalysis is passed only so it doesn't
      // repeat the (possibly LLM-backed) text read for sentiment.
      const riskResponse = await fetch(`${API_BASE}/risk-assess`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript, typed_text: typedText, language: languageCode, phq9_answers: answers, gad7_answers: gadAnswers, k10_answers: k10Answers.map((answer) => answer + 1), profile: { age_range: profile.ageRange, gender: profile.gender || null, marital_status: profile.maritalStatus || null, life_context: profile.lifeContext || null, preferred_language: languageCode }, text_analysis: textAnalysis ?? {}, voice_features: voiceFeatures }) });
      if (!riskResponse.ok) throw new Error("Risk assessment unavailable");
      const result = await riskResponse.json();
      // A new result - /results saves it (scores + PDF report) to the
      // user's history; see lib/checkinHistory.ts.
      resetSaveProgress();
      sessionStorage.setItem("mindhx:last-result", JSON.stringify(result));
      // Full per-question detail, transcript, and written text - used for the
      // PDF report, which /results saves to the user's account.
      sessionStorage.setItem("mindhx:last-checkin-detail", JSON.stringify({
        language,
        transcript,
        typedText,
        phq9: questions[languageKey].map((questionText, index) => ({ question: questionText, answer: answerOptions[languageKey][answers[index]] ?? null })),
        gad7: gadQuestions[languageKey].map((questionText, index) => ({ question: questionText, answer: answerOptions[languageKey][gadAnswers[index]] ?? null })),
        k10: k10Questions[languageKey].map((questionText, index) => ({ question: questionText, answer: k10Options[languageKey][k10Answers[index]] ?? null })),
      }));
      // The item answers go with the check-in when /results saves it; a
      // crisis check-in can reach here with GAD-7/K10 unfinished, and only
      // complete sets are saved (the backend rejects partial ones).
      setPendingAnswers(isComplete && gadAnswers.every((answer) => answer > -1) && k10Answers.every((answer) => answer > -1)
        ? { phq9: answers, gad7: gadAnswers, k10: k10Answers.map((answer) => answer + 1) }
        : null);
      router.push("/results");
    } catch {
      if (crisisSource) {
        // Never leave a crisis check-in on an error message.
        goToEmergency(crisisSource);
        return;
      }
      setAssessmentError(isUrdu ? "MindHx سروس دستیاب نہیں۔ براہ کرم تھوڑی دیر بعد دوبارہ کوشش کریں۔" : "MindHx service unavailable. Please try again in a moment.");
    } finally {
      setAssessmentLoading(false);
    }
  }

  async function handleUrduSpeech() {
    const speechText = `${transcript}\n${typedText}`.trim();
    if (!speechText || language !== "اردو") return;
    setSpeaking(true);
    setVoiceError("");
    try {
      const response = await fetch(`${API_BASE}/synthesize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: speechText, language: "ur" }) });
      if (!response.ok) throw new Error("Speech generation failed");
      const audio = new Audio(URL.createObjectURL(await response.blob()));
      audio.onended = () => URL.revokeObjectURL(audio.src);
      await audio.play();
    } catch {
      setVoiceError(text.speechError);
    } finally {
      setSpeaking(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">M</span><span>Mind<span className="brand-accent">Hx</span></span></div><nav className="topbar-nav" aria-label="MindHx resources"><Link href="/medication">Medication</Link><Link href="/ai">MindHx AI</Link><Link href="/meditation">Meditation</Link><Link href="/therapies">Therapies</Link><Link href="/therapist">Therapist</Link><Link href="/resources">Resources</Link><Link href="/emergency" className="topbar-nav-emergency">Emergency support</Link></nav><div className="topbar-right"><span className="privacy"><span className="dot" /> {text.private}</span><AccountChip language={language === "اردو" ? "اردو" : "English"} /><button className="language" onClick={() => setLanguage(language === "English" ? "اردو" : "English")}>◎ {language}</button><button className="avatar" onClick={() => setShowProfile(true)} aria-label={text.openProfile}>{sessionToken ? "✓" : "A"}</button></div></header>
      <main className="workspace" dir={language === "اردو" ? "rtl" : "ltr"}>
        <section className="intro intro-banner">
          <TreeScene className="intro-tree-bg" />
          <div className="intro-overlay">
            <div className="hero-copy-text">
              <p className="eyebrow">{text.eyebrow}</p>
              <h1>{text.heroTitleA}<br /><em>{text.heroTitleB}</em></h1>
              <p className="intro-copy">{text.intro}</p>
              <div className="hero-actions">
                <button className="check-in-button hero-action" onClick={() => document.querySelector(".signal-grid")?.scrollIntoView({ behavior: "smooth" })}>{text.seeCheckIn} <span>↓</span></button>
                <span className="status-pill"><span className="pulse" /> {text.ready}</span>
              </div>
              {cooldown && <p className="checkin-cooldown-note">{cooldownMessage(cooldown, language === "اردو")} <Link href="/dashboard">{language === "اردو" ? "ڈیش بورڈ دیکھیں" : "View your dashboard"} →</Link></p>}
            </div>
          </div>
        </section>
        <section className="profile-strip"><div><p className="card-kicker">{text.contextKicker}</p><h2>{sessionToken ? text.contextReady : text.contextPrompt}</h2><p>{text.contextBody}</p></div><button className="profile-button" onClick={() => setShowProfile(true)}>{sessionToken ? text.contextEdit : text.contextSet} <span>→</span></button></section>
        <NatureBanner {...naturePhotos.mountainLake} caption={text.bannerCaption} priority />
        <div className="signal-grid">
          <article className="signal-card signal-card-voice"><VoiceSignalGraphic /><div className="card-heading"><div><p className="card-kicker">SIGNAL 01</p><h2>{text.sound}</h2></div><span className="ready-label ready-label-muted">{text.voiceOptional}</span></div><p className="card-description">{text.soundDescription}</p><button className={`record-button ${recording ? "recording" : ""}`} onClick={handleVoiceToggle} disabled={transcribing}><span className="record-icon" />{transcribing ? text.processing : recording ? text.stop : text.record}</button><span className="microcopy">{voiceError || (transcript ? text.transcriptReady : recording ? text.listening : text.recordingHintFull)}</span><div className={`waveform ${recording ? "waveform-live" : ""}`} aria-hidden="true">{Array.from({ length: 34 }, (_, index) => <i key={index} style={{ height: `${12 + ((index * 17) % 29)}px`, animationDelay: `${(index % 9) * 0.09}s` }} />)}</div>{transcript && <p className="voice-transcript">{transcript}</p>}{voiceFeatures.emotion && <VoiceEmotionBars emotion={voiceFeatures.emotion} title={text.voiceTone} />}</article>
          <article className="signal-card signal-card-words"><WordsSignalGraphic /><div className="card-heading"><div><p className="card-kicker">SIGNAL 02</p><h2>{text.words}</h2></div><span className="ready-label">{text.ready}</span></div><p className="card-description">{text.wordsDescription}</p><textarea value={typedText} onChange={(event) => setTypedText(event.target.value)} maxLength={MAX_TYPED_TEXT} placeholder={text.placeholder} aria-label={text.wordsDescription} /><div className="text-footer"><span>{text.optional}</span><span>{typedText.length} / {MAX_TYPED_TEXT}</span></div><div className="text-actions"><button className="check-in-button text-submit-button" onClick={handleSubmitText} disabled={textSubmitting || !typedText.trim()}>{textSubmitting ? text.submittingText : text.submitText}</button><button className="speech-button" onClick={handleUrduSpeech} disabled={speaking || language !== "اردو" || !(`${transcript}\n${typedText}`.trim())}>{speaking ? text.speaking : text.speakUrdu}</button></div><span className="microcopy">{text.textSubmitHint}</span>{textSubmitResult && <p className="text-submit-result"><b>{text.textSentiment}:</b> {textSubmitResult.sentiment}</p>}{textSubmitResult && <TextMoodBars scores={textSubmitResult} title={text.wordChoice} />}{textSubmitError && <span className="microcopy">{textSubmitError}</span>}{voiceError && <span className="microcopy">{voiceError}</span>}</article>
          <article className="signal-card signal-card-clinical">
            <div className="clinical-card-body">
              <ClinicalSignalGraphic size={72} />
              <div className="clinical-card-text">
                <div className="card-heading"><div><p className="card-kicker">SIGNAL 03 · {completedScales} / 3 COMPLETE</p><h2>{text.clinical}</h2></div></div>
                <p className="card-description">{text.clinicalDescription}</p>
              </div>
            </div>
            <div className="clinical-card-action">
              <div className="scale-dots" aria-hidden="true"><span className={completedScales >= 1 ? "done" : ""} /><span className={completedScales >= 2 ? "done" : ""} /><span className={completedScales >= 3 ? "done" : ""} /></div>
              <Link href="/questionnaire" className="check-in-button">{completedScales === 0 ? text.startTests : completedScales === 3 ? text.reviewTests : text.continueTests} <span>→</span></Link>
            </div>
          </article>
        </div>
        <section className="bottom-row"><div className="score-preview"><div className="score-ring"><strong>{score}</strong><span>/ 100</span></div><div><p className="card-kicker">{text.estimate}</p><h2>{text.picture}</h2><p>{text.pictureDescription}</p><div className="scale-outcomes"><span><b>PHQ-9</b> {liveScores.phq9}/27</span><span><b>GAD-7</b> {liveScores.gad7}/21</span><span><b>K10</b> {liveScores.k10}/50</span></div></div></div><div><button className="check-in-button" onClick={handleCheckIn} disabled={assessmentLoading}>{assessmentLoading ? text.processing : text.seeCheckIn} <span>→</span></button>{!hasAccount && <span className="microcopy">{text.signInToView}</span>}{resumeNotice && <p className="microcopy">{resumeNotice}</p>}{cooldown && !assessmentError && <p className="checkin-cooldown-note">{cooldownMessage(cooldown, language === "اردو")}</p>}{assessmentError && <p className="assessment-error">{assessmentError}</p>}</div></section>
        <FeatureCarousel isUrdu={language === "اردو"} />
        <InnovationGrid isUrdu={language === "اردو"} />
        <section className="about-teaser">
          <p className="eyebrow">{text.aboutEyebrow}</p>
          <h2>{text.aboutTitle}</h2>
          <p>{text.aboutTeaserBody}</p>
          <Link href="/about" className="result-primary">{text.aboutTeaserCta} <span>→</span></Link>
        </section>
        <p className="disclaimer"><span>ⓘ</span> {text.disclaimer} <Link href="/brand" className="brand-link">Brand ↗</Link></p>
      </main>
      <SiteFooter language={language === "اردو" ? "اردو" : "English"} />
      {showProfile && <div className="modal-backdrop" onClick={() => setShowProfile(false)}><div className="modal profile-modal" dir={language === "اردو" ? "rtl" : "ltr"} onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setShowProfile(false)} aria-label={text.closeLabel}>×</button><p className="eyebrow">{text.contextKicker}</p><h2>{text.modalContextTitle}</h2><p>{text.modalContextBody}</p><div className="profile-fields"><select value={profile.ageRange} onChange={(event) => setProfile({ ...profile, ageRange: event.target.value })} aria-label={text.ageRange}><option value="">{text.ageRange}</option><option>18-24</option><option>25-34</option><option>35-44</option><option>45+</option></select><select value={profile.gender} onChange={(event) => setProfile({ ...profile, gender: event.target.value })} aria-label={text.genderOptional}><option value="">{text.genderOptional}</option>{profileOption("Woman")}{profileOption("Man")}{profileOption("Non-binary")}{profileOption("Prefer not to say")}</select><select value={profile.maritalStatus} onChange={(event) => setProfile({ ...profile, maritalStatus: event.target.value })} aria-label={text.relationship}><option value="">{text.relationship}</option>{profileOption("Single")}{profileOption("Partnered")}{profileOption("Married")}{profileOption("Prefer not to say")}</select><select value={profile.lifeContext} onChange={(event) => setProfile({ ...profile, lifeContext: event.target.value })} aria-label={text.lifeContext}><option value="">{text.lifeContext}</option>{profileOption("Student")}{profileOption("Working")}{profileOption("Retired")}{profileOption("Between roles")}{profileOption("Caregiving")}</select></div><button className="check-in-button" onClick={createPrivateSession}>{sessionToken ? text.updateContext : text.continuePrivately} <span>→</span></button><p className="profile-modal-auth"><Link href="/login">{text.modalAuthA}</Link> {text.modalAuthOr} <Link href="/register">{text.modalAuthB}</Link> {text.modalAuthC}</p></div></div>}
    </div>
  );
}
