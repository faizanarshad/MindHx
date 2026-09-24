// Shared crisis/emergency copy - used by both the standalone /emergency
// page (reached directly from nav, or when crisis language is flagged
// before a full check-in exists to show) and the crisis banner embedded in
// /results (reached when a completed check-in itself triggers the crisis
// signal, so the full results and PDF are still shown alongside this).
// Kept in one place so this safety-critical wording can't drift between
// the two surfaces.
export type CrisisLanguage = "en" | "ur";

export type CrisisContext = {
  source: "phq9_item9" | "text_crisis_language" | "manual";
  language: CrisisLanguage;
};

export const crisisCopy: Record<CrisisLanguage, {
  eyebrow: string;
  title: string;
  lede: string;
  stepsTitle: string;
  steps: string[];
  notDiagnosis: string;
  findHelp: string;
  findHelpBody: string;
  talkTherapist: string;
}> = {
  en: {
    eyebrow: "IMMEDIATE SUPPORT",
    title: "You do not have to handle this alone.",
    lede: "MindHx detected a safety signal in your check-in. This is not a diagnosis — it is the fastest route to a person who can help right now.",
    stepsTitle: "Right now",
    steps: [
      "If you are in immediate danger, contact your local emergency number now.",
      "Reach out to a crisis line or a trusted person and stay with them, in person or on a call.",
      "Remove access to anything you could use to harm yourself, if you can.",
      "If symptoms ease, still bring this check-in to a licensed professional for a full evaluation.",
    ],
    notDiagnosis: "This is a risk-tier signal, not a diagnosis. Only a qualified professional can assess and treat what you are experiencing.",
    findHelp: "Find help",
    findHelpBody: "Search for a local crisis line, emergency service, or hospital emergency department in your country. If you already have a therapist, psychiatrist, or doctor, contact them directly.",
    talkTherapist: "Talk to a professional",
  },
  ur: {
    eyebrow: "فوری مدد",
    title: "آپ کو یہ اکیلے نہیں سنبھالنا۔",
    lede: "MindHx نے آپ کے جائزے میں ایک حفاظتی اشارہ محسوس کیا ہے۔ یہ تشخیص نہیں ہے — یہ ابھی کسی مددگار شخص تک پہنچنے کا تیز ترین راستہ ہے۔",
    stepsTitle: "ابھی کریں",
    steps: [
      "اگر آپ فوری خطرے میں ہیں تو ابھی اپنے مقامی ہنگامی نمبر پر رابطہ کریں۔",
      "کسی بحرانی ہیلپ لائن یا قابلِ اعتماد شخص سے رابطہ کریں اور ان کے ساتھ رہیں، ذاتی طور پر یا کال پر۔",
      "اگر ممکن ہو تو خود کو نقصان پہنچانے کی کسی بھی چیز تک رسائی ختم کریں۔",
      "علامات کم ہونے پر بھی، اس جائزے کو مکمل تشخیص کے لیے کسی مستند ماہر کے پاس ضرور لے جائیں۔",
    ],
    notDiagnosis: "یہ ایک خطرے کی سطح کا اشارہ ہے، تشخیص نہیں۔ آپ کی کیفیت کا جائزہ اور علاج صرف ایک مستند ماہر ہی کر سکتا ہے۔",
    findHelp: "مدد تلاش کریں",
    findHelpBody: "اپنے ملک میں کسی مقامی بحرانی ہیلپ لائن، ہنگامی سروس، یا ہسپتال کے ایمرجنسی شعبے کو تلاش کریں۔ اگر آپ کا پہلے سے کوئی معالج، ماہرِ نفسیات، یا ڈاکٹر ہے تو براہِ راست ان سے رابطہ کریں۔",
    talkTherapist: "کسی ماہر سے بات کریں",
  },
};
