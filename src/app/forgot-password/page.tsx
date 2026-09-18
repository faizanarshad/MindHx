import type { Metadata } from "next";
import { pageMetadata } from "../lib/seo";
import ForgotPasswordClient from "./ForgotPasswordClient";

export const metadata: Metadata = pageMetadata({
  title: "Forgot Password",
  description: "Request a link by email to reset your MindHx account password.",
  path: "/forgot-password",
  noindex: true,
});

export default function Page() {
  return <ForgotPasswordClient />;
}
