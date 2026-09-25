"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import SiteHeader from "../components/SiteHeader";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import SiteFooter from "../components/SiteFooter";
import { changePassword, fetchCheckIns, logout, updateProfile, type CheckInRecord, type CurrentUser } from "../lib/auth";
import { resizeImageToDataUrl } from "../lib/resizeImage";

const BAND_LABEL: Record<string, string> = { low: "Low", watch: "Watch", elevated: "Elevated", crisis: "Crisis" };

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

  useEffect(() => {
    fetchCheckIns()
      .then(setCheckIns)
      .catch(() => setError("Could not load your history right now."));
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

  return (
    <>
    <main className="resource-page">
      <SiteHeader
        backLabel="New check-in"
        right={<button className="dashboard-signout" onClick={handleSignOut} type="button">Sign out</button>}
      />
      <section className="resource-hero">
        <p className="eyebrow">YOUR DASHBOARD</p>
        <h1>Check-in history<br /><em>for {user.email}.</em></h1>
        <p>Only the score, band, and detected themes from each check-in are saved here - never your transcript, typed answers, or individual questionnaire responses.</p>
      </section>
      <NatureBanner {...naturePhotos.mountainRange} priority />

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
        <div className="dashboard-list">
          {checkIns.map((entry) => (
            <article className="dashboard-entry" key={entry.id}>
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
            </article>
          ))}
        </div>
      )}
    </main>
    <SiteFooter />
    {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </>
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
