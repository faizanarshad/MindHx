// Local + optional-account persistence for the lightweight mood check-in loop
// and "what's helped before" memory that feed the AI chat's situational
// context. Anonymous users get a browser-local version of both; signed-in
// users additionally get it saved server-side (see backend/models.py).
import { getToken, isLoggedIn } from "./auth";
import { API_BASE } from "./api";

const MOOD_KEY = "mindhx:mood-checkins";
const PRACTICES_KEY = "mindhx:helpful-practices";

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private browsing, etc.) - just skip persistence.
  }
}

export function getLocalMoods(): number[] {
  return readLocal<number[]>(MOOD_KEY, []);
}

export function getLocalHelpfulPractices(): string[] {
  return readLocal<string[]>(PRACTICES_KEY, []);
}

export async function recordMood(mood: number): Promise<void> {
  const moods = getLocalMoods();
  moods.push(mood);
  writeLocal(MOOD_KEY, moods.slice(-14));
  if (!isLoggedIn()) return;
  try {
    await fetch(`${API_BASE}/mood-checkins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ mood }),
    });
  } catch {
    // Best-effort only - the local copy above still feeds the chat context.
  }
}

export async function recordHelpfulPractice(practiceName: string): Promise<void> {
  const practices = getLocalHelpfulPractices();
  if (!practices.includes(practiceName)) {
    practices.push(practiceName);
    writeLocal(PRACTICES_KEY, practices.slice(-10));
  }
  if (!isLoggedIn()) return;
  try {
    await fetch(`${API_BASE}/helpful-practices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ practice_name: practiceName }),
    });
  } catch {
    // Best-effort only.
  }
}
