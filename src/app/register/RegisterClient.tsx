"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import SiteHeader from "../components/SiteHeader";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import SiteFooter from "../components/SiteFooter";
import { register, safeNextPath } from "../lib/auth";
import { useLanguage } from "../lib/language";

// Option values stay in English (they're what the backend stores); only
// the visible labels are translated.
const copy = {
  English: {
    back: "Back to check-in",
    eyebrow: "ACCOUNT",
    titleA: "Create an account",
    titleB: "to see your results.",
    intro: "Viewing your check-in results requires an account. We save each check-in's scores and your answer to each questionnaire item, which the MindHx team can review. Its full PDF report - including what you said and wrote - is saved too, visible only to you, so you can download it any time and show it to your doctor. You can delete any saved report from your dashboard.",
    email: "Email",
    password: "Password (min. 8 characters)",
    required: "*required",
    fullName: "Full name (optional)",
    fullNamePlaceholder: "Your name",
    phone: "Phone number (optional)",
    ageRange: "Age range (optional)",
    gender: "Gender (optional)",
    relationship: "Relationship status (optional)",
    lifeContext: "Life context (optional)",
    preferredLanguage: "Preferred language (optional)",
    preferNot: "Prefer not to say",
    noPreference: "No preference",
    options: { Woman: "Woman", Man: "Man", "Non-binary": "Non-binary", Single: "Single", Partnered: "Partnered", Married: "Married", Student: "Student", Working: "Working", Retired: "Retired", "Between roles": "Between roles", Caregiving: "Caregiving" },
    tooShort: "Password must be at least 8 characters.",
    tooLong: "Password is too long. Use a shorter password.",
    submit: "Create account",
    submitting: "Creating account…",
    failed: "Account creation failed.",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
  },
  اردو: {
    back: "چیک ان پر واپس",
    eyebrow: "اکاؤنٹ",
    titleA: "اکاؤنٹ بنائیں",
    titleB: "تاکہ اپنے نتائج دیکھ سکیں۔",
    intro: "اپنے جائزے کے نتائج دیکھنے کے لیے اکاؤنٹ ضروری ہے۔ ہم ہر جائزے کے اسکور اور سوالنامے کے ہر سوال کا آپ کا جواب محفوظ کرتے ہیں، جسے MindHx کی ٹیم دیکھ سکتی ہے۔ اس کی مکمل PDF رپورٹ بھی - جس میں وہ شامل ہے جو آپ نے کہا اور لکھا - محفوظ کی جاتی ہے، جو صرف آپ کو نظر آتی ہے، تاکہ آپ اسے کسی بھی وقت ڈاؤن لوڈ کر کے اپنے ڈاکٹر کو دکھا سکیں۔ آپ اپنے ڈیش بورڈ سے کوئی بھی محفوظ رپورٹ حذف کر سکتے ہیں۔",
    email: "ای میل",
    password: "پاس ورڈ (کم از کم 8 حروف)",
    required: "*ضروری",
    fullName: "پورا نام (اختیاری)",
    fullNamePlaceholder: "آپ کا نام",
    phone: "فون نمبر (اختیاری)",
    ageRange: "عمر کی حد (اختیاری)",
    gender: "جنس (اختیاری)",
    relationship: "ازدواجی حیثیت (اختیاری)",
    lifeContext: "زندگی کی صورتحال (اختیاری)",
    preferredLanguage: "ترجیحی زبان (اختیاری)",
    preferNot: "بتانا نہیں چاہتے",
    noPreference: "کوئی ترجیح نہیں",
    options: { Woman: "خاتون", Man: "مرد", "Non-binary": "نان بائنری", Single: "غیر شادی شدہ", Partnered: "رشتے میں", Married: "شادی شدہ", Student: "طالب علم", Working: "ملازمت پیشہ", Retired: "ریٹائرڈ", "Between roles": "فی الحال بے روزگار", Caregiving: "نگہداشت کرنے والے" },
    tooShort: "پاس ورڈ کم از کم 8 حروف کا ہونا چاہیے۔",
    tooLong: "پاس ورڈ بہت لمبا ہے۔ چھوٹا پاس ورڈ استعمال کریں۔",
    submit: "اکاؤنٹ بنائیں",
    submitting: "اکاؤنٹ بن رہا ہے…",
    failed: "اکاؤنٹ نہیں بن سکا۔",
    haveAccount: "پہلے سے اکاؤنٹ ہے؟",
    signIn: "سائن ان کریں",
  },
};

