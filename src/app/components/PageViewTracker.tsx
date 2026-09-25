"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { recordPageView } from "../lib/pageview";

// Mounted once in the root layout - fires a fire-and-forget page-view
// beacon whenever the pathname changes (initial load and every client-side
// navigation). Renders nothing.
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) recordPageView(pathname);
  }, [pathname]);

  return null;
}
