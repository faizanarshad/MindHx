import { NextRequest, NextResponse } from "next/server";
import { SITE_URL } from "./app/lib/seo";

// Redirects www.<domain> to the bare <domain> (whichever NEXT_PUBLIC_SITE_URL
// is set to - the same value canonical URLs, sitemap.xml, and Open Graph
// tags already use), so there's exactly one indexable URL per page instead
// of two. This alone doesn't fix a www DNS record that isn't routed to this
// app at all (e.g. a registrar's own "URL forwarding" service intercepting
// it before any request reaches Next.js) - that has to be fixed at the DNS
// level first (point www at this same Railway service, as an additional
// custom domain there so it gets a valid certificate), and this becomes the
// canonicalization layer on top of that.
const CANONICAL_HOST = (() => {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return null;
  }
})();

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (CANONICAL_HOST && host === `www.${CANONICAL_HOST}`) {
    const url = new URL(request.url);
    url.host = CANONICAL_HOST;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
