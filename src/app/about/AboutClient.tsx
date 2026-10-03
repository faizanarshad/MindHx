"use client";

import SiteHeader from "../components/SiteHeader";
import { DoodleLeaf, DoodleSun } from "../components/Doodles";
import SiteFooter from "../components/SiteFooter";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import { useLanguage } from "../lib/language";

type AboutSection = { image: keyof typeof naturePhotos; en: { title: string; body: string[] }; ur: { title: string; body: string[] } };

const copy = {
  English: {
    eyebrow: "ABOUT MINDHX",
    title: "Understanding MindHx",
    intro: "Why this exists, how it actually works, what it keeps and what it doesn't, and who it is - and isn't - built for.",
    back: "Back to check-in",
  },
  اردو: {
    eyebrow: "MindHx کے بارے میں",
    title: "MindHx کو سمجھنا",
    intro: "یہ کیوں موجود ہے، یہ دراصل کیسے کام کرتا ہے، یہ کیا محفوظ کرتا ہے اور کیا نہیں، اور یہ کس کے لیے ہے - اور کس کے لیے نہیں۔",
    back: "چیک ان پر واپس",
  },
};

const ABOUT_SECTIONS: AboutSection[] = [
  {
    image: "mistyMountains",
    en: {
      title: "Why this exists",
      body: [
        "Depression, anxiety, and related conditions are common, but the first conversation about them rarely feels easy to start. In much of Pakistan and beyond, seeking help is sometimes read as weakness or private shame - something to manage quietly rather than an ordinary health matter to bring to a professional. Add limited access to psychiatrists and psychologists outside major cities, long waitlists even where care exists, and a lot of people never take a first screening step - not because they don't want support, but because the step itself feels too large to start.",
        "MindHx exists to make that step smaller. It replaces “I should probably talk to someone eventually” with a private, five-minute check-in you can do from a phone or laptop tonight - no appointment, no waiting room, no one else needing to know unless you choose to tell them. It is not a diagnosis and it does not pretend to be one. It is a starting point: something concrete to notice about yourself, and, if it matters, something concrete to bring into a real conversation with a real clinician.",
      ],
    },
    ur: {
      title: "یہ کیوں موجود ہے",
      body: [
        "ڈپریشن، اضطراب، اور اس سے ملتی جلتی کیفیات عام ہیں، لیکن ان کے بارے میں پہلی بات کرنا شاذ و نادر ہی آسان محسوس ہوتا ہے۔ پاکستان اور دیگر کئی جگہوں پر، مدد لینا کبھی کبھار کمزوری یا ذاتی شرمندگی سمجھا جاتا ہے - ایک عام صحت کے معاملے کی بجائے کچھ ایسا جسے خاموشی سے سنبھالنا ہے۔ اس پر بڑے شہروں سے باہر ماہرینِ نفسیات اور سائیکاٹرسٹس تک محدود رسائی اور طویل انتظار کا اضافہ کر دیں تو بہت سے لوگ کبھی پہلا اسکریننگ قدم نہیں اٹھاتے - اس لیے نہیں کہ وہ مدد نہیں چاہتے، بلکہ اس لیے کہ یہ قدم خود بہت بڑا محسوس ہوتا ہے۔",
        "MindHx اسی قدم کو چھوٹا بنانے کے لیے موجود ہے۔ یہ 'مجھے کبھی نہ کبھی کسی سے بات کرنی چاہیے' کو ایک نجی، پانچ منٹ کے چیک ان سے بدل دیتا ہے جو آپ آج رات اپنے فون یا لیپ ٹاپ سے کر سکتے ہیں - کوئی ملاقات نہیں، کوئی انتظار گاہ نہیں، اور جب تک آپ خود نہ بتائیں کسی اور کو جاننے کی ضرورت نہیں۔ یہ تشخیص نہیں ہے اور نہ ہی ہونے کا دعویٰ کرتا ہے۔ یہ ایک نقطہ آغاز ہے: اپنے بارے میں کچھ ٹھوس محسوس کرنا، اور اگر ضرورت ہو تو کسی حقیقی معالج کے ساتھ حقیقی گفتگو میں لے جانے کے لیے کچھ ٹھوس۔",
      ],
    },
  },
  {
    image: "forestCreek",
    en: {
      title: "How the three signals work together",
      body: [
        "Most self-assessments ask one kind of question and stop there - a mood questionnaire, a chatbot, or a wearable's guess from your heart rate. MindHx instead treats a check-in as three separate signals that don't always agree: how you sound (pause patterns, loudness variability, speaking pace), what you actually say in your own words rather than a multiple-choice answer, and how you score on PHQ-9, GAD-7, and K10 - the same validated questionnaires clinicians already use in practice.",
        "Each signal is scored on its own first, then combined into one weighted estimate. The combination isn't a black box: the results page shows exactly how much each signal contributed to the final number, using an additive model where each term's share is the real, mathematically exact contribution - not an approximate explanation added after the fact. If your voice sounded flat but your questionnaire answers were mild, or the other way around, you'll see that tension laid out honestly, not smoothed away inside a single tidy number.",
      ],
    },
    ur: {
      title: "تینوں اشارے مل کر کیسے کام کرتے ہیں",
      body: [
        "زیادہ تر خود جائزے ایک ہی طرح کے سوالات پوچھ کر رک جاتے ہیں - ایک موڈ سوالنامہ، ایک چیٹ بوٹ، یا کسی پہننے والے آلے کا دل کی دھڑکن سے اندازہ۔ MindHx اس کے برعکس ایک چیک ان کو تین الگ الگ اشاروں کے طور پر دیکھتا ہے جو ہمیشہ ایک دوسرے سے متفق نہیں ہوتے: آپ کیسے بولتے ہیں (خاموشی کے وقفے، آواز کی بلندی میں تبدیلی، بولنے کی رفتار)، آپ اصل میں اپنے الفاظ میں کیا کہتے ہیں (کثیر انتخابی جواب کی بجائے)، اور PHQ-9، GAD-7، اور K10 پر آپ کا اسکور - وہی مستند سوالنامے جو معالجین پہلے سے استعمال کرتے ہیں۔",
        "ہر اشارے کا پہلے الگ سے جائزہ لیا جاتا ہے، پھر انہیں ایک وزنی اندازے میں یکجا کیا جاتا ہے۔ یہ یکجائی ایک بند ڈبہ نہیں - نتائج کا صفحہ بالکل دکھاتا ہے کہ حتمی نمبر میں ہر اشارے کا کتنا حصہ تھا، ایک ایسے ماڈل کے ذریعے جس میں ہر حصے کا تناسب حقیقی، ریاضیاتی طور پر درست شراکت ہے - کوئی بعد میں جوڑی گئی تخمینی وضاحت نہیں۔ اگر آپ کی آواز بےرونق تھی مگر سوالنامے کے جوابات ہلکے تھے، یا اس کے برعکس، تو یہ تضاد ایمانداری سے سامنے آئے گا، ایک صاف نمبر کے اندر چھپایا نہیں جائے گا۔",
      ],
    },
  },
  {
    image: "goldenSea",
    en: {
      title: "What we keep, and what we don't",
      body: [
        "A screening tool that asks about your inner life only earns trust if it's honest about what happens to what you share. MindHx's default is to keep almost nothing. A voice note is analysed for acoustic features (pause ratio, loudness variability, speaking rate) and then discarded; MindHx never writes the audio to its database and no person listens to it. To turn speech into text and to read the tone of what you write, the audio and text are sent to OpenAI's API for processing - MindHx never keeps the audio, and keeps your words only inside your saved check-in report.",
        "Seeing your results needs an account, so they're there when you come back. Each check-in's scores are saved to it, along with your answer to each questionnaire item, which the MindHx team can review. The check-in's full PDF report is saved too - including what you said and wrote - so you can download it again and bring it to a doctor or therapist. That report is visible only to you, and you can delete it from your dashboard at any time.",
      ],
    },
    ur: {
      title: "ہم کیا محفوظ کرتے ہیں اور کیا نہیں",
      body: [
        "ایک اسکریننگ ذریعہ جو آپ کی اندرونی زندگی کے بارے میں پوچھتا ہے وہ اعتماد تب ہی حاصل کرتا ہے جب وہ اس بارے میں ایماندار ہو کہ آپ کی بتائی گئی باتوں کا کیا ہوتا ہے۔ MindHx کا طریقہ کار تقریباً کچھ بھی محفوظ نہ رکھنا ہے۔ صوتی پیغام کو صوتی خصوصیات (خاموشی کا تناسب، آواز کی بلندی میں تبدیلی، بولنے کی رفتار) کے لیے پراسیس کیا جاتا ہے اور پھر ضائع کر دیا جاتا ہے؛ MindHx آواز کو کبھی اپنے ڈیٹا بیس میں محفوظ نہیں کرتا اور نہ ہی کوئی شخص اسے سنتا ہے۔ آواز کو متن میں بدلنے اور آپ کے لکھے ہوئے کے لہجے کو سمجھنے کے لیے آواز اور متن OpenAI کی API کو پراسیسنگ کے لیے بھیجے جاتے ہیں - MindHx آواز کبھی محفوظ نہیں کرتا، اور آپ کے الفاظ صرف آپ کی محفوظ شدہ جائزہ رپورٹ میں رکھتا ہے۔",
        "نتائج دیکھنے کے لیے اکاؤنٹ ضروری ہے، تاکہ واپس آنے پر وہ موجود ہوں۔ اس میں ہر چیک ان کے اسکور محفوظ ہوتے ہیں، اور ساتھ ہی سوالنامے کے ہر سوال کا آپ کا جواب بھی، جسے MindHx کی ٹیم دیکھ سکتی ہے۔ چیک ان کی مکمل PDF رپورٹ بھی محفوظ ہوتی ہے - جس میں وہ بھی شامل ہے جو آپ نے کہا اور لکھا - تاکہ آپ اسے دوبارہ ڈاؤن لوڈ کر کے کسی ڈاکٹر یا معالج کے پاس لے جا سکیں۔ یہ رپورٹ صرف آپ کو نظر آتی ہے، اور آپ اسے اپنے ڈیش بورڈ سے کسی بھی وقت حذف کر سکتے ہیں۔",
      ],
    },
  },
  {
    image: "goldenField",
    en: {
      title: "From a private check-in to a real next step",
      body: [
        "A risk score by itself doesn't help anyone - what matters is what happens after it's shown to you. MindHx routes based on what it finds, not just what it scores. If PHQ-9's self-harm item or clear crisis language shows up when you ask for your results, emergency support comes first - ahead of any score, and without needing an account or a finished questionnaire - and the AI chat stops generating replies for the rest of that conversation.",
        "For everything else, the results page pairs your combined signal with a support plan matched to the themes it detected - grounding techniques for anxiety, small behavioral-activation steps for low motivation, pacing guidance after loss or trauma - alongside a bounded AI chat that answers orienting questions like “what does CBT actually involve” from a fixed reference library. When an AI model is configured, it words the reply conversationally, but only from that library and under strict rules: no diagnosis, no medication advice, and a fallback to the library text itself if a reply breaks those rules.",
        "When a real conversation with a professional is the right next step, MindHx tries to make that concrete too, rather than leaving it as vague advice: a city-by-city directory of verified psychiatric and psychological care in Pakistan, and a plain answer to what to actually say at a first appointment.",
      ],
    },
    ur: {
      title: "ایک نجی چیک ان سے ایک حقیقی اگلے قدم تک",
      body: [
        "صرف ایک خطرے کا اسکور کسی کی مدد نہیں کرتا - اہم بات یہ ہے کہ اسے دکھانے کے بعد کیا ہوتا ہے۔ MindHx اس کی بنیاد پر رہنمائی کرتا ہے جو اسے ملتا ہے، صرف اس پر نہیں جو وہ اسکور کرتا ہے۔ اگر نتائج مانگتے وقت PHQ-9 کا خود کو نقصان پہنچانے والا سوال یا واضح بحرانی زبان ظاہر ہو تو فوری مدد سب سے پہلے دکھائی جاتی ہے - کسی بھی اسکور سے پہلے، اور اکاؤنٹ یا مکمل سوالنامے کے بغیر بھی - اور AI چیٹ اس گفتگو میں مزید جوابات تیار کرنا بند کر دیتی ہے۔",
        "باقی تمام صورتوں میں، نتائج کا صفحہ آپ کے مجموعی اشارے کو شناخت شدہ موضوعات کے مطابق ایک معاون منصوبے سے جوڑتا ہے - اضطراب کے لیے گراؤنڈنگ تکنیکیں، کم حوصلے کے لیے چھوٹے عملی اقدامات، غم یا صدمے کے بعد رفتار کی رہنمائی - ساتھ ہی ایک محدود AI چیٹ جو 'CBT دراصل کیا ہے' جیسے رہنمائی کے سوالات کا جواب ایک مقررہ حوالہ جاتی لائبریری سے دیتی ہے۔ جب AI ماڈل فعال ہو تو وہ جواب کو گفتگو کے انداز میں لکھتا ہے، مگر صرف اسی لائبریری سے اور سخت اصولوں کے تحت: نہ تشخیص، نہ دوا کا مشورہ، اور اگر کوئی جواب ان اصولوں کو توڑے تو اس کی جگہ لائبریری کا اصل متن دکھایا جاتا ہے۔",
        "جب کسی ماہر سے حقیقی گفتگو ہی صحیح اگلا قدم ہو تو MindHx اسے بھی ٹھوس بنانے کی کوشش کرتا ہے، مبہم مشورہ چھوڑنے کی بجائے: پاکستان میں مستند نفسیاتی اور ذہنی صحت کی نگہداشت کی شہر بہ شہر ڈائریکٹری، اور پہلی ملاقات میں کیا کہنا ہے اس کا واضح جواب۔",
      ],
    },
  },
  {
    image: "foggyValley",
    en: {
      title: "Built with context, and honest about its limits",
      body: [
        "MindHx is bilingual by construction, not by afterthought: every page - the check-in itself, the AI chat, the therapist directory, even this paragraph - exists in both English and Urdu, switchable with a single tap in the header, with the entire layout correctly mirroring for Urdu's right-to-left script rather than just swapping words inside a left-to-right frame. That distinction matters in a country where a screening tool available only in English quietly excludes most of the people who might actually need it.",
        "Being built with that context also means being honest about what isn't finished yet. The combined risk score is a weighted heuristic, not a clinically calibrated probability - it hasn't been validated against real outcome data, and pretending otherwise would make it less trustworthy, not more. The Urdu translation of PHQ-9, GAD-7, and K10 is a careful draft for this session, not a licensed clinical instrument. The acoustic voice signal is an explicit heuristic proxy, deliberately built to be swapped for a real biomarker vendor later. None of that lives in fine print - it's stated plainly here and in the project's technical documentation, because a screening tool that oversells its own certainty is more dangerous than one that admits what it doesn't yet know.",
      ],
    },
    ur: {
      title: "سیاق کے ساتھ بنایا گیا، اور اپنی حدود کے بارے میں ایماندار",
      body: [
        "MindHx بنیادی طور پر دو لسانی بنایا گیا ہے، بعد میں سوچ کر نہیں: ہر صفحہ - چیک ان خود، AI چیٹ، معالج کی ڈائریکٹری، یہاں تک کہ یہ پیراگراف بھی - انگریزی اور اردو دونوں میں موجود ہے، ہیڈر میں ایک ہی کلک سے قابلِ تبدیل، اور پورا خاکہ اردو کی دائیں سے بائیں تحریر کے لیے درست طریقے سے پلٹتا ہے، نہ کہ محض بائیں سے دائیں فریم کے اندر الفاظ بدل دیے جاتے ہیں۔ یہ فرق اس ملک میں اہم ہے جہاں صرف انگریزی میں دستیاب ایک اسکریننگ ذریعہ خاموشی سے اکثر انہی لوگوں کو خارج کر دیتا ہے جنہیں اس کی سب سے زیادہ ضرورت ہو سکتی ہے۔",
        "اس تناظر کے ساتھ بنائے جانے کا مطلب یہ بھی ہے کہ جو ابھی مکمل نہیں اس کے بارے میں ایماندار رہا جائے۔ مجموعی خطرے کا اسکور ایک وزنی تخمینہ ہے، کوئی طبی طور پر مصدقہ امکان نہیں - اسے ابھی حقیقی نتائج کے ڈیٹا کے خلاف تصدیق نہیں کیا گیا، اور اس کے برعکس ظاہر کرنا اسے کم قابلِ اعتماد بنا دے گا، زیادہ نہیں۔ PHQ-9، GAD-7، اور K10 کا اردو ترجمہ اس سیشن کے لیے ایک محتاط مسودہ ہے، کوئی لائسنس یافتہ طبی آلہ نہیں۔ صوتی اشارہ ایک واضح تخمینی متبادل ہے، جسے جان بوجھ کر بعد میں ایک حقیقی بایومارکر فراہم کنندہ سے بدلنے کے لیے بنایا گیا ہے۔ ان میں سے کچھ بھی چھوٹے حروف میں چھپایا نہیں گیا - یہ یہاں اور پراجیکٹ کی تکنیکی دستاویزات میں صاف طور پر بیان کیا گیا ہے، کیونکہ ایک اسکریننگ ذریعہ جو اپنی یقین دہانی کو ضرورت سے زیادہ ظاہر کرے وہ اس سے زیادہ خطرناک ہے جو تسلیم کرے کہ وہ ابھی کیا نہیں جانتا۔",
      ],
    },
  },
  {
    image: "sunlitPathway",
    en: {
      title: "Who MindHx is for (and who needs more than this)",
      body: [
        "MindHx is built for someone who has noticed something is off - a lower mood, more worry than usual, sleep that isn't restoring them the way it used to - and would rather understand that a little before deciding what, if anything, to do next. It's meant to be a first look, not a last resort and not a running log to obsess over daily.",
        "It is explicitly not built for a mental-health emergency. If you or someone you're with may be in immediate danger, a local crisis line and MindHx's own Emergency Support page matter far more than any questionnaire score, and the app is built to get out of the way and point there directly the moment it detects that situation - before, not after, showing you a number. It's also not a substitute for ongoing care: for anyone already working with a therapist or psychiatrist, MindHx is at most a way to notice patterns between appointments, never a reason to skip one.",
      ],
    },
    ur: {
      title: "MindHx کس کے لیے ہے (اور کسے اس سے زیادہ کی ضرورت ہے)",
      body: [
        "MindHx اس شخص کے لیے بنایا گیا ہے جس نے کچھ محسوس کیا ہو کہ ٹھیک نہیں لگ رہا - موڈ کا کم ہونا، معمول سے زیادہ فکر، نیند جو پہلے کی طرح تازگی نہ دے - اور جو اگلا قدم اٹھانے سے پہلے اسے تھوڑا سمجھنا چاہتا ہو۔ اس کا مقصد ایک پہلی نظر ہونا ہے، آخری سہارا نہیں اور روزانہ جنون کی حد تک دیکھنے کے لیے کوئی جاری فہرست بھی نہیں۔",
        "یہ واضح طور پر ذہنی صحت کی ہنگامی صورتحال کے لیے نہیں بنایا گیا۔ اگر آپ یا آپ کے ساتھ کوئی شخص فوری خطرے میں ہو سکتا ہے تو ایک مقامی بحرانی ہیلپ لائن اور MindHx کا اپنا فوری مدد کا صفحہ کسی بھی سوالنامے کے اسکور سے کہیں زیادہ اہم ہیں، اور ایپ اس صورتحال کا پتہ چلتے ہی راستے سے ہٹ کر براہ راست وہاں رہنمائی کرنے کے لیے بنائی گئی ہے - نمبر دکھانے کے بعد نہیں، پہلے۔ یہ جاری نگہداشت کا متبادل بھی نہیں: جو کوئی پہلے ہی کسی معالج یا سائیکاٹرسٹ کے ساتھ کام کر رہا ہے، اس کے لیے MindHx زیادہ سے زیادہ ملاقاتوں کے درمیان انداز محسوس کرنے کا ایک طریقہ ہے، کبھی کسی ملاقات کو چھوڑنے کی وجہ نہیں۔",
      ],
    },
  },
];

