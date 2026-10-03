# MindHx

MindHx is an early-detection mental-health **triage aid**, not a diagnostic tool. It combines three independent signals — acoustic (how someone sounds), linguistic (what they say), and validated clinical questionnaires (PHQ-9, GAD-7, K10) — into one explainable, weighted risk score, and routes elevated risk to a professional rather than attempting to diagnose or treat.

## Screenshots

Every page supports a full English ⇄ Urdu (RTL) toggle, sourced from the same bilingual copy object per page — not a separate translated build.

### English

| | |
|---|---|
| **Check-in** — voice, text, and PHQ-9/GAD-7/K10 in one flow | **Results** — explainable per-signal attribution |
| ![Home / check-in](docs/screenshots/home.jpg) | ![Results](docs/screenshots/results.jpg) |
| **Medication reference** | **MindHx AI** — grounded, safety-gated chat |
| ![Medication reference](docs/screenshots/medication.jpg) | ![MindHx AI chat](docs/screenshots/ai.jpg) |
| **Meditation techniques** — library | **5-4-3-2-1 grounding** — step-by-step 3D icons |
| ![Meditation techniques](docs/screenshots/meditation-list.jpg) | ![Grounding technique detail](docs/screenshots/meditation-grounding.jpg) |
| **Box breathing** — step-by-step 3D icons | **Therapies** — library |
| ![Box breathing detail](docs/screenshots/meditation-box.jpg) | ![Therapies list](docs/screenshots/therapies-list.jpg) |
| **CBT** — step-by-step 3D icons | **Therapist directory** — verified Pakistan providers |
| ![CBT therapy detail](docs/screenshots/therapy-cbt.jpg) | ![Therapist directory](docs/screenshots/therapist.jpg) |
| **Emergency support** | **Brand / color system** |
| ![Emergency support](docs/screenshots/emergency.jpg) | ![Brand color system](docs/screenshots/brand.jpg) |
| **Sign in** | **Create account** |
| ![Sign in](docs/screenshots/login.jpg) | ![Create account](docs/screenshots/register.jpg) |
| **Dashboard** — saved check-in history with progress charts, each check-in's answers, and its full PDF report to download for a doctor | |
| ![Dashboard](docs/screenshots/dashboard.jpg) | |

### اردو (Urdu, RTL)

| | |
|---|---|
| **چیک ان** | **ادویات کی معلومات** |
| ![Home in Urdu](docs/screenshots/ur/home.jpg) | ![Medication in Urdu](docs/screenshots/ur/medication.jpg) |
| **MindHx AI** | **مراقبے کی تکنیکیں** |
| ![AI chat in Urdu](docs/screenshots/ur/ai.jpg) | ![Meditation list in Urdu](docs/screenshots/ur/meditation-list.jpg) |
| **5-4-3-2-1 گراؤنڈنگ** | **تھراپیز** |
| ![Grounding technique in Urdu](docs/screenshots/ur/meditation-grounding.jpg) | ![Therapies list in Urdu](docs/screenshots/ur/therapies-list.jpg) |
| **سی بی ٹی** | **معالج تلاش کریں** |
| ![CBT in Urdu](docs/screenshots/ur/therapy-cbt.jpg) | ![Therapist directory in Urdu](docs/screenshots/ur/therapist.jpg) |
| **فوری مدد** | |
| ![Emergency support in Urdu](docs/screenshots/ur/emergency.jpg) | |

## Objective

Depression, anxiety, and related conditions are frequently under-screened, especially where access to mental-health professionals is limited and stigma discourages self-report. MindHx's objective is to lower the barrier to a *first* screening step — a private, low-friction check-in that surfaces a risk signal a person can act on — while being explicit about what it is not: not a diagnosis, not a replacement for a clinician, and not a clinically calibrated instrument (yet — see Roadmap).

Three design commitments follow directly from that objective:

