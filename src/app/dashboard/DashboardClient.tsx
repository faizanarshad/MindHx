"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import SiteHeader from "../components/SiteHeader";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import SiteFooter from "../components/SiteFooter";
import { changePassword, deleteCheckInReport, downloadCheckInReport, fetchCheckInEligibility, fetchCheckIns, fetchLoginSessions, logout, revokeLoginSession, revokeOtherLoginSessions, updateProfile, type CheckInEligibility, type CheckInRecord, type CurrentUser, type LoginSessionRecord } from "../lib/auth";
import { resizeImageToDataUrl } from "../lib/resizeImage";
import CheckInResultsBody from "../components/CheckInResultsBody";
import ProgressCharts from "../components/ProgressCharts";
import QuestionnaireAnswersList from "../components/QuestionnaireAnswersList";
import { downloadResultsPdf } from "../lib/resultsPdf";

const BAND_LABEL: Record<string, string> = { low: "Low", watch: "Watch", elevated: "Elevated", crisis: "Crisis" };
const SESSION_METHOD_LABEL: Record<string, string> = { login: "Signed in", register: "Account created", password_change: "Signed in after password change" };
const SESSION_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  expired: "Expired",
  logout: "Signed out",
  revoked: "Signed out remotely",
  password_change: "Ended by password change",
  password_reset: "Ended by password reset",
};
const LOGIN_HISTORY_PREVIEW = 5;

export default function DashboardClient() {
  return <ProtectedRoute>{(user) => <DashboardContent initialUser={user} />}</ProtectedRoute>;
}

