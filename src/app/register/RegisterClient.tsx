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
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [gender, setGender] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [lifeContext, setLifeContext] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("");
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
      await register({
        email,
        password,
        fullName,
        phone,
        ageRange,
        gender,
        maritalStatus,
        lifeContext,
        preferredLanguage,
      });
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
          <span>Full name (optional)</span>
          <input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" placeholder="Your name" />
        </label>
        <label>
          <span>Phone number (optional)</span>
          <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="+1 555 123 4567" />
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
        <label>
          <span>Gender (optional)</span>
          <select value={gender} onChange={(event) => setGender(event.target.value)}>
            <option value="">Prefer not to say</option>
            <option>Woman</option>
            <option>Man</option>
            <option>Non-binary</option>
          </select>
        </label>
        <label>
          <span>Relationship status (optional)</span>
          <select value={maritalStatus} onChange={(event) => setMaritalStatus(event.target.value)}>
            <option value="">Prefer not to say</option>
            <option>Single</option>
            <option>Partnered</option>
            <option>Married</option>
          </select>
        </label>
        <label>
          <span>Life context (optional)</span>
          <select value={lifeContext} onChange={(event) => setLifeContext(event.target.value)}>
            <option value="">Prefer not to say</option>
            <option>Student</option>
            <option>Working</option>
            <option>Retired</option>
            <option>Between roles</option>
            <option>Caregiving</option>
          </select>
        </label>
        <label>
          <span>Preferred language (optional)</span>
          <select value={preferredLanguage} onChange={(event) => setPreferredLanguage(event.target.value)}>
            <option value="">No preference</option>
            <option value="en">English</option>
            <option value="ur">اردو (Urdu)</option>
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
