import type { Metadata } from "next";
import { pageMetadata } from "../lib/seo";
import ResourcesClient from "./ResourcesClient";

export const metadata: Metadata = pageMetadata({
  title: "Resources",
  description: "Additional guidance from the MindHx team, alongside our meditation techniques and therapy approaches.",
  path: "/resources",
});

export default function Page() {
  return <ResourcesClient />;
}
