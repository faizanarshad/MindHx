// Client-side helpers for the optional account feature. The core check-in flow
// never calls any of this - accounts are purely opt-in for saving history.
//
// Note: the access token is kept in localStorage for simplicity. That's
// readable by any script on the page, so it's vulnerable to theft via XSS.
// A production deployment handling real health data should move to an
// httpOnly, Secure, SameSite cookie issued by the backend instead, which
// keeps the token out of reach of page JavaScript entirely.

import { API_BASE } from "./api";

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

async function parseErrorDetail(response: Response): Promise<string> {
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
  created_at: string;
};
export type CheckInRecord = { id: string; risk_score: number; band: string; routing_decision: string; themes: string[]; created_at: string };

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

export function logout(): void {
  clearToken();
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

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
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
  const result = await response.json() as { message: string };
  return result.message;
}

export async function fetchCheckIns(): Promise<CheckInRecord[]> {
  const response = await authFetch("/checkins");
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  return await response.json() as CheckInRecord[];
}

export async function saveCheckIn(riskScore: number, band: string, routingDecision: string, themes: string[]): Promise<void> {
  if (!isLoggedIn()) return;
  try {
    await authFetch("/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ risk_score: riskScore, band, routing_decision: routingDecision, themes }),
    });
  } catch {
    // Best-effort only - never block the check-in flow on this.
  }
}