- **Multimodal, not single-signal.** A single questionnaire misses tone and word choice; a single acoustic score misses clinical history. MindHx fuses all three, and shows *why* the combined score landed where it did (a per-signal contribution breakdown on the results page) rather than returning an opaque number.
- **Route, don't diagnose.** Every page — the AI chat, the therapist referral, the support plan — is worded in risk-tier language ("your responses suggest elevated risk") and never in diagnostic language ("you have depression"). Crisis signals (PHQ-9 item 9, self-harm language) short-circuit everything else and go straight to immediate-support routing.
- **Minimal data.** The questionnaires, voice note, and written reflection can be filled in without an account, but viewing results requires signing in so they can be revisited later. The one exception is a crisis signal: PHQ-9 item 9 or self-harm language routes straight to emergency support with no sign-in and no need to finish every section. Session context (age range, optional gender/relationship status/life context) lives in the browser only for the active session. Audio is analysed and discarded, never stored by MindHx. When `OPENAI_API_KEY` is set, audio (for transcription) and text (for classification and the AI chat) are sent to OpenAI's API. An account stores each check-in's score, band, themes, and each section's summary scores (questionnaire totals and bands, the text and voice indicator bars, the support plan). It also stores the answer to each PHQ-9/GAD-7/K10 item, which admins can review per user from `/admin`, and that check-in's full PDF report, generated in the browser after the check-in, so the person can download it again and show it to a doctor. The report contains the question-by-question answers and, for English check-ins, the voice transcript and written reflection. Urdu check-ins' reports omit those because of PDF font limits. Reports are visible only to their owner (not to admins) and can be deleted from the dashboard; the check-in's scores and answers remain. The account also keeps a login history (time, device, IP address) of each sign-in, visible only to its owner. Audio is never stored. Signing out clears the check-in data kept in that browser tab.

## Roadmap

**Built:**
- Voice, text, and PHQ-9/GAD-7/K10 check-in flow with a live combined-signal preview
- `/risk-assess` fusing all five signals (PHQ-9, GAD-7, K10, text, voice) into one score, with crisis short-circuiting on PHQ-9 item 9 or detected self-harm language
- A genuine per-signal attribution breakdown (mathematically exact for this additive scoring model, not an approximation) shown on the results page
- A local heuristic acoustic signal (pause ratio, loudness variability, speaking rate) extracted directly from recorded audio — a proxy signal, explicitly not a validated biomarker
- A voice-tone breakdown (calm, stress, anger, fatigue, depression indicator) derived from that same heuristic and shown as bars right after recording and again on the results page — a coarse rule-based reading of pace/pauses/loudness, not a trained emotion classifier
- A word-choice breakdown (anxiety, stress, depression indicator) for the free-text check-in, going beyond a single sentiment label — a lexicon-and-ratio heuristic informed by published psycholinguistic markers (first-person-singular density, absolutist language like "always"/"never"), shown as bars right after submitting text and again on the results page
- Optional accounts can recover a forgotten password via an emailed reset link (`/forgot-password` → `/reset-password`); prints to the backend log instead of sending when no SMTP is configured, so the flow is testable with no email setup
- Theme detection (anxiety, frustration, loss, grief, trauma, hardship, medical concerns) driving tailored coping content
- A dedicated Emergency Support page, reachable from both the check-in flow and the therapist page
- A bounded, source-grounded AI chat (`/ai/chat`) behind a safety gate that checks the current message, earlier turns, and the last check-in's crisis flag. With `OPENAI_API_KEY` set, replies are generated by an LLM from a fixed reference library under strict rules (no diagnosis, no medication advice), and are validated before display with a fallback to the library text. Without the key, it serves the library content directly
- A resource library (medication, meditation techniques, therapies, AI info) with individual detail pages for each meditation technique and therapy approach
- A "Find a professional in Pakistan" directory: verified real institutions per city plus live links to established doctor-directory platforms (oladoc, Marham), rather than a static list that would go stale
- Full English/Urdu bilingual support across every page, with a header-level language toggle
- OpenAI as the text-analysis provider, falling back to a local heuristic classifier if unconfigured
- A `/brand` page documenting the color system
- Accounts (`/register`, `/login`, `/dashboard`) for viewing results and saving check-in history across visits. They use bcrypt-hashed passwords and JWT sessions backed by a server-side `login_sessions` table. Every login or registration creates a session record, and the dashboard's **Login history** shows each sign-in's time, device (browser and OS), IP address, and status. From there a person can sign out any single device or all other devices; signing out ends the session server-side, not just in the browser. Changing or resetting a password signs out every other session. History is kept for `LOGIN_HISTORY_RETENTION_DAYS` (default 90) and is visible only to the account's owner; the admin user list shows only each account's last sign-in time. The `users`/`check_ins` schema is PostgreSQL-backed (SQLite in local dev), and the dashboard sits behind a client-side protected-route wrapper.
- Per-client rate limits on login, registration, password reset, and every endpoint that calls a paid API (`RATE_LIMITS`, in-memory per process)
- Weekly check-ins for signed-in users: one saved check-in per `CHECKIN_COOLDOWN_DAYS` (default 7), enforced by `POST /checkins` and shown on the check-in page before anyone fills it in (`GET /checkins/eligibility`). A crisis signal still routes to emergency support inside the window
- Progress charts (PHQ-9, GAD-7, K10, and the combined score over time) on the user's dashboard and on each user in `/admin`, plus each check-in's item-by-item answers for the user (`GET /checkins`) and for admins (`GET /admin/users/{id}/checkins`)
- Admin access granted only from the command line (`python backend/manage.py promote <email>`), never from anything a user can register or submit

