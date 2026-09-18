"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SiteHeader from "../components/SiteHeader";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import SiteFooter from "../components/SiteFooter";
import { login } from "../lib/auth";

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
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
        <h1>Sign in<br /><em>to see your history.</em></h1>
        <p>Signing in is entirely optional. Your check-in itself never requires an account - this only lets you save and revisit past results.</p>
      </section>
      <NatureBanner {...naturePhotos.forestPath} priority />
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>Email <em className="required-mark">*required</em></span>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" />
        </label>
        <label>
          <div className="auth-label-row">
            <span>Password <em className="required-mark">*required</em></span>
            <Link href="/forgot-password" className="auth-forgot-link">Forgot password?</Link>
          </div>
          <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        </label>
        {error && <p className="assessment-error auth-error">{error}</p>}
        <button className="check-in-button" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"} <span>→</span></button>
        <p className="auth-switch">Don&apos;t have an account? <Link href="/register">Create one</Link></p>
      </form>
    </main>
    <SiteFooter />
    </>
  );
}
