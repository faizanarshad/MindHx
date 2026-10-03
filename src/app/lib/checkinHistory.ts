// Saves a completed check-in to the signed-in user's history: first its
// scores and questionnaire answers (POST /checkins), then the same PDF report the results page
// offers for download (PUT /checkins/{id}/report), so they can download it
// again from their dashboard - e.g. to show a doctor.
//
// Progress is remembered in sessionStorage per result, so reloading
// /results doesn't create a duplicate entry, and a retry after a failure
// only redoes the step that failed.

import type { Result } from "../components/CheckInResultsBody";
import { saveCheckIn, uploadCheckInReport, type QuestionnaireAnswers } from "./auth";
import { resultsPdfBlob, type CheckInDetailForPdf, type PreparedFor } from "./resultsPdf";

const SAVED_KEY = "mindhx:last-result-saved";
const ANSWERS_KEY = "mindhx:last-checkin-answers";

type SaveProgress = { checkInId: string; reportSaved: boolean };

function readProgress(): SaveProgress | null {
  try {
    const raw = sessionStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) as SaveProgress : null;
  } catch {
    return null;
  }
}

function writeProgress(progress: SaveProgress): void {
  try {
    sessionStorage.setItem(SAVED_KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable - worst case a reload saves the check-in again.
  }
}

// Called when a new result replaces the last one (see HomeClient), so the
// next /results visit saves it rather than treating it as already saved.
export function resetSaveProgress(): void {
  try {
    sessionStorage.removeItem(SAVED_KEY);
  } catch {
    // Nothing to reset.
  }
}

// The raw item answers (PHQ-9/GAD-7 0-3, K10 1-5) for the result about to
// be shown, set by HomeClient; null when the questionnaires weren't all
// completed (e.g. a crisis check-in), in which case none are saved.
export function setPendingAnswers(answers: QuestionnaireAnswers | null): void {
  try {
    if (answers) sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
    else sessionStorage.removeItem(ANSWERS_KEY);
  } catch {
    // Storage unavailable - the check-in is saved without item answers.
  }
}

function readPendingAnswers(): QuestionnaireAnswers | undefined {
  try {
    const raw = sessionStorage.getItem(ANSWERS_KEY);
    return raw ? JSON.parse(raw) as QuestionnaireAnswers : undefined;
  } catch {
    return undefined;
  }
}

export function isSavedToHistory(): boolean {
  return Boolean(readProgress()?.reportSaved);
}

// One save at a time: React runs mount effects twice in development, and
// two overlapping calls would otherwise both see "nothing saved yet" and
// create two history entries for the same check-in.
let inFlight: Promise<void> | null = null;

export function saveResultToHistory(result: Result, preparedFor: PreparedFor, detail?: CheckInDetailForPdf): Promise<void> {
  if (!inFlight) {
    inFlight = runSave(result, preparedFor, detail).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runSave(result: Result, preparedFor: PreparedFor, detail?: CheckInDetailForPdf): Promise<void> {
  let progress = readProgress();
  if (progress?.reportSaved) return;

  if (!progress) {
    // Scores, support plan, and item answers - the transcript and written
    // text go only into the PDF below.
    const checkInId = await saveCheckIn({
      riskScore: result.risk_score,
      band: result.band,
      routingDecision: result.routing_decision,
      themes: result.themes ?? [],
      components: result.components,
      supportPlan: result.support_plan,
      answers: readPendingAnswers(),
    });
    progress = { checkInId, reportSaved: false };
    writeProgress(progress);
  }

  await uploadCheckInReport(progress.checkInId, resultsPdfBlob(result, preparedFor, detail));
  writeProgress({ ...progress, reportSaved: true });
}