**Not yet built, deliberately:**
- **Score calibration.** The combined risk score is an uncalibrated weighted heuristic — it has not been fit against labeled outcome data, so it should be read as a relative risk-tier indicator, not a calibrated probability. Building this requires real labeled data, which the project does not yet have; faking a calibration step would make the "explainable, calibrated" claim false rather than true.
- **A clinically validated Urdu translation of PHQ-9/GAD-7/K10.** The current Urdu text is a draft, unlicensed translation appropriate for demo purposes only. Item 9 (self-harm ideation) is a safety-critical item in a validated instrument; shipping an unlicensed translation as clinical-grade would be irresponsible.
- **A real acoustic voice-biomarker vendor integration.** The current `/analyze-voice` local heuristic is intentionally provider-pluggable (`VOICE_BIOMARKER_PROVIDER`) so a vendor with a public API contract (e.g. a clinical speech-biomarker provider) can be dropped in later.
- **Auth hardening.** The account system has bcrypt hashing, JWT expiry, session revocation on password change, and basic in-memory rate limiting. It still stores the access token in `localStorage` rather than an httpOnly cookie. That is simpler to implement, but the token is readable by any script on the page, a real concern given the sensitivity of what an account can be linked to. It also doesn't verify email addresses. The rate limiter is per process, so a multi-instance deploy would need a shared store (e.g. Redis). All of these are worth doing before this handles real users at scale.
- **A verified mental-health helpline on the emergency page.** The page lists Pakistan's national emergency numbers (Rescue 1122, Edhi 115, Police 15). A dedicated mental-health helpline should be added to `src/app/lib/crisisCopy.ts` only after its number is confirmed with the organization itself.

## Future implications

- **Calibration work directly changes what MindHx can responsibly claim.** Once labeled outcome data is available, Platt scaling or isotonic regression against a held-out set would let the risk score be reported as an actual probability rather than a relative indicator — a prerequisite for any clinical deployment claim.
- **A validated Urdu instrument would let MindHx be used as a real screening tool in Urdu-speaking clinical settings**, not just as a bilingual demo — this is the single highest-leverage localization gap remaining.
- **A real acoustic biomarker vendor would strengthen the acoustic signal from a heuristic proxy to a validated one**, likely the biggest lever on overall score reliability, since text and PHQ-family signals are already backed by validated instruments or real classifier models.
- Persistent object storage for user audio was deliberately *not* added, since it would contradict the app's core "nothing is saved" privacy commitment — any future storage decision should stay opt-in and time-boxed, not a default.

## Productivity / impact

MindHx is designed to compress a screening step that otherwise requires scheduling a professional appointment into a few private minutes on a phone or laptop:

- A full check-in (voice note, free-text, three questionnaires) takes under 5 minutes and requires no account.
- The combined-signal results page gives a person something concrete to bring into a first conversation with a clinician — three questionnaire scores, a sentiment read, an explainable score breakdown — rather than starting that conversation from zero.
- The bounded AI chat and resource library (medication reference, meditation techniques, therapy approaches) answer common orienting questions ("what is CBT," "what does an SSRI do") without needing a search engine or a first appointment just to get oriented.
- The Pakistan provider directory turns "I should probably see someone" into an actual next click, city by city, without a stale or fabricated contact list.

## Support for users

