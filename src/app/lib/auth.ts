// Client-side helpers for the optional account feature. The core check-in flow
// never calls any of this - accounts are purely opt-in for saving history.
//
// Note: the access token is kept in localStorage for simplicity. That's
// readable by any script on the page, so it's vulnerable to theft via XSS.
// A production deployment handling real health data should move to an
// httpOnly, Secure, SameSite cookie issued by the backend instead, which
// keeps the token out of reach of page JavaScript entirely.

import { API_BASE } from "./api";
import type { Result } from "../components/CheckInResultsBody";

const TOKEN_KEY = "mindhx:auth-token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable (private browsing, etc.) - session just won't persist.
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to do.
  }
}

export function isLoggedIn(): boolean {
  return Boolean(getToken());
}

export async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return typeof body.detail === "string" ? body.detail : "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

export type CurrentUser = {
  id: string;
  email: string;
  age_range: string | null;
  full_name: string | null;
  phone: string | null;
  gender: string | null;
  marital_status: string | null;
  life_context: string | null;
  preferred_language: string | null;
  avatar_data_url: string | null;
  is_admin: boolean;
  created_at: string;
};
export type CheckInRecord = {
  id: string;
  risk_score: number;
  band: string;
  routing_decision: string;
  themes: string[];
  components?: Result["components"];
  support_plan?: Result["support_plan"];
  has_report?: boolean;
  // The person's own item answers; null for check-ins saved before answers
  // were recorded, or without all three questionnaires complete.
  answers?: QuestionnaireAnswers | null;
  created_at: string;
};

export type RegisterProfile = {
  email: string;
  password: string;
  ageRange?: string;
  fullName?: string;
  phone?: string;
  gender?: string;
  maritalStatus?: string;
  lifeContext?: string;
  preferredLanguage?: string;
};

export async function register(profile: RegisterProfile): Promise<string> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: profile.email,
      password: profile.password,
      age_range: profile.ageRange || null,
      full_name: profile.fullName || null,
      phone: profile.phone || null,
      gender: profile.gender || null,
      marital_status: profile.maritalStatus || null,
      life_context: profile.lifeContext || null,
      preferred_language: profile.preferredLanguage || null,
    }),
  });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  const result = await response.json() as { access_token: string };
  setToken(result.access_token);
  return result.access_token;
}

export async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  const result = await response.json() as { access_token: string };
  setToken(result.access_token);
  return result.access_token;
}

// Everything this browser holds about the signed-in person's check-ins -
// results, the full transcript/answers kept for the PDF, crisis context,
// an unfinished draft, and local mood/practice notes. Cleared on sign-out
// so the next person to use this browser (a shared or family device) can't
// open /results and see the previous person's check-in under their own name.
const PRIVATE_SESSION_KEYS = ["mindhx:last-result", "mindhx:last-checkin-detail", "mindhx:last-result-saved", "mindhx:last-checkin-answers", "mindhx:crisis-context", "mindhx:pending-checkin"];
const PRIVATE_LOCAL_KEYS = ["mindhx:mood-checkins", "mindhx:helpful-practices"];

