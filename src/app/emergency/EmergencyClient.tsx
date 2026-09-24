"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import CrisisBanner from "../components/CrisisBanner";
import { DoodleCloud } from "../components/Doodles";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import SiteFooter from "../components/SiteFooter";
import { crisisCopy, type CrisisContext } from "../lib/crisisCopy";

const backHomeLabel = { en: "Back to check-in", ur: "چیک ان پر واپس جائیں" };

export default function EmergencyClient() {
  const [context, setContext] = useState<CrisisContext | null>(null);
  const [manualLanguage, setManualLanguage] = useState<"en" | "ur" | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("mindhx:crisis-context");
    if (stored) startTransition(() => setContext(JSON.parse(stored) as CrisisContext));
  }, []);

  const language = manualLanguage ?? (context?.language === "ur" ? "ur" : "en");
  const text = crisisCopy[language];

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
    </main>
    <SiteFooter language={language === "ur" ? "اردو" : "English"} />
    </>
  );
}
