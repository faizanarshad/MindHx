"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import SiteHeader from "../components/SiteHeader";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import SiteFooter from "../components/SiteFooter";
import { fetchCheckIns, logout, updateProfile, type CheckInRecord, type CurrentUser } from "../lib/auth";
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
        </div>
        <div className="profile-info">
          <h2>{displayName}</h2>
          <p>{user.email}</p>
          {avatarError && <p className="profile-avatar-error">{avatarError}</p>}
          <div className="profile-actions">
            <Link href="/forgot-password">Reset password</Link>
            <button onClick={handleSignOut} type="button">Sign out</button>
          </div>
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
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
    <SiteFooter />
    </>
  );
}