type OptionKey = keyof typeof copy.English.options;

export default function RegisterClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [language, setLanguage] = useLanguage();
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
  const text = copy[language];
  const option = (value: OptionKey) => <option value={value}>{text.options[value]}</option>;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError(text.tooShort);
      return;
    }
    // bcrypt's limit is 72 bytes, not characters - an Urdu letter is 2.
    if (new TextEncoder().encode(password).length > 72) {
      setError(text.tooLong);
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
      router.push(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <main className="resource-page" dir={language === "اردو" ? "rtl" : "ltr"}>
      <SiteHeader backLabel={text.back} language={language} onToggleLanguage={() => setLanguage(language === "English" ? "اردو" : "English")} />
      <section className="resource-hero auth-hero">
        <p className="eyebrow">{text.eyebrow}</p>
        <h1>{text.titleA}<br /><em>{text.titleB}</em></h1>
        <p>{text.intro}</p>
      </section>
      <NatureBanner {...naturePhotos.forestPath} priority />
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>{text.email} <em className="required-mark">{text.required}</em></span>
          <input type="email" dir="ltr" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" />
        </label>
        <label>
          <span>{text.password} <em className="required-mark">{text.required}</em></span>
          <input type="password" dir="ltr" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
        </label>
        <label>
          <span>{text.fullName}</span>
          <input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" placeholder={text.fullNamePlaceholder} />
        </label>
        <label>
          <span>{text.phone}</span>
          <input type="tel" dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="+92 300 1234567" />
        </label>
        <label>
          <span>{text.ageRange}</span>
          <select value={ageRange} onChange={(event) => setAgeRange(event.target.value)}>
            <option value="">{text.preferNot}</option>
            <option>18-24</option>
            <option>25-34</option>
            <option>35-44</option>
            <option>45+</option>
          </select>
        </label>
        <label>
          <span>{text.gender}</span>
          <select value={gender} onChange={(event) => setGender(event.target.value)}>
            <option value="">{text.preferNot}</option>
            {option("Woman")}
            {option("Man")}
            {option("Non-binary")}
          </select>
        </label>
        <label>
          <span>{text.relationship}</span>
          <select value={maritalStatus} onChange={(event) => setMaritalStatus(event.target.value)}>
            <option value="">{text.preferNot}</option>
            {option("Single")}
            {option("Partnered")}
            {option("Married")}
          </select>
        </label>
        <label>
          <span>{text.lifeContext}</span>
          <select value={lifeContext} onChange={(event) => setLifeContext(event.target.value)}>
            <option value="">{text.preferNot}</option>
            {option("Student")}
            {option("Working")}
            {option("Retired")}
            {option("Between roles")}
            {option("Caregiving")}
          </select>
        </label>
        <label>
          <span>{text.preferredLanguage}</span>
          <select value={preferredLanguage} onChange={(event) => setPreferredLanguage(event.target.value)}>
            <option value="">{text.noPreference}</option>
            <option value="en">English</option>
            <option value="ur">اردو (Urdu)</option>
          </select>
        </label>
        {error && <p className="assessment-error auth-error">{error}</p>}
        <button className="check-in-button" type="submit" disabled={loading}>{loading ? text.submitting : text.submit} <span>→</span></button>
        <p className="auth-switch">{text.haveAccount} <Link href={`/login${nextPath !== "/dashboard" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}>{text.signIn}</Link></p>
      </form>
    </main>
    <SiteFooter language={language} />
    </>
  );
}
