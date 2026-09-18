import type { Metadata } from "next";
import { Suspense } from "react";
import { pageMetadata } from "../lib/seo";
import ResetPasswordClient from "./ResetPasswordClient";

export const metadata: Metadata = pageMetadata({
  title: "Reset Password",
  description: "Set a new password for your MindHx account using the link emailed to you.",
  path: "/reset-password",
  noindex: true,
});

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordClient />
    </Suspense>
  );
}
