import type { Metadata } from "next";
import { Suspense } from "react";
import { pageMetadata } from "../lib/seo";
import RegisterClient from "./RegisterClient";

export const metadata: Metadata = pageMetadata({
  title: "Create an Account",
  description: "Create a MindHx account to view your check-in results and save your history over time - your scores, questionnaire answers, and a PDF report of each check-in you can show your doctor.",
  path: "/register",
  noindex: true,
});

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RegisterClient />
    </Suspense>
  );
}
