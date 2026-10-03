import type { Metadata } from "next";
import { pageMetadata } from "../lib/seo";
import AboutClient from "./AboutClient";

export const metadata: Metadata = pageMetadata({
  title: "About MindHx",
  description: "Why MindHx exists, how its three signals work together, what it keeps and what it doesn't, where a check-in routes next, and who it is - and isn't - built for.",
  path: "/about",
});

export default function Page() {
  return <AboutClient />;
}