- **In-app crisis routing:** PHQ-9 item 9 or detected self-harm language in text immediately routes to the Emergency Support page — before any score is computed or shown.
- **Emergency Support page** (`/emergency`): immediate-action guidance, explicitly framed as a risk signal and not a diagnosis, reachable from the check-in flow and from the Therapist page at any time.
- **Therapist referral page** (`/therapist`): what to say at a first appointment, what to bring, and a city-by-city directory of real psychiatric/psychological care in Pakistan.
- **Resource library:** medication reference, meditation techniques (each with step-by-step instructions), and therapy approaches (each with what sessions may involve) — all framed as general education, never as personalized treatment.
- **Bounded AI chat** (`/ai`): answers general mental-health questions from a fixed, reviewed reference library; explicitly escalates rather than engages if it detects a safety concern.
- **Bilingual throughout:** every page above is available in English and Urdu via a header-level toggle.
- **Privacy by default:** no login required, no persisted identity for anonymous use, audio discarded after processing.
- **Optional dashboard** (`/dashboard`): for people who create an account, a history of past check-in scores/bands/themes to track change over time — never a diagnosis, and never the raw content of a check-in.

## Technical details

**Architecture:** two services — a Next.js 16 (App Router) frontend, and a FastAPI backend. The screening/risk-assessment endpoints are fully stateless (every request self-contained, nothing persisted). A separate, optional layer adds PostgreSQL-backed accounts purely for people who choose to save their check-in history; using MindHx without an account touches no database at all.

