import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "./lib/seo";
import PageViewTracker from "./components/PageViewTracker";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} | Private mental health check-in`, template: `%s | ${SITE_NAME}` },
  description: "MindHx is an early-detection mental-health triage aid that fuses voice, language, and validated PHQ-9/GAD-7/K10 questionnaires into one explainable risk signal. Not a diagnosis - private by default, bilingual in English and Urdu.",
  keywords: ["mental health screening", "PHQ-9", "GAD-7", "K10", "depression check-in", "anxiety screening", "mental health Pakistan", "Urdu mental health"],
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Private mental health check-in`,
    description: "A private, explainable mental-health triage aid fusing voice, language, and validated questionnaires into one risk signal. Not a diagnosis.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME} | Private mental health check-in`,
    description: "A private, explainable mental-health triage aid fusing voice, language, and validated questionnaires into one risk signal. Not a diagnosis.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <PageViewTracker />
        {children}
      </body>
    </html>
  );
}
