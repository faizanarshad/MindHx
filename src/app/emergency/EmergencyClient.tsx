"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import CrisisBanner from "../components/CrisisBanner";
import CheckInResultsBody, { type Result } from "../components/CheckInResultsBody";
import { DoodleCloud } from "../components/Doodles";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import SiteFooter from "../components/SiteFooter";
import { fetchCurrentUser } from "../lib/auth";
import { downloadResultsPdf } from "../lib/resultsPdf";
import { crisisCopy, type CrisisContext } from "../lib/crisisCopy";

type CheckInDetail = {
  language: string;
  transcript: string;
  typedText: string;
  phq9: { question: string; answer: string | null }[];
  gad7: { question: string; answer: string | null }[];
  k10: { question: string; answer: string | null }[];
};

const backHomeLabel = { en: "Back to check-in", ur: "چیک ان پر واپس جائیں" };

export default function EmergencyClient() {
  const router = useRouter();
  const [context, setContext] = useState<CrisisContext | null>(null);
  const [manualLanguage, setManualLanguage] = useState<"en" | "ur" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [detail, setDetail] = useState<CheckInDetail | null>(null);
  const [preparedFor, setPreparedFor] = useState<{ name?: string | null; email?: string | null }>({});

  useEffect(() => {
    const stored = sessionStorage.getItem("mindhx:crisis-context");
    if (stored) startTransition(() => setContext(JSON.parse(stored) as CrisisContext));

    // If a completed check-in's results are already sitting in sessionStorage
    // (set right before landing here, or from an earlier check-in this
    // session), show them alongside the emergency info instead of a bare
    // safety page - the same content /results shows for a crisis result.
    // mindhx:last-result is only ever set after HomeClient's login check
    // passes, so its presence alone means this is safe to show.
    const storedResult = sessionStorage.getItem("mindhx:last-result");
    if (storedResult) {
      try {
        startTransition(() => setResult(JSON.parse(storedResult) as Result));
      } catch {
        // Corrupt/unavailable - just show the plain emergency page.
      }
    }
    const storedDetail = sessionStorage.getItem("mindhx:last-checkin-detail");
    if (storedDetail) {
      try {
        startTransition(() => setDetail(JSON.parse(storedDetail) as CheckInDetail));
      } catch {
        // Corrupt/unavailable - the PDF just won't have the full detail section.
      }
    }
    fetchCurrentUser().then((user) => {
      if (user) startTransition(() => setPreparedFor({ name: user.full_name, email: user.email }));
    });
  }, []);

  const language = manualLanguage ?? (result
    ? (detail?.language === "اردو" ? "ur" : "en")
    : (context?.language === "ur" ? "ur" : "en"));
  const text = crisisCopy[language];

  function handleDownloadPdf() {
    if (!result) return;
    downloadResultsPdf(result, preparedFor, detail ?? undefined);
  }

  return (
    <>
    <main className="resource-page emergency-page" dir={language === "ur" ? "rtl" : "ltr"}>
      <DoodleCloud className="doodle doodle-blue doodle-float-slow" style={{ top: "95px", right: "6%", opacity: 0.3 }} />
      <SiteHeader
        language={language === "ur" ? "اردو" : "English"}
        onToggleLanguage={() => setManualLanguage(language === "ur" ? "en" : "ur")}
        backLabel={backHomeLabel[language]}
      />
      <section className="resource-hero emergency-hero">
        <p className="eyebrow crisis-eyebrow">{text.eyebrow}</p>
        <h1>{text.title}</h1>
        <p>{text.lede}</p>
      </section>
      <NatureBanner {...naturePhotos.softDawn} priority />
      <CrisisBanner language={language} />
      <div className="emergency-actions">
        <Link className="result-primary" href="/therapist">{text.talkTherapist} <span>→</span></Link>
        <Link className="resource-back" href="/">{backHomeLabel[language]} ↗</Link>
      </div>
      {result && (
        <>
          <p className="results-crisis-note">Your full results and PDF are available below - bring them to whoever you reach out to.</p>
          <CheckInResultsBody result={result} onDownloadPdf={handleDownloadPdf} onReturnToCheckIn={() => router.push("/")} />
        </>
      )}
    </main>
    <SiteFooter language={language === "ur" ? "اردو" : "English"} />
    </>
  );
}
