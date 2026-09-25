import type { Metadata } from "next";
import { pageMetadata } from "../lib/seo";
import AdminClient from "./AdminClient";

export const metadata: Metadata = pageMetadata({
  title: "Admin",
  description: "MindHx admin panel.",
  path: "/admin",
  noindex: true,
});

export default function Page() {
  return <AdminClient />;
}
