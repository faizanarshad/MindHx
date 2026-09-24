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
import { downloadResultsPdf } from "../lib/resultsPdf";
import { crisisCopy } from "../lib/crisisCopy";

type CheckInDetail = {
  language: string;
  transcript: string;
  typedText: string;
  phq9: { question: string; answer: string | null }[];
  gad7: { question: string; answer: string | null }[];
  k10: { question: string; answer: string | null }[];
};

export default function ResultsClient() {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [detail, setDetail] = useState<CheckInDetail | null>(null);
  const [preparedFor, setPreparedFor] = useState<{ name?: string | null; email?: string | null }>({});

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login?next=%2Fresults");
      return;
    }
    const stored = sessionStorage.getItem("mindhx:last-result");
    if (stored) {
      startTransition(() => setResult(JSON.parse(stored) as Result));
    }
    const storedDetail = sessionStorage.getItem("mindhx:last-checkin-detail");
    if (storedDetail) {
      startTransition(() => setDetail(JSON.parse(storedDetail) as CheckInDetail));
    }
    fetchCurrentUser().then((user) => {
      if (user) startTransition(() => setPreparedFor({ name: user.full_name, email: user.email }));
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
      <CheckInResultsBody result={result} onDownloadPdf={handleDownloadPdf} onReturnToCheckIn={() => router.push("/")} />
    </main>
    <SiteFooter />
    </>
  );
}
