"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import AccountChip from "./AccountChip";

const NAV_LINKS: { href: string; en: string; ur: string; emergency?: boolean }[] = [
  { href: "/medication", en: "Medication", ur: "ادویات" },
  { href: "/ai", en: "MindHx AI", ur: "MindHx AI" },
  { href: "/meditation", en: "Meditation", ur: "مراقبہ" },
  { href: "/therapies", en: "Therapies", ur: "تھراپیز" },
  { href: "/therapist", en: "Therapist", ur: "معالج" },
  { href: "/emergency", en: "Emergency support", ur: "فوری مدد", emergency: true },
];

type Props = {
  backHref?: string;
  backLabel?: string;
  language?: "English" | "اردو";
  onToggleLanguage?: () => void;
  right?: ReactNode;
};

export default function SiteHeader({ backHref = "/", backLabel, language = "English", onToggleLanguage, right }: Props) {
  const isUrdu = language === "اردو";
  return (
    <header className="site-header-sticky">
      <div className="resource-header" dir={isUrdu ? "rtl" : "ltr"}>
        <Link href="/" className="results-brand"><span className="brand-mark">M</span><span>Mind<span className="brand-accent">Hx</span></span></Link>
        <nav className="topbar-nav" aria-label="MindHx resources">
          {NAV_LINKS.map((link) => <Link key={link.href} href={link.href} className={link.emergency ? "topbar-nav-emergency" : undefined}>{isUrdu ? link.ur : link.en}</Link>)}
        </nav>
        <div className="resource-header-right">
          {right}
          <AccountChip language={language} />
          {onToggleLanguage && <button className="language" onClick={onToggleLanguage} type="button">◎ {language}</button>}
          <Link href={backHref} className="resource-back">{backLabel ?? (isUrdu ? "چیک ان پر واپس" : "Back to check-in")} ↗</Link>
        </div>
      </div>
    </header>
  );
}
