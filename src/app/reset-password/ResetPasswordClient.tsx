"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import SiteHeader from "../components/SiteHeader";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import SiteFooter from "../components/SiteFooter";
import { resetPassword } from "../lib/auth";

export default function ResetPasswordClient() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your password right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <main className="resource-page">
      <SiteHeader backLabel="Back to check-in" />
      <section className="resource-hero auth-hero">
        <p className="eyebrow">ACCOUNT</p>
        <h1>Set a new password<br /><em>and you&apos;re back in.</em></h1>
        <p>Choose a new password for your MindHx account.</p>
      </section>
      <NatureBanner {...naturePhotos.steppingStones} priority />
      {!token ? (
        <div className="auth-form auth-confirmation">
          <p className="assessment-error auth-error">This reset link is missing its token, so it can&apos;t be used. Request a new one below.</p>
          <Link className="check-in-button auth-confirmation-link" href="/forgot-password">Request a new link <span>→</span></Link>
        </div>
      ) : done ? (
        <div className="auth-form auth-confirmation">
          <p className="auth-success">Your password has been updated. Sign in with your new password.</p>
          <Link className="check-in-button auth-confirmation-link" href="/login">Go to sign in <span>→</span></Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>New password (min. 8 characters) <em className="required-mark">*required</em></span>
            <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
          </label>
          <label>
            <span>Confirm new password <em className="required-mark">*required</em></span>
            <input type="password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
          </label>
          {error && <p className="assessment-error auth-error">{error}</p>}
          <button className="check-in-button" type="submit" disabled={loading}>{loading ? "Updating…" : "Update password"} <span>→</span></button>
          <p className="auth-switch">This link expires 30 minutes after it was requested. Need a new one? <Link href="/forgot-password">Request again</Link></p>
        </form>
      )}
    </main>
    <SiteFooter />
    </>
  );
}
