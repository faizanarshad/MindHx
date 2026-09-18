"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SiteHeader from "../components/SiteHeader";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import SiteFooter from "../components/SiteFooter";
import { register } from "../lib/auth";

export default function RegisterClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, ageRange);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account creation failed.");
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
        <h1>Create an account<br /><em>entirely optional.</em></h1>
        <p>An account lets you save check-in results (score, band, and themes only - never your transcript or written answers) and revisit them later. You can keep using MindHx anonymously without one.</p>
      </section>
      <NatureBanner {...naturePhotos.forestPath} priority />
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>Email <em className="required-mark">*required</em></span>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" />
        </label>
        <label>
          <span>Password (min. 8 characters) <em className="required-mark">*required</em></span>
          <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
        </label>
        <label>
          <span>Age range (optional)</span>
          <select value={ageRange} onChange={(event) => setAgeRange(event.target.value)}>
            <option value="">Prefer not to say</option>
            <option>18-24</option>
            <option>25-34</option>
            <option>35-44</option>
            <option>45+</option>
          </select>
        </label>
        {error && <p className="assessment-error auth-error">{error}</p>}
        <button className="check-in-button" type="submit" disabled={loading}>{loading ? "Creating account…" : "Create account"} <span>→</span></button>
        <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
      </form>
    </main>
    <SiteFooter />
    </>
  );
}
