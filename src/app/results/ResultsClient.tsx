"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import { DoodleLeaf, DoodleSpeechBubble, DoodleSun } from "../components/Doodles";
import SiteFooter from "../components/SiteFooter";
import CrisisBanner from "../components/CrisisBanner";
import CheckInResultsBody, { type Result } from "../components/CheckInResultsBody";
import { fetchCurrentUser, isLoggedIn } from "../lib/auth";
import { downloadResultsPdf, type PreparedFor } from "../lib/resultsPdf";
import { crisisCopy } from "../lib/crisisCopy";
import { isSavedToHistory, saveResultToHistory } from "../lib/checkinHistory";

type CheckInDetail = {
  language: string;
  transcript: string;
  typedText: string;
  phq9: { question: string; answer: string | null }[];
  gad7: { question: string; answer: string | null }[];
  k10: { question: string; answer: string | null }[];
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const saveCopy = {
  en: {
    saving: "Saving this report to your history…",
    saved: "Saved to your history. You can download this report again any time from your dashboard - for example, to show your doctor.",
    openHistory: "Open my history",
    error: "This report couldn't be saved to your history.",
    retry: "Try again",
  },
  ur: {
    saving: "یہ رپورٹ آپ کی تاریخ میں محفوظ کی جا رہی ہے…",
    saved: "آپ کی تاریخ میں محفوظ ہو گئی۔ آپ یہ رپورٹ کسی بھی وقت اپنے ڈیش بورڈ سے دوبارہ ڈاؤن لوڈ کر سکتے ہیں - مثلاً اپنے ڈاکٹر کو دکھانے کے لیے۔",
    openHistory: "میری تاریخ کھولیں",
    error: "یہ رپورٹ آپ کی تاریخ میں محفوظ نہیں ہو سکی۔",
    retry: "دوبارہ کوشش کریں",
  },
};

async function saveWithStatus(result: Result, preparedFor: PreparedFor, detail: CheckInDetail | null, setStatus: (status: SaveStatus) => void, setErrorDetail: (detail: string) => void) {
  setStatus("saving");
  setErrorDetail("");
  try {
    await saveResultToHistory(result, preparedFor, detail ?? undefined);
    setStatus("saved");
  } catch (err) {
    // e.g. the once-per-CHECKIN_COOLDOWN_DAYS limit - show the server's reason.
    setErrorDetail(err instanceof Error && err.message !== "Something went wrong." ? err.message : "");
    setStatus("error");
  }
}

export default function ResultsClient() {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [detail, setDetail] = useState<CheckInDetail | null>(null);
  const [preparedFor, setPreparedFor] = useState<PreparedFor>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveErrorDetail, setSaveErrorDetail] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login?next=%2Fresults");
      return;
    }
    const stored = sessionStorage.getItem("mindhx:last-result");
    const storedResult = stored ? JSON.parse(stored) as Result : null;
    if (storedResult) {
      startTransition(() => setResult(storedResult));
    }
    const storedDetailRaw = sessionStorage.getItem("mindhx:last-checkin-detail");
    const storedDetail = storedDetailRaw ? JSON.parse(storedDetailRaw) as CheckInDetail : null;
    if (storedDetail) {
      startTransition(() => setDetail(storedDetail));
    }
    fetchCurrentUser().then((user) => {
      if (!user) return;
      const prepared = { name: user.full_name, email: user.email };
      startTransition(() => setPreparedFor(prepared));
      // Save this check-in (scores + this same PDF report) to the user's
      // history, once - a reload finds it already saved.
      if (!storedResult) return;
      if (isSavedToHistory()) startTransition(() => setSaveStatus("saved"));
      else saveWithStatus(storedResult, prepared, storedDetail, setSaveStatus, setSaveErrorDetail);
    });
  }, [router]);

  function handleDownloadPdf() {
    if (!result) return;
    downloadResultsPdf(result, preparedFor, detail ?? undefined);
  }

  if (!result) {
    return <><main className="results-page empty-results"><p className="eyebrow">MINDHX / RESULTS</p><h1>Your check-in is not ready yet.</h1><p>Complete the private assessment first, then return here to review your signals.</p><button className="result-primary" onClick={() => router.push("/")}>Back to check-in <span>→</span></button></main><SiteFooter /></>;
  }

  const isCrisis = Boolean(result.crisis_flag || result.band === "crisis");
  const bannerLanguage = detail?.language === "اردو" ? "ur" : "en";
  const crisisText = crisisCopy[bannerLanguage];
  const saveText = saveCopy[bannerLanguage];

  return (
    <>
    <main className="results-page">
      <DoodleSpeechBubble className="doodle doodle-blue doodle-float" style={{ top: "90px", left: "3%" }} />
      <DoodleSun className="doodle doodle-orange doodle-float-slow" style={{ top: "60px", right: "3%" }} />
      <DoodleLeaf className="doodle doodle-teal doodle-sway" style={{ top: "50%", left: "1%", width: "26px", height: "auto" }} />
      <SiteHeader right={<span className="results-private"><i /> Private session result</span>} backLabel="Back to check-in" />
      {isCrisis && (
        <section className="resource-hero emergency-hero" dir={bannerLanguage === "ur" ? "rtl" : "ltr"}>
          <p className="eyebrow crisis-eyebrow">{crisisText.eyebrow}</p>
          <h2>{crisisText.title}</h2>
          <p>{crisisText.lede}</p>
        </section>
      )}
      <NatureBanner {...naturePhotos.mountainRange} caption="A clearer picture, from higher ground." priority />
      {isCrisis && (
        <>
          <CrisisBanner language={bannerLanguage} />
          <div className="emergency-actions">
            <Link className="result-primary" href="/therapist">{crisisText.talkTherapist} <span>→</span></Link>
          </div>
          <p className="results-crisis-note">Your full results and PDF are still available below - bring them to whoever you reach out to.</p>
        </>
      )}
      {saveStatus !== "idle" && (
        <div className={`results-save-status is-${saveStatus}`} role="status" dir={bannerLanguage === "ur" ? "rtl" : "ltr"}>
          {saveStatus === "saving" && <span>{saveText.saving}</span>}
          {saveStatus === "saved" && <><span>✓ {saveText.saved}</span><Link href="/dashboard">{saveText.openHistory} →</Link></>}
          {saveStatus === "error" && (
            <>
              <span>{saveText.error}{saveErrorDetail && <> {saveErrorDetail}</>}</span>
              <button type="button" onClick={() => saveWithStatus(result, preparedFor, detail, setSaveStatus, setSaveErrorDetail)}>{saveText.retry}</button>
            </>
          )}
        </div>
      )}
      <CheckInResultsBody result={result} onDownloadPdf={handleDownloadPdf} onReturnToCheckIn={() => router.push("/")} />
    </main>
    <SiteFooter />
    </>
  );
}