export default function AboutClient() {
  const [language, setLanguage] = useLanguage();
  const text = copy[language];
  const isUrdu = language === "اردو";

  return (
    <>
    <main className="resource-page" dir={isUrdu ? "rtl" : "ltr"}>
      <DoodleSun className="doodle doodle-orange doodle-float-slow" style={{ top: "95px", right: "5%" }} />
      <DoodleLeaf className="doodle doodle-teal doodle-sway" style={{ top: "55%", left: "2%", width: "26px", height: "auto" }} />
      <SiteHeader language={language} onToggleLanguage={() => setLanguage(isUrdu ? "English" : "اردو")} backLabel={text.back} />
      <section className="resource-hero">
        <p className="eyebrow">{text.eyebrow}</p>
        <h1>{text.title}</h1>
        <p>{text.intro}</p>
      </section>
      <section className="about-mindhx about-mindhx-page">
        {ABOUT_SECTIONS.map((item, index) => {
          const content = item[isUrdu ? "ur" : "en"];
          return (
            <article key={content.title} className={`about-block ${index % 2 === 1 ? "about-block-reverse" : ""}`}>
              <div className="about-text">
                <h3>{content.title}</h3>
                {content.body.map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)}
              </div>
              <div className="about-image"><NatureBanner {...naturePhotos[item.image]} /></div>
            </article>
          );
        })}
      </section>
    </main>
    <SiteFooter language={language} />
    </>
  );
}
