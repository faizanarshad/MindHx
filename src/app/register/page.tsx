import type { Metadata } from "next";
import { Suspense } from "react";
import { pageMetadata } from "../lib/seo";
import RegisterClient from "./RegisterClient";

export const metadata: Metadata = pageMetadata({
  title: "Create an Account",
  description: "Create a MindHx account to view your check-in results and save your history over time - only the score, band, and themes are ever stored, never a transcript.",
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
