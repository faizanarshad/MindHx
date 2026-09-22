import type { Metadata } from "next";
import { Suspense } from "react";
import { pageMetadata } from "../lib/seo";
import LoginClient from "./LoginClient";

export const metadata: Metadata = pageMetadata({
  title: "Sign In",
  description: "Sign in to MindHx to view your check-in results and save your history over time.",
  path: "/login",
  noindex: true,
});

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