**Frontend** (`src/app/`): 12 page routes — home (`/`), results, medication, AI chat, meditation (+ 4 technique detail sub-pages), therapies (+ 5 approach detail sub-pages), therapist, emergency, brand, login, register, and dashboard. Shared components: `SiteHeader` (sticky nav + language toggle, used on every page), `Doodles` (original hand-drawn-style SVG illustrations), and `ProtectedRoute` (client-side auth gate wrapping the dashboard — verifies the session token against `/auth/me` before rendering any content, redirecting to `/login` otherwise). Styling is a single `globals.css` light theme (no CSS framework component library beyond Tailwind's base).

**Backend** (`backend/main.py`, FastAPI): 22 endpoints —

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness check |
| `POST /session/start` | Issues an ephemeral session token; nothing is persisted |
| `POST /transcribe` | Transcription via OpenAI's hosted Whisper API |
| `POST /analyze-voice` | Heuristic prosodic signal (pause ratio, loudness variability, speaking rate) via PyAV + numpy, plus a derived calm/stress/anger/fatigue/depression-indicator breakdown — pluggable via `VOICE_BIOMARKER_PROVIDER`, only `local` implemented today |
| `POST /analyze-text` | Sentiment, keyword flags, crisis-language detection, plus an anxiety/stress/depression-indicator breakdown from lexicon and ratio markers (first-person density, absolutist language, worry/pressure/fatigue terms) — OpenAI, falling back to a local heuristic if unconfigured |
| `POST /support-resources` | Theme-matched coping strategies and meditation content |
| `POST /ai/chat` | Bounded, source-grounded chat; safety-gated before any content is returned |
| `POST /synthesize` | Urdu text-to-speech via Uplift AI |
| `POST /score-phq9`, `/score-gad7`, `/score-k10` | Individual questionnaire scoring |
| `POST /risk-assess` | Fuses all signals into the combined score, band, explanation, and routing decision |
| `POST /auth/register`, `/auth/login` | Optional account creation/sign-in; returns a JWT access token |
| `POST /auth/forgot-password`, `/auth/reset-password` | Emails a single-use, 30-minute reset link (never reveals whether an email is registered) and updates the password from it |
| `GET /auth/me` | Returns the signed-in user (requires a valid Bearer token) |
| `POST /checkins`, `GET /checkins` | Save/list a signed-in user's check-in history (aggregate results only) |
| `POST /mood-checkins`, `GET /mood-checkins` | Save/list a signed-in user's lightweight daily mood log |
| `POST /helpful-practices` | Record which coping practice a signed-in user found helpful, feeding future AI chat context |

**Risk fusion:** a weighted sum over PHQ-9 (0.30), GAD-7 (0.22), K10 (0.22), text sentiment (0.16), and voice (0.10, when available) signals, each normalized to 0–1. The per-signal attribution shown on the results page is the exact weighted contribution of each term — for this additive model, that is mathematically identical to each signal's Shapley value, not an approximation.

**Accounts** (`backend/auth.py`, `database.py`, `models.py`): passwords hashed with bcrypt (never stored in plaintext); sessions are HS256 JWTs with a configurable expiry (`JWT_EXPIRE_MINUTES`, default 60). `JWT_SECRET_KEY` must be set explicitly for any real deployment — if it's missing, the backend generates a random per-process secret and logs a warning, so an unset secret fails safe (invalidating tokens on restart) rather than silently shipping a guessable default. `DATABASE_URL` defaults to a local SQLite file so no database setup is needed for local dev or tests; set it to a `postgresql://...` URL (via `psycopg2-binary`, already a dependency) for production, and `docker-compose.yml` provisions a Postgres 16 container automatically.

**Testing:** 56 backend tests (`backend/test_main.py`) covering crisis short-circuiting, theme detection (including a regression test for a fixed keyword-matching bug), the prosodic-signal and voice-tone math independent of PyAV availability, that anxious/stressed/hopeless sample text each score highest on their own linguistic dimension, bilingual AI chat responses (including trend-aware replies for signed-in users with saved history), the risk-assessment fusion shape, the forgot/reset-password flow (including that it never reveals whether an email is registered, and that a reset token is single-use), the register/login/me/checkins/mood-checkins/helpful-practices account flow, and regression tests for the QA fixes (server-side crisis recomputation that ignores forged client results, indirect and Roman-Urdu crisis phrasing, admin access that can't be claimed by registering an email, multi-byte passwords, session revocation on password change, and rate limiting), login sessions (a history entry per sign-in, server-side logout, signing out one or all other devices, pruning), and saved check-in PDF reports (upload, re-download, replace, delete, owner-only access, PDF and size validation). `backend/conftest.py` points each test run at a throwaway SQLite file so the suite is idempotent - it never touches `backend/mindhx.db`. Run with `cd backend && source .venv/bin/activate && pytest test_main.py -v`.

**Stack:** Next.js 16 / React 19 / TypeScript / Tailwind on the frontend; FastAPI / Pydantic / SQLAlchemy / PyAV / numpy / httpx on the backend; PostgreSQL (SQLite in local dev) for the optional accounts feature; bcrypt + PyJWT for authentication; OpenAI for transcription (hosted Whisper), text classification, and the grounded AI chat; Uplift AI for Urdu speech synthesis.

## Run the web app

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Run the FastAPI service

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

No further setup is needed to use MindHx anonymously. To try the optional accounts feature locally, it just works out of the box too — `DATABASE_URL` defaults to a local SQLite file (`backend/mindhx.db`, gitignored) and `JWT_SECRET_KEY` defaults to a random per-process value if unset. For a real deployment, set both explicitly (see `.env.example`).

To give an account access to `/admin`, register it normally first, then run this from the repo root against the same database:

```bash
python backend/manage.py promote someone@example.com   # or: demote
```

(In the single-container deploy, run it inside the container from `/app`.)

## Run both services with Docker

```bash
docker compose up --build
```

The web app runs at `http://localhost:3000`; the API runs at `http://localhost:8000`. A Postgres 16 container is provisioned automatically for the accounts feature (`mindhx-db`, credentials via `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`, default `mindhx`/`mindhx`/`mindhx` — override these for anything beyond local use). Set `JWT_SECRET_KEY` in the environment for anything beyond local use. Set `OPENAI_API_KEY` for transcription to work; `OPENAI_STT_MODEL` defaults to `whisper-1`.

## Important caveats

The current text and risk logic are transparent development implementations; validate/calibrate the models and routing with qualified clinical oversight before production or Alibaba Cloud deployment. The combined risk score is an uncalibrated weighted heuristic — it has not been fit or checked against labeled outcome data, so its output should be read as a relative risk-tier indicator, not a calibrated probability, until that validation work is done. The in-app Urdu PHQ-9/GAD-7/K10 text is a draft translation for demo purposes and is not a clinically validated instrument; a validated translation should replace it before clinical use. `POST /analyze-voice`'s acoustic signal is a heuristic proxy (pause ratio, loudness variability, speaking rate), not a validated clinical voice biomarker.

The session-start profile is deliberately minimal: age range is required; gender, relationship status, life context, and preferred language are optional. None of this requires login, email collection, or long-term demographic storage. The frontend holds the opaque session token and profile only while the browser session is active. No database is touched by the anonymous check-in flow at all. The optional accounts feature is the one part of MindHx that does persist data (email, hashed password, login history, check-in results, individual questionnaire answers, which admins can review, and each check-in's PDF report, which includes the transcript and written reflection and is visible only to its owner). Being an early implementation, it has known gaps, including a `localStorage`-held session token rather than an httpOnly cookie — see Roadmap.
