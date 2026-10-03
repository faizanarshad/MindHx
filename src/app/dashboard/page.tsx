import type { Metadata } from "next";
import { pageMetadata } from "../lib/seo";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = pageMetadata({
  title: "Your Dashboard",
  description: "Review your saved MindHx check-in history - scores, answers, progress over time, and each check-in's PDF report to show your doctor.",
  path: "/dashboard",
  noindex: true,
});

export default function Page() {
  return <DashboardClient />;
}