function DashboardContent({ initialUser }: { initialUser: CurrentUser }) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [checkIns, setCheckIns] = useState<CheckInRecord[] | null>(null);
  const [error, setError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reportBusyId, setReportBusyId] = useState<string | null>(null);
  const [reportError, setReportError] = useState<{ id: string; message: string } | null>(null);
  const [eligibility, setEligibility] = useState<CheckInEligibility | null>(null);

  useEffect(() => {
    fetchCheckIns()
      .then(setCheckIns)
      .catch(() => setError("Could not load your history right now."));
    fetchCheckInEligibility().then(setEligibility);
  }, []);

  function handleSignOut() {
    logout();
    router.push("/");
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarError("");
    setUploadingAvatar(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const updated = await updateProfile({ avatarDataUrl: dataUrl });
      setUser(updated);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Could not update your photo.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  const displayName = user.full_name || user.email;
  const initial = displayName.trim().charAt(0).toUpperCase() || "A";

  async function handleDownloadPdf(entry: CheckInRecord) {
    if (!entry.has_report) {
      // Check-ins saved before reports were kept (or whose report was
      // deleted): rebuild a summary PDF from the saved scores. It has no
      // transcript or written text - only the saved report does; saved item
      // answers are shown on this page instead (QuestionnaireAnswersList).
      downloadResultsPdf(entry, { name: user.full_name, email: user.email });
      return;
    }
    setReportBusyId(entry.id);
    setReportError(null);
    try {
      await downloadCheckInReport(entry.id);
    } catch {
      setReportError({ id: entry.id, message: "Could not download this report right now." });
    } finally {
      setReportBusyId(null);
    }
  }

  async function handleDeleteReport(entry: CheckInRecord) {
    if (!window.confirm("Delete the saved PDF report for this check-in? Its scores stay in your history, but the full report - your answers and what you wrote or said - is removed for good.")) return;
    setReportBusyId(entry.id);
    setReportError(null);
    try {
      await deleteCheckInReport(entry.id);
      setCheckIns((current) => current?.map((item) => item.id === entry.id ? { ...item, has_report: false } : item) ?? null);
    } catch {
      setReportError({ id: entry.id, message: "Could not delete this report right now." });
    } finally {
      setReportBusyId(null);
    }
  }

  return (
    <>
    <main className="resource-page">
      <SiteHeader
        backLabel="New check-in"
        right={<button className="dashboard-signout" onClick={handleSignOut} type="button">Sign out</button>}
      />
      <div className="resource-hero-banner">
        <NatureBanner {...naturePhotos.mountainRange} priority />
        <section className="resource-hero">
          <p className="eyebrow">YOUR DASHBOARD</p>
          <h1>Check-in history<br /><em>for {user.email}.</em></h1>
          <p>Every check-in is saved here: your combined score, signal breakdown, support plan, and your answer to each questionnaire item (which the MindHx team can review). Its full PDF report - including what you said and wrote - is saved too, visible only to you, so you can download it any time and show it to your doctor. You can delete a saved report whenever you like.</p>
        </section>
      </div>

      <section className="profile-panel">
        <div className="profile-avatar-wrap">
          {user.avatar_data_url
            ? <img className="profile-avatar" src={user.avatar_data_url} alt="" />
            : <div className="profile-avatar-placeholder">{initial}</div>}
          <label className="profile-avatar-edit">
            {uploadingAvatar ? "Uploading…" : "Change photo"}
            <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={uploadingAvatar} />
          </label>
          <div className="profile-avatar-actions">
            <button onClick={() => setShowChangePassword(true)} type="button">Change password</button>
            <button onClick={handleSignOut} type="button">Sign out</button>
          </div>
        </div>
        <div className="profile-info">
          <h2>{displayName}</h2>
          <p>{user.email}</p>
          {avatarError && <p className="profile-avatar-error">{avatarError}</p>}
        </div>
      </section>

      {error && <p className="assessment-error dashboard-error">{error}</p>}
      {checkIns === null && !error && <p className="dashboard-loading">Loading your history…</p>}
      {checkIns?.length === 0 && (
        <div className="dashboard-empty">
          <p>No saved check-ins yet.</p>
          <Link className="result-primary" href="/">Start a check-in <span>→</span></Link>
        </div>
      )}
      {checkIns && checkIns.length > 0 && (
        <section className="progress-section">
          <div className="progress-heading">
            <div>
              <p className="card-kicker">YOUR PROGRESS</p>
              <h2>How your scores have changed</h2>
            </div>
            {eligibility && (eligibility.can_check_in
              ? <Link className="result-primary" href="/">Take this week&apos;s check-in <span>→</span></Link>
              : <p className="progress-next">Next check-in opens {new Date(eligibility.next_available_at!).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}.</p>)}
          </div>
          <ProgressCharts entries={checkIns} />
        </section>
      )}
      {checkIns && checkIns.length > 0 && (
        <div className="dashboard-list">
          {checkIns.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <article className="dashboard-entry-wrap" key={entry.id}>
                <button
                  className="dashboard-entry"
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="dashboard-entry-score">
                    <strong>{Math.round(entry.risk_score * 100)}</strong>
                    <span>/ 100</span>
                  </div>
                  <div className="dashboard-entry-details">
                    <b className={`result-band ${entry.band}`}>{BAND_LABEL[entry.band] ?? entry.band}</b>
                    <span className="dashboard-entry-date">{new Date(entry.created_at).toLocaleString()}</span>
                    {entry.themes.length > 0 && (
                      <div className="theme-row">{entry.themes.map((theme) => <span key={theme}>{theme.replaceAll("_", " ")}</span>)}</div>
                    )}
                    {entry.components && (
                      <div className="dashboard-entry-breakdown">
                        <span><b>PHQ-9</b> {entry.components.phq9.score}/27 · {entry.components.phq9.band.replaceAll("_", " ")}</span>
                        <span><b>GAD-7</b> {entry.components.gad7.score}/21 · {entry.components.gad7.band.replaceAll("_", " ")}</span>
                        <span><b>K10</b> {entry.components.k10.score}/50 · {entry.components.k10.band.replaceAll("_", " ")}</span>
                        <span><b>Text</b> {entry.components.text.sentiment}</span>
                        <span><b>Voice</b> {entry.components.voice.available ? `${Math.round((entry.components.voice.signal ?? 0) * 100)}%` : "n/a"}</span>
                      </div>
                    )}
                    {entry.support_plan?.next_action && <p className="dashboard-entry-next-action">{entry.support_plan.next_action}</p>}
                  </div>
                  {(entry.components || entry.answers) && <span className="dashboard-entry-toggle">{isExpanded ? "Hide full results ↑" : "View full results ↓"}</span>}
                </button>
                <div className="dashboard-report-row">
                  {entry.has_report
                    ? <span>📄 Full report saved - your answers and scores, ready to show your doctor.</span>
                    : <span>Summary only - the full report for this check-in isn&apos;t saved.</span>}
                  <div>
                    <button type="button" onClick={() => handleDownloadPdf(entry)} disabled={reportBusyId === entry.id}>
                      {reportBusyId === entry.id ? "Working…" : entry.has_report ? "Download report (PDF)" : "Download summary (PDF)"}
                    </button>
                    {entry.has_report && (
                      <button type="button" className="dashboard-report-delete" onClick={() => handleDeleteReport(entry)} disabled={reportBusyId === entry.id}>Delete report</button>
                    )}
                  </div>
                  {reportError?.id === entry.id && <p className="assessment-error">{reportError.message}</p>}
                </div>
                {isExpanded && (entry.components || entry.answers) && (
                  <div className="dashboard-entry-expanded">
                    {entry.answers && (
                      <div className="dashboard-answers">
                        <h3>Your answers</h3>
                        <QuestionnaireAnswersList answers={entry.answers} audience="self" />
                      </div>
                    )}
                    {entry.components && (
                      <CheckInResultsBody
                        result={entry}
                        onDownloadPdf={() => handleDownloadPdf(entry)}
                        onReturnToCheckIn={() => setExpandedId(null)}
                      />
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <LoginHistory />
    </main>
    <SiteFooter />
    {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </>
  );
}

function LoginHistory() {
  const [sessions, setSessions] = useState<LoginSessionRecord[] | null>(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetchLoginSessions()
      .then((result) => {
        setSessions(result);
        setError("");
      })
      .catch(() => setError("Could not load your login history right now."));
  }

  useEffect(load, []);

  async function handleRevoke(sessionId: string) {
    setBusyId(sessionId);
    try {
      await revokeLoginSession(sessionId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out that device.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeOthers() {
    setBusyId("others");
    try {
      await revokeOtherLoginSessions();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out your other devices.");
    } finally {
      setBusyId(null);
    }
  }

  const otherActive = sessions?.filter((session) => session.active && !session.current).length ?? 0;
  const visible = sessions && (showAll ? sessions : sessions.slice(0, LOGIN_HISTORY_PREVIEW));

  return (
    <section className="login-history">
      <div className="login-history-heading">
        <div>
          <p className="card-kicker">SECURITY</p>
          <h2>Login history</h2>
          <p>Every sign-in to your account from the last 90 days. If you don&apos;t recognise one, sign it out and change your password.</p>
        </div>
        {otherActive > 0 && (
          <button className="login-history-revoke-all" type="button" onClick={handleRevokeOthers} disabled={busyId !== null}>
            {busyId === "others" ? "Signing out…" : `Sign out ${otherActive} other device${otherActive === 1 ? "" : "s"}`}
          </button>
        )}
      </div>
      {error && <p className="assessment-error">{error}</p>}
      {sessions === null && !error && <p className="dashboard-loading">Loading login history…</p>}
      {visible && visible.length > 0 && (
        <ul className="login-history-list">
          {visible.map((session) => (
            <li key={session.id} className={`login-history-row ${session.active ? "is-active" : ""}`}>
              <div className="login-history-main">
                <b>{session.device}</b>
                {session.current && <span className="login-history-badge">This device</span>}
                <span className="login-history-meta">
                  {SESSION_METHOD_LABEL[session.method] ?? "Signed in"} · {new Date(session.created_at).toLocaleString()}
                  {session.ip_address && <> · IP {session.ip_address}</>}
                </span>
                <span className="login-history-meta">
                  {SESSION_STATUS_LABEL[session.status] ?? session.status}
                  {session.active && <> · last active {new Date(session.last_seen_at).toLocaleString()}</>}
                  {session.ended_at && <> · {new Date(session.ended_at).toLocaleString()}</>}
                </span>
              </div>
              {session.active && !session.current && (
                <button type="button" onClick={() => handleRevoke(session.id)} disabled={busyId !== null}>
                  {busyId === session.id ? "Signing out…" : "Sign out"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {sessions && sessions.length > LOGIN_HISTORY_PREVIEW && (
        <button className="login-history-more" type="button" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${sessions.length} sign-ins`}
        </button>
      )}
    </section>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const message = await changePassword(currentPassword, newPassword);
      setSuccess(message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close" type="button">×</button>
        <p className="eyebrow">ACCOUNT</p>
        <h2>Change password</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Current password</span>
            <input type="password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <label>
            <span>New password (min. 8 characters)</span>
            <input type="password" required minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
          </label>
          <label>
            <span>Confirm new password</span>
            <input type="password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
          </label>
          {error && <p className="assessment-error auth-error">{error}</p>}
          {success && <p className="profile-avatar-success">{success}</p>}
          <button className="check-in-button" type="submit" disabled={loading}>{loading ? "Changing…" : "Change password"} <span>→</span></button>
        </form>
        <p className="profile-modal-auth">Forgot your current password instead? <Link href="/forgot-password">Reset it by email</Link>.</p>
      </div>
    </div>
  );
}