export function logout(): void {
  // End the session server-side too (so the token is dead even if a copy
  // of it survives somewhere), without making sign-out wait on the network.
  const token = getToken();
  if (token) {
    fetch(`${API_BASE}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, keepalive: true }).catch(() => {
      // Best-effort - the token is cleared locally either way.
    });
  }
  clearToken();
  try {
    PRIVATE_SESSION_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
    PRIVATE_LOCAL_KEYS.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage unavailable - nothing was stored there either.
  }
}

// The post-sign-in destination from a ?next= parameter, restricted to a
// path on this site. Anything else (https://..., //host, javascript:, a
// backslash trick) falls back, so a crafted sign-in link can't bounce
// someone to a look-alike site right after they enter their password.
export function safeNextPath(next: string | null, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

export async function requestPasswordReset(email: string): Promise<string> {
  const response = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  const result = await response.json() as { message: string };
  return result.message;
}

export async function resetPassword(token: string, newPassword: string): Promise<string> {
  const response = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  const result = await response.json() as { message: string };
  return result.message;
}

export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  if (!token) throw new Error("Not signed in");
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const response = await authFetch("/auth/me");
    if (!response.ok) {
      clearToken();
      return null;
    }
    return await response.json() as CurrentUser;
  } catch {
    return null;
  }
}

export type ProfileUpdate = Partial<{
  fullName: string;
  phone: string;
  ageRange: string;
  gender: string;
  maritalStatus: string;
  lifeContext: string;
  preferredLanguage: string;
  avatarDataUrl: string;
}>;

export async function updateProfile(update: ProfileUpdate): Promise<CurrentUser> {
  const body: Record<string, string> = {};
  if (update.fullName !== undefined) body.full_name = update.fullName;
  if (update.phone !== undefined) body.phone = update.phone;
  if (update.ageRange !== undefined) body.age_range = update.ageRange;
  if (update.gender !== undefined) body.gender = update.gender;
  if (update.maritalStatus !== undefined) body.marital_status = update.maritalStatus;
  if (update.lifeContext !== undefined) body.life_context = update.lifeContext;
  if (update.preferredLanguage !== undefined) body.preferred_language = update.preferredLanguage;
  if (update.avatarDataUrl !== undefined) body.avatar_data_url = update.avatarDataUrl;

  const response = await authFetch("/auth/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  return await response.json() as CurrentUser;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<string> {
  const response = await authFetch("/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  // Changing the password signs out every existing session, including the
  // token used for this request - the backend hands back a fresh one.
  const result = await response.json() as { message: string; access_token?: string };
  if (result.access_token) setToken(result.access_token);
  return result.message;
}

export type CheckInEligibility = {
  can_check_in: boolean;
  cooldown_days: number;
  last_checkin_at: string | null;
  // Set only while can_check_in is false.
  next_available_at: string | null;
};

// Whether this account can save a new check-in yet (one per
// CHECKIN_COOLDOWN_DAYS, enforced by POST /checkins). Null if signed out or
// the check fails - callers treat that as "allowed" and let the backend decide.
export async function fetchCheckInEligibility(): Promise<CheckInEligibility | null> {
  if (!isLoggedIn()) return null;
  try {
    const response = await authFetch("/checkins/eligibility");
    return response.ok ? await response.json() as CheckInEligibility : null;
  } catch {
    return null;
  }
}

export async function fetchCheckIns(): Promise<CheckInRecord[]> {
  const response = await authFetch("/checkins");
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  return await response.json() as CheckInRecord[];
}

export type SaveCheckInInput = {
  riskScore: number;
  band: string;
  routingDecision: string;
  themes: string[];
  // Every section's structured result - the transcript and written text
  // aren't sent here; they go only into the PDF report (uploadCheckInReport).
  components?: Result["components"];
  supportPlan?: Result["support_plan"];
  // Individual item answers (PHQ-9/GAD-7 0-3, K10 1-5), readable by admins.
  // Omitted unless all three questionnaires are complete.
  answers?: QuestionnaireAnswers;
};

export type QuestionnaireAnswers = { phq9: number[]; gad7: number[]; k10: number[] };

// Saves a check-in's scores to the signed-in user's history and returns
// its id (for attaching the PDF report - see lib/checkinHistory.ts).
// Throws on failure so the results page can say so and offer a retry.
export async function saveCheckIn(input: SaveCheckInInput): Promise<string> {
  const response = await authFetch("/checkins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      risk_score: input.riskScore,
      band: input.band,
      routing_decision: input.routingDecision,
      themes: input.themes,
      components: input.components ?? null,
      support_plan: input.supportPlan ?? null,
      answers: input.answers ?? null,
    }),
  });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  const saved = await response.json() as { id: string };
  return saved.id;
}

export async function uploadCheckInReport(checkInId: string, pdf: Blob): Promise<void> {
  const form = new FormData();
  form.append("file", pdf, "mindhx-checkin.pdf");
  const response = await authFetch(`/checkins/${encodeURIComponent(checkInId)}/report`, { method: "PUT", body: form });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
}

// Downloads the exact PDF that was saved after the check-in.
export async function downloadCheckInReport(checkInId: string): Promise<void> {
  const response = await authFetch(`/checkins/${encodeURIComponent(checkInId)}/report`);
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  const filename = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "mindhx-checkin.pdf";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function deleteCheckInReport(checkInId: string): Promise<void> {
  const response = await authFetch(`/checkins/${encodeURIComponent(checkInId)}/report`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
}

export type LoginSessionRecord = {
  id: string;
  method: "login" | "register" | "password_change" | string;
  device: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_seen_at: string;
  ended_at: string | null;
  status: "active" | "expired" | "logout" | "revoked" | "password_change" | "password_reset" | string;
  active: boolean;
  current: boolean;
};

export async function fetchLoginSessions(): Promise<LoginSessionRecord[]> {
  const response = await authFetch("/auth/sessions");
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  return await response.json() as LoginSessionRecord[];
}

export async function revokeLoginSession(sessionId: string): Promise<void> {
  const response = await authFetch(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
}

export async function revokeOtherLoginSessions(): Promise<number> {
  const response = await authFetch("/auth/sessions/revoke-others", { method: "POST" });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  const result = await response.json() as { ended: number };
  return result.ended;
}
