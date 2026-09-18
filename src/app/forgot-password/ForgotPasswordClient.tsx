"use client";

import Link from "next/link";
import { useState } from "react";
import SiteHeader from "../components/SiteHeader";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import SiteFooter from "../components/SiteFooter";
import { requestPasswordReset } from "../lib/auth";

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset link right now.");
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
        <h1>Forgot your password?<br /><em>We&apos;ll email you a link.</em></h1>
        <p>Enter the email address on your account and we&apos;ll send a link to reset your password. The link expires in 30 minutes.</p>
      </section>
      <NatureBanner {...naturePhotos.sunlitPathway} priority />
      {sent ? (
        <div className="auth-form auth-confirmation">
          <p className="auth-success">If an account exists for <b>{email}</b>, a password reset link is on its way. Check your inbox (and spam folder) - the link expires in 30 minutes.</p>
          <Link className="check-in-button auth-confirmation-link" href="/login">Back to sign in <span>→</span></Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email <em className="required-mark">*required</em></span>
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" />
          </label>
          {error && <p className="assessment-error auth-error">{error}</p>}
          <button className="check-in-button" type="submit" disabled={loading || !email}>{loading ? "Sending…" : "Send reset link"} <span>→</span></button>
          <p className="auth-switch">Remembered it? <Link href="/login">Sign in</Link></p>
        </form>
      )}
    </main>
    <SiteFooter />
    </>
  );
}
