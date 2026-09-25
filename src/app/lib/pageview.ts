import { API_BASE } from "./api";

// Fire-and-forget - never awaited by the caller, never blocks or affects
// page rendering, and failures are silently swallowed (a page view not
// being recorded is never something a visitor should see or wait on).
// Sends only the path - see backend/models.py's PageView docstring for why
// nothing else (IP, user agent, referrer, any identifier) is ever included.
export function recordPageView(path: string): void {
  try {
    fetch(`${API_BASE}/analytics/pageview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
      keepalive: true,
    }).catch(() => {
      // Best-effort only.
    });
  } catch {
    // Best-effort only.
  }
}
