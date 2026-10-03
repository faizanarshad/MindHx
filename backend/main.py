"""MindHx assessment API. The screening/risk-assessment endpoints are fully
stateless and require no account. Accounts (backend/auth.py, database.py,
models.py) are an optional, separate feature purely for people who choose
to save their check-in history across visits."""

import json
import logging
import os
import re
import secrets
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any, Literal, Optional

import httpx
import numpy as np
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import (
    PASSWORD_RESET_EXPIRE_MINUTES,
    AuthContext,
    as_aware_utc,
    create_access_token,
    end_login_sessions,
    generate_reset_token,
    get_current_admin,
    get_current_auth,
    get_current_user,
    get_optional_current_user,
    hash_password,
    hash_reset_token,
    password_too_long,
    start_login_session,
    verify_password,
)
from database import get_db, init_db
from mailer import send_email
from models import CheckIn, CheckInReport, HelpfulPractice, LoginSession, MoodCheckIn, PageView, PasswordResetToken, Resource, User
from ratelimit import rate_limit

logger = logging.getLogger("mindhx")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


WEB_ORIGIN = os.getenv("WEB_ORIGIN", "http://localhost:3000")

# Admin access is granted only with `python backend/manage.py promote <email>`
# (see manage.py for why it's no longer an ADMIN_EMAILS env var).

app = FastAPI(title="MindHx API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[WEB_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Deterministic crisis phrases, matched as substrings after lowercasing,
# collapsing whitespace, and straightening curly apostrophes (see
# has_crisis_language). This is the only crisis check when no LLM is
# configured, so it deliberately favours catching indirect phrasings
# ("no reason to live") over avoiding false positives - a false positive
# shows someone help they didn't need; a miss hides it from someone who
# did. Bare words like "die" are left out: they're too common in ordinary
# text ("I'd die for a holiday") to be useful on their own.
CRISIS_TERMS = {
    # English
    "kill myself", "killing myself", "suicide", "suicidal", "end my life", "ending my life",
    "take my own life", "take my life", "hurt myself", "hurting myself", "harm myself",
    "self harm", "self-harm", "cut myself", "cutting myself", "hang myself", "overdose",
    "better off dead", "better off without me", "want to die", "wanna die", "wish i was dead",
    "wish i were dead", "want to be dead", "don't want to live", "dont want to live",
    "don't want to be alive", "dont want to be alive", "no reason to live", "nothing to live for",
    "not worth living", "end it all", "ending it all", "can't go on", "cant go on",
    # Roman Urdu
    "khudkushi", "khud kushi", "khudkashi", "khud kashi", "apni jaan", "marna chahta",
    "marna chahti", "mar jana chahta", "mar jana chahti", "jeena nahi chahta", "jeena nahi chahti",
    "jina nahi chahta", "jina nahi chahti", "zindagi khatam",
    # Urdu
    "خودکشی", "خود کشی", "اپنی جان", "مر جانا", "مرنا چاہتا", "مرنا چاہتی", "جینا نہیں چاہتا",
    "جینا نہیں چاہتی", "زندگی ختم", "خود کو نقصان",
}


class TextAnalysisRequest(BaseModel):
    text: str = Field(default="", max_length=10000)
    language: str = "en"


class SupportResourcesRequest(BaseModel):
    themes: list[str] = Field(default_factory=list, max_length=5)
    language: str = "en"


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ScreeningContext(BaseModel):
    band: Optional[str] = Field(default=None, max_length=20)
    risk_score: Optional[float] = Field(default=None, ge=0, le=1)
    themes: list[str] = Field(default_factory=list, max_length=10)
    phq9_score: Optional[int] = Field(default=None, ge=0, le=27)
    gad7_score: Optional[int] = Field(default=None, ge=0, le=21)
    k10_score: Optional[int] = Field(default=None, ge=0, le=50)


class AiSupportRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    language: str = "en"
    risk_clear: bool = True
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)
    screening_context: Optional[ScreeningContext] = None
    mood_checkins: list[int] = Field(default_factory=list, max_length=14)
    helpful_practices: list[str] = Field(default_factory=list, max_length=10)


class MoodCheckInCreateRequest(BaseModel):
    mood: int = Field(ge=1, le=5)


class HelpfulPracticeRequest(BaseModel):
    practice_name: str = Field(min_length=1, max_length=100)


RAG_DOCUMENTS = [
    {
        "id": "grounding", "intent": "anxiety", "link": "/meditation",
        "en": {
            "title": "Grounding and anxious thoughts",
            "content": "The 5-4-3-2-1 technique works by shifting attention away from anxious or racing thoughts and onto your immediate senses, which can help interrupt a spiral of worry. Slowly name five things you can see, four things you can feel (like your feet on the floor or the texture of your clothing), three things you can hear, two things you can smell, and one thing you can taste. There's no need to rush - if a particular sense is hard to notice right now, just move to the next one. This is a general grounding technique, not a treatment for an anxiety disorder. If anxiety continues to interfere with daily life, sleep, or relationships, consider speaking with a qualified professional who can properly assess what's happening and discuss options such as therapy.",
        },
        "ur": {
            "title": "گراؤنڈنگ اور بےچین خیالات",
            "content": "5-4-3-2-1 تکنیک توجہ کو بےچین یا تیزی سے دوڑتے خیالات سے ہٹا کر آپ کے فوری حواس کی طرف لے جاتی ہے، جو فکر کے چکر کو روکنے میں مدد دے سکتی ہے۔ آہستہ آہستہ پانچ چیزیں جو آپ دیکھ سکتے ہیں، چار چیزیں جو محسوس کر سکتے ہیں (جیسے پاؤں کا فرش پر ہونا یا کپڑے کی ساخت)، تین چیزیں جو سن سکتے ہیں، دو چیزیں جن کی خوشبو محسوس ہو، اور ایک چیز جس کا ذائقہ محسوس ہو، نام لیں۔ جلدی کرنے کی ضرورت نہیں - اگر کوئی خاص حس ابھی محسوس کرنا مشکل ہو تو اگلی طرف بڑھ جائیں۔ یہ ایک عمومی گراؤنڈنگ تکنیک ہے، اضطرابی مرض کا علاج نہیں۔ اگر بےچینی روزمرہ زندگی، نیند، یا تعلقات میں مسلسل مداخلت کرے تو ایک مستند ماہر سے بات کرنے پر غور کریں جو صورتحال کا صحیح جائزہ لے کر تھراپی جیسے اختیارات پر گفتگو کر سکے۔",
        },
    },
    {
        "id": "small-action", "intent": "depression", "link": "/meditation",
        "en": {
            "title": "One small achievable action",
            "content": "When motivation and energy are low, waiting to \"feel ready\" can keep things stuck. Behavioral activation works the other way around: doing one small, concrete thing first, and letting the feeling follow. Choose one manageable action for the next hour, such as drinking a glass of water, opening a window for fresh air, stepping outside for a short walk, or sending one message to someone you trust. Keep the goal deliberately small so it's achievable even on a hard day. Small actions do not replace treatment, but they can create a starting point and interrupt withdrawal. If low mood, low energy, or loss of interest continue for most of the day, most days, over two weeks or more, that's worth discussing with a professional.",
        },
        "ur": {
            "title": "ایک چھوٹا سا قابلِ حصول قدم",
            "content": "جب حوصلہ اور توانائی کم ہو تو 'تیار محسوس کرنے' کا انتظار چیزوں کو رکا ہوا رکھ سکتا ہے۔ رویے پر مبنی محرک اس کے برعکس کام کرتا ہے: پہلے ایک چھوٹا، ٹھوس کام کرنا، اور احساس کو بعد میں آنے دینا۔ اگلے ایک گھنٹے کے لیے ایک قابلِ انتظام کام منتخب کریں، جیسے ایک گلاس پانی پینا، تازہ ہوا کے لیے کھڑکی کھولنا، مختصر سیر کے لیے باہر جانا، یا کسی قابلِ اعتماد شخص کو ایک پیغام بھیجنا۔ ہدف کو جان بوجھ کر اتنا چھوٹا رکھیں کہ مشکل دن میں بھی قابلِ حصول ہو۔ چھوٹے اقدامات علاج کا متبادل نہیں، لیکن یہ ایک نقطہ آغاز بنا سکتے ہیں اور پیچھے ہٹنے کے عمل کو روک سکتے ہیں۔ اگر کم موڈ، کم توانائی، یا دلچسپی کی کمی دو ہفتوں یا اس سے زیادہ عرصے تک، زیادہ تر دن، زیادہ تر وقت جاری رہے، تو یہ ایک ماہر سے گفتگو کے قابل ہے۔",
        },
    },
    {
        "id": "therapy", "intent": "therapy", "link": "/therapies",
        "en": {
            "title": "Therapy approaches",
            "content": "There isn't a single \"right\" therapy - different approaches suit different needs. Cognitive behavioral therapy (CBT) examines the links between thoughts, feelings, and behavior through structured sessions and between-session exercises. Dialectical behavior therapy (DBT) builds skills in emotion regulation, distress tolerance, and interpersonal effectiveness. Exposure therapy gradually and safely addresses specific fears or anxiety triggers under a clinician's guidance. Trauma-informed care prioritizes safety, pacing, and choice when trauma may be a factor. A medical review can also rule out physical contributors like sleep, thyroid, or medication effects. A licensed clinician can help match the approach to your specific circumstances - you don't need to figure this out alone.",
        },
        "ur": {
            "title": "تھراپی کے طریقے",
            "content": "کوئی ایک 'درست' تھراپی نہیں ہوتی - مختلف طریقے مختلف ضروریات کے لیے موزوں ہوتے ہیں۔ کوگنیٹو بیہیویورل تھراپی (CBT) منظم سیشنز اور سیشنز کے درمیان مشقوں کے ذریعے خیالات، جذبات، اور رویے کے تعلق کو دیکھتی ہے۔ ڈائلیکٹیکل بیہیویورل تھراپی (DBT) جذباتی توازن، تکلیف برداشت کرنے، اور باہمی تعلقات کی مہارتیں پیدا کرتی ہے۔ ایکسپوژر تھراپی ایک معالج کی رہنمائی میں مخصوص خوف یا اضطراب کے محرکات کو آہستہ آہستہ اور محفوظ طریقے سے حل کرتی ہے۔ صدمے سے آگاہ نگہداشت حفاظت، رفتار، اور انتخاب کو ترجیح دیتی ہے جب صدمہ ایک عنصر ہو سکتا ہے۔ ایک طبی جائزہ نیند، تھائیرائیڈ، یا ادویات کے اثرات جیسے جسمانی اسباب کو بھی خارج کر سکتا ہے۔ ایک مستند معالج آپ کے مخصوص حالات کے مطابق طریقہ منتخب کرنے میں مدد کر سکتا ہے - آپ کو یہ اکیلے سمجھنے کی ضرورت نہیں۔",
        },
    },
    {
        "id": "medication", "intent": "medication", "link": "/medication",
        "en": {
            "title": "Medication information",
            "content": "Medication can be part of treatment for some mental-health conditions, but the right choice - if any - depends on individual factors like diagnosis, medical history, other medications, and personal response, which only a licensed prescriber can properly evaluate. Common examples referenced in general education include SSRIs for depression and some anxiety disorders, and short-term options for acute anxiety symptoms under close supervision; each carries different considerations around side effects, dependence, and interactions. Do not start, stop, or change any medication based on this chat. If you're currently prescribed something and have concerns, or are considering medication for the first time, that conversation belongs with your prescriber, who can review your full picture safely.",
        },
        "ur": {
            "title": "ادویات کی معلومات",
            "content": "کچھ ذہنی صحت کی کیفیات کے علاج میں ادویات شامل ہو سکتی ہیں، لیکن صحیح انتخاب - اگر کوئی ہو - تشخیص، طبی تاریخ، دیگر ادویات، اور ذاتی ردعمل جیسے انفرادی عوامل پر منحصر ہوتا ہے، جن کا صحیح جائزہ صرف ایک مستند تجویز کنندہ لے سکتا ہے۔ عمومی تعلیم میں حوالہ دی جانے والی عام مثالوں میں ڈپریشن اور کچھ اضطرابی امراض کے لیے ایس ایس آر آئیز، اور قریبی نگرانی میں شدید اضطراب کی علامات کے لیے قلیل مدتی اختیارات شامل ہیں؛ ہر ایک کے ساتھ ضمنی اثرات، انحصار، اور تعامل کے مختلف پہلو جڑے ہیں۔ اس گفتگو کی بنیاد پر کوئی دوا شروع، بند، یا تبدیل نہ کریں۔ اگر آپ فی الوقت کوئی دوا لے رہے ہیں اور خدشات رکھتے ہیں، یا پہلی بار ادویات پر غور کر رہے ہیں، تو یہ گفتگو آپ کے تجویز کنندہ کے ساتھ ہونی چاہیے، جو آپ کی مکمل صورتحال کا محفوظ طریقے سے جائزہ لے سکے۔",
        },
    },
    {
        "id": "family-stigma", "intent": "family_stigma", "link": "/therapist",
        "en": {
            "title": "Family expectations and stigma around seeking help",
            "content": "Talking about mental health with family can feel complicated, especially where seeking help is sometimes seen as weakness, family shame, or something to hide rather than an ordinary health matter. You don't have to disclose everything to everyone at once, or at all - many people start by speaking privately with one trusted person, a doctor, or a counselor before deciding what, if anything, to share with family. If pressure around marriage, career choices, or \"log kya kahenge\" (what will people say) is part of what's weighing on you, that pressure is real and worth naming, not something to just push through silently. A mental-health professional can also help you think through how and whether to involve family, at your own pace, without deciding that for you.",
        },
        "ur": {
            "title": "خاندانی توقعات اور مدد لینے کے حوالے سے بدنامی کا خوف",
            "content": "خاندان کے ساتھ ذہنی صحت پر بات کرنا مشکل لگ سکتا ہے، خاص طور پر جہاں مدد لینا کبھی کبھار کمزوری، خاندانی بدنامی، یا چھپانے کی چیز سمجھا جاتا ہے، نہ کہ ایک عام صحت کا معاملہ۔ آپ کو ایک ساتھ سب کچھ سب کو بتانے کی ضرورت نہیں، یا بالکل بھی نہیں - بہت سے لوگ پہلے کسی ایک قابلِ اعتماد شخص، ڈاکٹر، یا مشیر سے نجی طور پر بات کرتے ہیں، پھر طے کرتے ہیں کہ خاندان کو کیا بتانا ہے۔ اگر شادی، کیریئر کے فیصلوں، یا 'لوگ کیا کہیں گے' کا دباؤ آپ پر بوجھ ہے، تو یہ دباؤ حقیقی ہے اور اسے نظرانداز کرنے کے بجائے تسلیم کرنا چاہیے۔ ایک ذہنی صحت کا ماہر آپ کو یہ سوچنے میں بھی مدد دے سکتا ہے کہ خاندان کو کیسے اور کب شامل کرنا ہے، آپ کی اپنی رفتار سے۔",
        },
    },
    {
        "id": "exam-work-pressure", "intent": "exam_pressure", "link": "/meditation",
        "en": {
            "title": "Exam, academic, and work pressure",
            "content": "Board exams, entrance tests, competition for limited university seats, or job pressure can create stress that feels constant rather than occasional. It's common to tie your entire sense of worth to a single result, especially when family expectations or financial sacrifice are attached to it. A few things that can make this more manageable: breaking a large goal into smaller weekly targets, protecting basic sleep even during intense study or work periods, and telling one person - a teacher, family member, or counselor - about the pressure rather than carrying it alone. If the stress is affecting sleep, appetite, or concentration most days for two weeks or more, that's worth a conversation with a professional, separate from the exam or deadline itself.",
        },
        "ur": {
            "title": "امتحان، تعلیمی، اور کام کا دباؤ",
            "content": "بورڈ کے امتحانات، داخلہ ٹیسٹ، محدود یونیورسٹی نشستوں کا مقابلہ، یا نوکری کا دباؤ ایسا تناؤ پیدا کر سکتا ہے جو مسلسل محسوس ہو، کبھی کبھار نہیں۔ اکثر لوگ اپنی پوری قدر ایک نتیجے سے جوڑ دیتے ہیں، خاص طور پر جب خاندانی توقعات یا مالی قربانی اس کے ساتھ جڑی ہوں۔ اسے قابلِ انتظام بنانے کے کچھ طریقے: بڑے ہدف کو چھوٹے ہفتہ وار اہداف میں تقسیم کرنا، شدید پڑھائی یا کام کے دوران بھی بنیادی نیند کا خیال رکھنا، اور دباؤ اکیلے اٹھانے کے بجائے کسی ایک شخص - استاد، خاندان کے فرد، یا مشیر - کو بتانا۔ اگر تناؤ نیند، بھوک، یا توجہ کو دو ہفتوں یا اس سے زیادہ عرصے تک، زیادہ تر دن متاثر کر رہا ہو، تو امتحان یا ڈیڈ لائن سے الگ، کسی ماہر سے بات کرنا فائدہ مند ہوگا۔",
        },
    },
]

INTERACTIVE_EXERCISES = {
    "478-breathing": {
        "en": {"name": "4-7-8 breathing", "steps": [
            {"instruction": "Breathe in quietly through your nose", "seconds": 4},
            {"instruction": "Hold your breath", "seconds": 7},
            {"instruction": "Exhale completely through your mouth, making a whoosh sound", "seconds": 8},
        ]},
        "ur": {"name": "4-7-8 سانس کی مشق", "steps": [
            {"instruction": "ناک سے آہستہ سانس اندر لیں", "seconds": 4},
            {"instruction": "سانس روکیں", "seconds": 7},
            {"instruction": "منہ سے مکمل سانس باہر نکالیں", "seconds": 8},
        ]},
    },
    "grounding-54321": {
        "en": {"name": "5-4-3-2-1 grounding", "steps": [
            {"instruction": "Name 5 things you can see", "seconds": 20},
            {"instruction": "Name 4 things you can feel", "seconds": 20},
            {"instruction": "Name 3 things you can hear", "seconds": 15},
            {"instruction": "Name 2 things you can smell", "seconds": 15},
            {"instruction": "Name 1 thing you can taste", "seconds": 10},
        ]},
        "ur": {"name": "5-4-3-2-1 گراؤنڈنگ", "steps": [
            {"instruction": "5 چیزیں جو آپ دیکھ سکتے ہیں بتائیں", "seconds": 20},
            {"instruction": "4 چیزیں جو محسوس کر سکتے ہیں", "seconds": 20},
            {"instruction": "3 چیزیں جو سن سکتے ہیں", "seconds": 15},
            {"instruction": "2 چیزیں جن کی خوشبو محسوس ہو", "seconds": 15},
            {"instruction": "1 چیز جس کا ذائقہ محسوس ہو", "seconds": 10},
        ]},
    },
}


class Profile(BaseModel):
    age_range: str = Field(min_length=1, max_length=20)
    gender: Optional[str] = Field(default=None, max_length=40)
    marital_status: Optional[str] = Field(default=None, max_length=40)
    life_context: Optional[str] = Field(default=None, max_length=40)
    preferred_language: str = Field(default="en", max_length=10)


class SessionStartRequest(BaseModel):
    profile: Profile


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    age_range: Optional[str] = Field(default=None, max_length=20)
    full_name: Optional[str] = Field(default=None, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=30)
    gender: Optional[str] = Field(default=None, max_length=40)
    marital_status: Optional[str] = Field(default=None, max_length=40)
    life_context: Optional[str] = Field(default=None, max_length=40)
    preferred_language: Optional[str] = Field(default=None, max_length=10)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=30)
    age_range: Optional[str] = Field(default=None, max_length=20)
    gender: Optional[str] = Field(default=None, max_length=40)
    marital_status: Optional[str] = Field(default=None, max_length=40)
    life_context: Optional[str] = Field(default=None, max_length=40)
    preferred_language: Optional[str] = Field(default=None, max_length=10)
    # A data: URL (e.g. "data:image/jpeg;base64,..."). The client resizes to
    # ~256px before sending; this cap (roughly 400KB of base64, ~300KB of
    # actual image data) is a server-side backstop against something much
    # larger arriving from a non-standard client, not the primary control.
    avatar_data_url: Optional[str] = Field(default=None, max_length=400_000)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10, max_length=256)
    new_password: str = Field(min_length=8, max_length=72)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)


FrequencyAnswer = Annotated[int, Field(ge=0, le=3)]
K10Answer = Annotated[int, Field(ge=1, le=5)]


class QuestionnaireAnswers(BaseModel):
    """The individual item answers, in the same scales /risk-assess takes:
    PHQ-9/GAD-7 0-3, K10 1-5. Strict (exact lengths and ranges) because,
    unlike components/support_plan, admins read these item by item."""
    phq9: list[FrequencyAnswer] = Field(min_length=9, max_length=9)
    gad7: list[FrequencyAnswer] = Field(min_length=7, max_length=7)
    k10: list[K10Answer] = Field(min_length=10, max_length=10)


class CheckInCreateRequest(BaseModel):
    risk_score: float = Field(ge=0, le=1)
    band: str = Field(max_length=20)
    routing_decision: str = Field(max_length=30)
    themes: list[str] = Field(default_factory=list, max_length=10)
    # Every section's structured result - the same components/support_plan
    # shape /risk-assess already returns. Deliberately just the two loose
    # dicts rather than a strict nested schema (their shape already varies -
    # e.g. voice.emotion and attribution are only present when available),
    # and no field for transcript/typed_text - those are saved only inside
    # the PDF report (PUT /checkins/{id}/report), so the owner can delete
    # them without losing their score history.
    components: Optional[dict] = None
    support_plan: Optional[dict] = None
    # Optional so older clients (and check-ins without complete
    # questionnaires) can still save; visible to admins only.
    answers: Optional[QuestionnaireAnswers] = None


RESOURCE_TYPES = {"meditation", "therapy", "medication", "general"}
# A saved check-in's components + support plan serialize to a few KB; this
# is a backstop against an oversized body from a non-standard client.
MAX_CHECKIN_DETAILS_CHARS = 100_000
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class ResourceCreateRequest(BaseModel):
    resource_type: str = Field(max_length=20)
    slug: str = Field(min_length=1, max_length=160)
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(default="", max_length=400)
    body: str = Field(default="", max_length=20_000)
    # A data: URL, client-resized before it gets here - same size backstop
    # rationale as ProfileUpdateRequest.avatar_data_url.
    image_data_url: Optional[str] = Field(default=None, max_length=1_500_000)
    published: bool = True


class ResourceUpdateRequest(BaseModel):
    """Partial update, same model_dump(exclude_unset=True) pattern as
    ProfileUpdateRequest - only fields present in the request body change."""
    resource_type: Optional[str] = Field(default=None, max_length=20)
    slug: Optional[str] = Field(default=None, min_length=1, max_length=160)
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    summary: Optional[str] = Field(default=None, max_length=400)
    body: Optional[str] = Field(default=None, max_length=20_000)
    image_data_url: Optional[str] = Field(default=None, max_length=1_500_000)
    published: Optional[bool] = None


class PageViewRequest(BaseModel):
    # Deliberately just a path - no IP, user agent, referrer, or any
    # identifier is ever recorded, matching this app's existing minimal-data
    # posture (see CheckIn/models.py's docstring). Good enough for "how many
    # visits, to which pages, over time" without being visitor tracking.
    path: str = Field(min_length=1, max_length=300)


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language: str = "ur"


class Phq9Request(BaseModel):
    answers: list[int] = Field(min_length=9, max_length=9)
    session_token: Optional[str] = Field(default=None, max_length=128)


class QuestionnaireRequest(BaseModel):
    answers: list[int] = Field(min_length=1, max_length=10)


class RiskAssessmentRequest(BaseModel):
    transcript: str = Field(default="", max_length=10000)
    typed_text: str = Field(default="", max_length=10000)
    language: str = "en"
    phq9_answers: list[int] = Field(min_length=9, max_length=9)
    gad7_answers: list[int] = Field(default_factory=lambda: [0] * 7, min_length=7, max_length=7)
    k10_answers: list[int] = Field(default_factory=lambda: [1] * 10, min_length=10, max_length=10)
    text_analysis: dict = Field(default_factory=dict)
    phq9_result: dict = Field(default_factory=dict)
    profile: Optional[Profile] = None
    voice_features: dict[str, Any] = Field(default_factory=dict)


def has_crisis_language(text: str) -> bool:
    normalized = " ".join(text.lower().replace("’", "'").replace("‘", "'").split())
    return any(term in normalized for term in CRISIS_TERMS)


def is_urdu_script(text: str) -> bool:
    """True if a meaningful share of the letters in text are Urdu/Arabic script.
    Used to reject an LLM-composed reply that ignored the "reply in Urdu"
    instruction - short brand names, numbers, and scale names (MindHx, PHQ-9)
    are expected inline even in a correct Urdu reply, so this only checks the
    letters, not the whole string."""
    urdu_letters = sum(1 for ch in text if "؀" <= ch <= "ۿ")
    latin_letters = sum(1 for ch in text if ch.isalpha() and ch.isascii())
    total_letters = urdu_letters + latin_letters
    if total_letters == 0:
        return True
    return (urdu_letters / total_letters) >= 0.4


def retrieve_rag_documents(message: str) -> list[dict]:
    lowered = message.lower()
    terms = {
        "anxiety": ("anx", "worry", "panic", "نروس", "فکر", "گھبرا"),
        "depression": ("sad", "empty", "motivation", "depress", "اداس", "مایوس"),
        "therapy": ("therap", "counsel", "relationship", "تھراپی", "مشیر"),
        "medication": ("medicine", "medication", "drug", "دوا", "دوائی"),
        "family_stigma": ("family", "shame", "stigma", "log kya kahenge", "khandaan", "خاندان", "شرم", "بدنامی", "لوگ کیا کہیں گے"),
        "exam_pressure": ("exam", "test", "study", "studies", "university", "admission", "job pressure", "deadline", "امتحان", "پڑھائی", "داخلہ", "نوکری کا دباؤ"),
    }
    matched = [intent for intent, keywords in terms.items() if any(keyword in lowered for keyword in keywords)]
    return [document for document in RAG_DOCUMENTS if document["intent"] in matched] or [RAG_DOCUMENTS[0]]


def localize_rag_document(document: dict, language: str) -> dict:
    locale = document["ur"] if language == "ur" else document["en"]
    return {"id": document["id"], "title": locale["title"], "content": locale["content"], "link": document["link"]}


def severity_for(score: int) -> str:
    if score <= 4:
        return "minimal"
    if score <= 9:
        return "mild"
    if score <= 14:
        return "moderate"
    if score <= 19:
        return "moderately_severe"
    return "severe"


def gad7_band(score: int) -> str:
    if score <= 4:
        return "minimal"
    if score <= 9:
        return "mild"
    if score <= 14:
        return "moderate"
    return "severe"


def k10_band(score: int) -> str:
    if score <= 19:
        return "low"
    if score <= 24:
        return "mild"
    if score <= 29:
        return "moderate"
    return "severe"


def score_gad7(answers: list[int]) -> dict:
    normalized = [max(0, min(3, answer)) for answer in answers]
    total_score = sum(normalized)
    return {"total_score": total_score, "severity_band": gad7_band(total_score)}


def score_k10(answers: list[int]) -> dict:
    normalized = [max(1, min(5, answer)) for answer in answers]
    total_score = sum(normalized)
    return {"total_score": total_score, "severity_band": k10_band(total_score)}


def support_resources(themes: list[str], language: str = "en") -> dict:
    """Return fixed, non-diagnostic support content; no model or profile data is required."""
    theme_set = set(themes)
    strategies = [
        {"name": "One small action", "themes": ["hardship", "patience"], "steps": "Choose one achievable action for the next hour, such as water, food, a shower, or messaging someone you trust."},
        {"name": "Gentle routine", "themes": ["depression", "hardship"], "steps": "Pick one anchor for today: wake time, a meal, daylight, or a 5-minute walk. Keep the goal deliberately small."},
        {"name": "Worry notes", "themes": ["anxiety"], "steps": "Write the worry down, separate what you can control from what you cannot, and choose one next action."},
        {"name": "Grief pacing", "themes": ["grief", "patience"], "steps": "Allow the feeling without forcing a timeline. Alternate emotional space with basic care, rest, and contact with someone safe."},
        {"name": "Cool-down pause", "themes": ["frustration"], "steps": "Step away for 2 minutes, unclench your jaw and shoulders, and name what specifically triggered the frustration before responding."},
        {"name": "Loss processing", "themes": ["loss"], "steps": "Acknowledge what changed, allow yourself an adjustment period, and identify one practical next step for the coming week."},
        {"name": "Grounding after distress", "themes": ["trauma"], "steps": "Orient to the present: name the room, the date, and one safe fact. Trauma-focused work is best done with a qualified trauma-informed clinician."},
    ]
    meditation = [
        {"name": "Paced breathing", "themes": ["anxiety", "hardship"], "steps": "Inhale gently for 4 counts and exhale for 6 counts for 2 minutes. Stop if dizzy or more distressed."},
        {"name": "Five-senses grounding", "themes": ["anxiety", "hardship"], "steps": "Notice 5 things you see, 4 you feel, 3 you hear, 2 you smell, and 1 you taste."},
        {"name": "Compassionate body scan", "themes": ["patience", "grief", "hardship"], "steps": "For 3 minutes, notice tension from head to feet without judging it. Relax only where comfortable."},
        {"name": "Name and allow", "themes": ["grief", "patience"], "steps": "Name the feeling in a few words, acknowledge it, and give it 90 seconds without forcing it away."},
        {"name": "Cooling breath", "themes": ["frustration"], "steps": "Inhale through the nose for 4 counts, exhale slowly through pursed lips for 6 counts, and repeat for 2 minutes."},
        {"name": "Anchoring statement", "themes": ["loss"], "steps": "Repeat a brief steadying phrase (e.g. \"this is hard, and I am getting through it\") while breathing slowly for 1-2 minutes."},
        {"name": "Safe-place visualization", "themes": ["trauma"], "steps": "Picture a place where you have felt calm and safe and notice its details for 2-3 minutes. Stop if this increases distress and seek trauma-informed professional support."},
    ]
    groups = [
        {"name": "Peer support groups", "description": "Look for a moderated, confidential group through a licensed clinic, hospital, university, or established mental-health organization."},
        {"name": "Trusted-person check-in", "description": "Choose one person and tell them what kind of support would help: listening, company, or help finding care."},
    ]
    resources = [
        {"name": "Licensed mental-health professional", "description": "Use a regulated local provider directory, hospital service, or telehealth service for an assessment."},
        {"name": "Local crisis service", "description": "For immediate safety concerns, contact local emergency services or a crisis line in your country."},
    ]
    return {
        "language": language,
        "themes": themes,
        "strategies": [item for item in strategies if not theme_set or theme_set.intersection(item["themes"])],
        "meditation": [item for item in meditation if not theme_set or theme_set.intersection(item["themes"])],
        "support_groups": groups,
        "resources": resources,
    }


def professional_contact(urgency: str) -> dict:
    if urgency == "immediate":
        return {"recommended": True, "urgency": "immediate", "action": "Contact local emergency services or a crisis line now, and stay with a trusted person if possible.", "what_to_say": "Tell them you are experiencing a mental-health safety concern and need immediate support."}
    if urgency == "soon":
        return {"recommended": True, "urgency": "soon", "action": "Arrange a call or appointment with a licensed psychiatrist or qualified mental-health clinician before continuing self-management alone.", "what_to_say": "Share that your screening results show moderate or severe symptoms and ask for a safety and treatment review."}
    return {"recommended": False, "urgency": "monitor", "action": "Consider speaking with a qualified professional if symptoms persist, worsen, or interfere with daily life.", "what_to_say": "You can bring these screening results to the conversation."}


THEME_KEYWORDS = {
    "trauma": ("trauma", "ptsd", "flashback", "abuse", "assault", "molest", "صدمہ", "زیادتی", "تشدد"),
    "grief": ("bereav", "passed away", "died", "death of", "funeral", "غم", "وفات", "انتقال"),
    "loss": ("lost my job", "lost my", "breakup", "broke up", "divorce", "miscarriage", "طلاق", "نوکری چلی گئی", "کھو دیا"),
    "frustration": ("frustrat", "irritat", "fed up", "annoyed", "so angry", "غصہ", "چڑچڑا", "تنگ آ"),
    "anxiety": ("anx", "worry", "worried", "panic", "نروس", "فکر", "گھبرا"),
    "medical_state": ("in pain", "medical condition", "illness", "chronic pain", "درد", "بیماری", "علاج"),
}


# Every theme classify_themes can return.
KNOWN_THEMES = set(THEME_KEYWORDS) | {"hardship", "patience"}


def classify_themes(phq_result: dict, gad_result: dict, k10_result: dict, text_result: dict, raw_text: str = "") -> list[str]:
    """Themes are derived from the raw check-in text (not text_result['keyword_flags'], which
    only ever holds a small fixed sentiment vocabulary and would never match these terms)."""
    themes: list[str] = []
    phq_score = int(phq_result.get("total_score", 0))
    gad_score = int(gad_result.get("total_score", 0))
    k10_score = int(k10_result.get("total_score", 0))
    lowered = raw_text.lower()

    def mentions(theme: str) -> bool:
        return any(term in lowered for term in THEME_KEYWORDS[theme])

    if mentions("trauma"):
        themes.append("trauma")
    if mentions("grief"):
        themes.append("grief")
    if mentions("loss") and "grief" not in themes:
        themes.append("loss")
    if mentions("frustration"):
        themes.append("frustration")
    if (gad_score >= 10 and phq_score < 10) or mentions("anxiety"):
        if "anxiety" not in themes:
            themes.append("anxiety")
    if phq_score >= 10 and not {"grief", "loss", "trauma"} & set(themes):
        themes.append("hardship")
    if k10_score >= 25 and "hardship" not in themes:
        themes.append("hardship")
    if mentions("medical_state"):
        themes.append("medical_state")
    return themes or ["patience"]


# --- Linguistic markers beyond sentiment ---
# A single positive/negative/neutral label collapses a lot of information a
# free-text check-in actually carries. These lexicons back a second,
# independent read of the same text: word-level markers with a real basis in
# computational-psycholinguistics research on depression/anxiety forums
# (elevated first-person-singular usage: Rude, Gortner & Pennebaker 2004;
# absolutist words like "always"/"never"/"completely": Al-Mosaiwi & Johnstone
# 2018) - not a diagnosis, and not fitted to labeled MindHx data. Bilingual
# (English + Urdu), same substring-matching style as THEME_KEYWORDS above.
LINGUISTIC_MARKER_TERMS = {
    "anxiety": (
        "anxious", "anxiety", "worried", "worry", "worrying", "panic", "panicking", "nervous",
        "on edge", "restless", "racing thoughts", "can't stop thinking", "cant stop thinking",
        "what if", "overthinking", "tense", "uneasy", "dread", "scared", "overwhelmed",
        "بےچینی", "پریشان", "گھبراہٹ", "خوف", "فکر مند", "بےقراری", "خدشہ",
    ),
    "stress": (
        "stressed", "stress", "pressure", "overloaded", "overwhelmed", "burnt out", "burned out",
        "too much", "can't cope", "cant cope", "can't keep up", "cant keep up", "deadline",
        "no time", "swamped", "under pressure",
        "دباؤ", "بوجھ", "زیادہ کام",
    ),
    "fatigue": (
        "tired", "exhausted", "drained", "no energy", "worn out", "fatigued",
        "can't get up", "cant get up", "no motivation",
        "تھکاوٹ", "نڈھال", "سستی", "تھکن",
    ),
    "absolutist": (
        "always", "never", "everyone", "no one", "nobody", "everything", "nothing",
        "every time", "completely", "totally", "entirely", "constantly", "forever", "impossible",
        "ہمیشہ", "کبھی نہیں", "ہر کوئی", "کوئی نہیں", "سب کچھ", "کچھ بھی نہیں", "مکمل طور پر",
    ),
    "negation": ("not ", "no ", "never", "can't", "cant", "won't", "wont", "nothing", "none", "n't", "نہیں", "نہ "),
}
FIRST_PERSON_TERMS_EN = {"i", "i'm", "im", "i've", "ive", "i'll", "ill", "i'd", "id", "me", "my", "mine", "myself"}
FIRST_PERSON_TERMS_UR = ("میں", "مجھے", "میرا", "میری", "میرے", "خود")


def _linguistic_features(text: str) -> dict:
    """Objective, countable features from free text - word/phrase hits and
    ratios, not a diagnosis. Returned as-is alongside the derived scores
    below so the math stays auditable rather than a black box."""
    words = re.findall(r"[\w']+", text.lower())
    word_count = len(words)
    lowered = text.lower()

    def count_hits(category: str) -> int:
        return sum(lowered.count(term) for term in LINGUISTIC_MARKER_TERMS[category])

    first_person_hits = sum(1 for word in words if word in FIRST_PERSON_TERMS_EN) + sum(lowered.count(term) for term in FIRST_PERSON_TERMS_UR)

    return {
        "word_count": word_count,
        "anxiety_hits": count_hits("anxiety"),
        "stress_hits": count_hits("stress"),
        "fatigue_hits": count_hits("fatigue"),
        "absolutist_hits": count_hits("absolutist"),
        "negation_hits": count_hits("negation"),
        "first_person_ratio": round(first_person_hits / word_count, 3) if word_count else 0.0,
        "exclamation_count": text.count("!"),
        "question_count": text.count("?"),
    }


def _linguistic_indicators(features: dict) -> dict:
    """Maps the raw features above onto three 0-1 scores. A coarse lexicon-
    and-ratio heuristic, not a validated psychometric instrument - treat as
    a conversation starter alongside PHQ-9/GAD-7/K10, not a replacement for
    them."""

    def clamp(value: float) -> float:
        return min(1.0, max(0.0, value))

    word_count = max(features["word_count"], 10)  # floor so a 2-word text can't swing a ratio to 100%
    density = lambda hits: (hits / word_count) * 50  # hits per 50 words

    anxiety_density = clamp(density(features["anxiety_hits"]) / 4.0)
    stress_density = clamp(density(features["stress_hits"]) / 4.0)
    fatigue_density = clamp(density(features["fatigue_hits"]) / 4.0)
    absolutist_density = clamp(density(features["absolutist_hits"]) / 4.0)
    first_person_component = clamp((features["first_person_ratio"] - 0.04) / 0.10)
    negation_component = clamp((density(features["negation_hits"]) - 1.0) / 4.0)
    exclaim_component = clamp(features["exclamation_count"] / 3.0)
    question_component = clamp(features["question_count"] / 3.0)

    anxiety_level = clamp(0.55 * anxiety_density + 0.20 * question_component + 0.15 * first_person_component + 0.10 * exclaim_component)
    stress_level = clamp(0.50 * stress_density + 0.25 * fatigue_density + 0.15 * exclaim_component + 0.10 * negation_component)
    depression_indicator = clamp(0.35 * absolutist_density + 0.30 * first_person_component + 0.20 * fatigue_density + 0.15 * negation_component)

    return {
        "anxiety_level": round(anxiety_level, 2),
        "stress_level": round(stress_level, 2),
        "depression_indicator": round(depression_indicator, 2),
    }


MODALITY_LABELS = {
    "phq9": ("PHQ-9", "clinical"),
    "gad7": ("GAD-7", "clinical"),
    "k10": ("K10", "clinical"),
    "text": ("Linguistic (what they say)", "linguistic"),
    "voice": ("Acoustic (how they sound)", "acoustic"),
}


def evaluate_components(phq_result: dict, gad_result: dict, k10_result: dict, text_result: dict, voice_features: dict) -> dict:
    phq_signal = round(int(phq_result.get("total_score", 0)) / 27, 2)
    gad_signal = round(int(gad_result.get("total_score", 0)) / 21, 2)
    k10_signal = round(max(0, int(k10_result.get("total_score", 10)) - 10) / 40, 2)
    text_signal = 1.0 if text_result.get("crisis_language") else 0.65 if text_result.get("sentiment") == "negative" else 0.25 if text_result.get("sentiment") == "neutral" else 0.0
    voice_signal = round(max(0.0, min(1.0, float(voice_features.get("risk_signal", 0.0)))), 2) if voice_features else None

    names = ["phq9", "gad7", "k10", "text"] + (["voice"] if voice_signal is not None else [])
    signals = [phq_signal, gad_signal, k10_signal, text_signal] + ([voice_signal] if voice_signal is not None else [])
    base_weights = [0.30, 0.22, 0.22, 0.16] + ([0.10] if voice_signal is not None else [])
    # Re-normalize over the signals actually present, so the combined score
    # spans the full 0..1 range whether or not a voice note was recorded
    # (the raw weights only sum to 1.0 with voice included, which capped a
    # no-voice check-in at 0.90).
    weights = [round(weight / sum(base_weights), 4) for weight in base_weights]
    combined = round(sum(signal * weight for signal, weight in zip(signals, weights)) * 100) / 100

    # combined is a weighted sum with these exact weights, so each term's weighted value is
    # its exact contribution to combined - the Shapley value for an additive payoff with no
    # interaction effects to split. Contributions below sum to `combined` (up to rounding)
    # by construction, not approximately.
    contributions = []
    for name, signal, weight in zip(names, signals, weights):
        label, modality = MODALITY_LABELS[name]
        value = round(signal * weight, 4)
        contributions.append({
            "name": name,
            "label": label,
            "modality": modality,
            "signal": signal,
            "weight": weight,
            "contribution": value,
            "share_pct": round((value / combined) * 100, 1) if combined else 0.0,
        })

    return {
        "phq9": {"signal": phq_signal, "score": phq_result.get("total_score", 0), "band": phq_result.get("severity_band")},
        "gad7": {"signal": gad_signal, "score": gad_result.get("total_score", 0), "band": gad_result.get("severity_band")},
        "k10": {"signal": k10_signal, "score": k10_result.get("total_score", 0), "band": k10_result.get("severity_band")},
        "text": {
            "signal": text_signal,
            "sentiment": text_result.get("sentiment", "neutral"),
            "crisis_language": bool(text_result.get("crisis_language")),
            "anxiety_level": text_result.get("anxiety_level"),
            "stress_level": text_result.get("stress_level"),
            "depression_indicator": text_result.get("depression_indicator"),
        },
        "voice": {
            "signal": voice_signal,
            "available": voice_signal is not None,
            "emotion": voice_features.get("emotion") if voice_signal is not None else None,
            "note": "Acoustic voice risk features are not available for this check-in." if voice_signal is None else "Heuristic acoustic features included (pause ratio, loudness variability, speaking rate) - not a validated clinical biomarker.",
        },
        "combined_signal": combined,
        "attribution": {
            "method": "additive_signal_attribution",
            "note": "MindHx's combined signal is a weighted sum of clinical, linguistic, and acoustic inputs, so these contributions are the exact per-signal attribution (equivalent to Shapley values for an additive model), not an approximation.",
            "total": combined,
            "contributions": sorted(contributions, key=lambda item: item["contribution"], reverse=True),
        },
    }


def support_plan(phq_result: dict, gad_result: dict, k10_result: dict, crisis: bool, profile: dict, themes: list[str]) -> dict:
    if crisis:
        return {
            "route": "crisis",
            "title": "Immediate support comes first",
            "next_action": "Contact local emergency services or a crisis line now, and stay with a trusted person if possible.",
            "psychiatric_referral": professional_contact("immediate"),
            "support_content": support_resources(themes, profile.get("preferred_language", "en")),
            "meditation": [],
            "strategies": [],
            "support_groups": [],
            "resources": support_resources(themes, profile.get("preferred_language", "en"))["resources"],
        }

    urgent_bands = {"moderate", "moderately_severe", "severe"}
    urgent = (
        phq_result.get("severity_band") in urgent_bands
        or gad_result.get("severity_band") in urgent_bands
        or k10_result.get("severity_band") in {"moderate", "severe"}
    )
    if urgent:
        return {
            "route": "psychiatric_referral",
            "title": "A professional evaluation is the next step",
            "next_action": "Book an appointment with a licensed psychiatrist or qualified mental-health clinician. If symptoms worsen or safety changes, seek urgent help.",
            "psychiatric_referral": {
                "what_to_expect": [
                    "A private conversation about symptoms, sleep, mood, anxiety, medicines, substance use, and safety.",
                    "A review of your questionnaire results and daily functioning.",
                    "Shared decisions about therapy, medical checks, medication, or follow-up. You can ask questions and decline options.",
                ],
                "provider_search": "Use a licensed local service, a hospital psychiatry department, or a regulated telehealth directory in your country.",
                "not_a_diagnosis": True,
            },
            "professional_contact": professional_contact("soon"),
            "support_content": support_resources(themes, profile.get("preferred_language", "en")),
            "meditation": [],
            "strategies": [],
            "support_groups": support_resources(themes, profile.get("preferred_language", "en"))["support_groups"],
            "resources": support_resources(themes, profile.get("preferred_language", "en"))["resources"],
        }

    content = support_resources(themes, profile.get("preferred_language", "en"))
    return {
        "route": "self_support_options",
        "title": "Gentle support options",
        "next_action": "Choose one small practice and consider sharing how you are doing with someone you trust.",
        "psychiatric_referral": None,
        "professional_contact": professional_contact("monitor"),
        "support_content": content,
        "meditation": content["meditation"],
        "strategies": content["strategies"],
        "support_groups": content["support_groups"],
        "resources": content["resources"],
    }


TRIAGE_CLASSIFIER_SYSTEM_PROMPT = (
    "Classify mental-health check-in text for triage support, not diagnosis. Return only JSON with: "
    "sentiment (negative, neutral, or positive), keyword_flags (array of strings), crisis_language (boolean), "
    "anxiety_level (0 to 1, how much the text reads as anxious, worried, or on edge), "
    "stress_level (0 to 1, how much the text reads as pressured, overwhelmed, or burnt out), "
    "and depression_indicator (0 to 1, how much the text reads as hopeless, low-energy, or withdrawn). "
    "Treat explicit self-harm or suicide intent as crisis_language true."
)


def _parse_triage_classification(content: str) -> Optional[dict]:
    try:
        result = json.loads(content)
    except (TypeError, ValueError):
        return None
    if result.get("sentiment") not in {"negative", "neutral", "positive"}:
        return None
    # anxiety_level/stress_level/depression_indicator are an optional enhancement over the
    # local heuristic - keep them only if the model actually returned a valid 0..1 number,
    # otherwise drop the key so the caller's heuristic value is used instead.
    for field in ("anxiety_level", "stress_level", "depression_indicator"):
        value = result.get(field)
        if not (isinstance(value, (int, float)) and not isinstance(value, bool) and 0 <= value <= 1):
            result.pop(field, None)
    return result


async def analyze_with_openai(text: str, language: str) -> Optional[dict]:
    """Classify check-in text with OpenAI's chat completions API."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    payload = {
        "model": os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": TRIAGE_CLASSIFIER_SYSTEM_PROMPT},
            {"role": "user", "content": f"Language: {language}\nText: {text}"},
        ],
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as error:
        logger.error("OpenAI /analyze-text returned %s: %s", error.response.status_code, error.response.text[:500])
        return None
    except (httpx.HTTPError, KeyError, TypeError, IndexError) as error:
        logger.error("OpenAI /analyze-text request failed: %r", error)
        return None
    return _parse_triage_classification(content)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "mindhx"}


def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "age_range": user.age_range,
        "full_name": user.full_name,
        "phone": user.phone,
        "gender": user.gender,
        "marital_status": user.marital_status,
        "life_context": user.life_context,
        "preferred_language": user.preferred_language,
        "avatar_data_url": user.avatar_data_url,
        "is_admin": user.is_admin,
        "created_at": user.created_at.isoformat(),
    }


def _serialize_checkin(check_in: CheckIn, include_answers: bool = False, has_report: bool = False) -> dict:
    details: dict = {}
    if check_in.details_json:
        try:
            details = json.loads(check_in.details_json)
        except ValueError:
            details = {}
    serialized = {
        "id": check_in.id,
        "risk_score": check_in.risk_score,
        "band": check_in.band,
        "routing_decision": check_in.routing_decision,
        "themes": check_in.themes.split(",") if check_in.themes else [],
        "components": details.get("components"),
        "support_plan": details.get("support_plan"),
        "has_report": has_report,
        "created_at": check_in.created_at.isoformat(),
    }
    if include_answers:
        answers = None
        if check_in.answers_json:
            try:
                answers = json.loads(check_in.answers_json)
            except ValueError:
                answers = None
        serialized["answers"] = answers
    return serialized


PASSWORD_TOO_LONG = HTTPException(status_code=400, detail="Password is too long. Use a shorter password (about 35 Urdu letters or 72 English letters at most).")


def _require_hashable_password(password: str) -> None:
    if password_too_long(password):
        raise PASSWORD_TOO_LONG


@app.post("/auth/register", status_code=201, dependencies=[Depends(rate_limit("register", 10, 3600))])
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    """Create an account. Needed to view check-in results and save history;
    the questionnaires themselves can be filled in without one."""
    _require_hashable_password(payload.password)
    email = payload.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        age_range=payload.age_range,
        full_name=payload.full_name,
        phone=payload.phone,
        gender=payload.gender,
        marital_status=payload.marital_status,
        life_context=payload.life_context,
        preferred_language=payload.preferred_language,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": start_login_session(db, user, request, "register"), "token_type": "bearer"}


@app.post("/auth/login", dependencies=[Depends(rate_limit("login", 10, 300))])
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"access_token": start_login_session(db, user, request, "login"), "token_type": "bearer"}


@app.post("/auth/logout", status_code=204)
def logout(auth: AuthContext = Depends(get_current_auth), db: Session = Depends(get_db)) -> None:
    """Ends this session server-side, so its token stops working even if a
    copy of it outlives the browser's localStorage."""
    if auth.session and auth.session.ended_at is None:
        auth.session.ended_at = datetime.now(timezone.utc)
        auth.session.end_reason = "logout"
        db.commit()


def describe_device(user_agent: Optional[str]) -> str:
    """A short "Browser on OS" label for the login-history list. Coarse on
    purpose - enough to recognise your own devices, not a fingerprint."""
    if not user_agent:
        return "Unknown device"
    ua = user_agent.lower()
    if "edg/" in ua:
        browser = "Edge"
    elif "opr/" in ua or "opera" in ua:
        browser = "Opera"
    elif "firefox/" in ua or "fxios/" in ua:
        browser = "Firefox"
    elif "chrome/" in ua or "crios/" in ua:
        browser = "Chrome"
    elif "safari/" in ua:
        browser = "Safari"
    else:
        browser = "Unknown browser"
    if "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "android" in ua:
        os_name = "Android"
    elif "windows" in ua:
        os_name = "Windows"
    elif "mac os x" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "linux" in ua:
        os_name = "Linux"
    else:
        os_name = "an unknown OS"
    return f"{browser} on {os_name}"


def _serialize_login_session(session: LoginSession, current_session_id: Optional[str]) -> dict:
    now = datetime.now(timezone.utc)
    active = session.ended_at is None and as_aware_utc(session.expires_at) > now
    if session.ended_at is not None:
        status = session.end_reason or "ended"
    else:
        status = "active" if active else "expired"
    return {
        "id": session.id,
        "method": session.method,
        "device": describe_device(session.user_agent),
        "user_agent": session.user_agent,
        "ip_address": session.ip_address,
        "created_at": as_aware_utc(session.created_at).isoformat(),
        "last_seen_at": as_aware_utc(session.last_seen_at).isoformat(),
        "ended_at": as_aware_utc(session.ended_at).isoformat() if session.ended_at else None,
        "status": status,
        "active": active,
        "current": session.id == current_session_id,
    }


@app.get("/auth/sessions")
def list_login_sessions(auth: AuthContext = Depends(get_current_auth), db: Session = Depends(get_db)) -> list[dict]:
    """This account's login history, newest first - every sign-in within
    the retention window, whether still active, signed out, or expired."""
    sessions = (
        db.query(LoginSession)
        .filter(LoginSession.user_id == auth.user.id)
        .order_by(LoginSession.created_at.desc())
        .limit(100)
        .all()
    )
    current_id = auth.session.id if auth.session else None
    return [_serialize_login_session(session, current_id) for session in sessions]


@app.delete("/auth/sessions/{session_id}", status_code=204)
def revoke_login_session(session_id: str, auth: AuthContext = Depends(get_current_auth), db: Session = Depends(get_db)) -> None:
    """Signs out one session ("sign out this device"). 404 rather than 403
    for another account's session id, so ids can't be probed."""
    session = db.get(LoginSession, session_id)
    if not session or session.user_id != auth.user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.ended_at is None:
        session.ended_at = datetime.now(timezone.utc)
        session.end_reason = "logout" if auth.session and session.id == auth.session.id else "revoked"
        db.commit()


@app.post("/auth/sessions/revoke-others")
def revoke_other_login_sessions(auth: AuthContext = Depends(get_current_auth), db: Session = Depends(get_db)) -> dict:
    """Signs out every session except the one making this request."""
    ended = end_login_sessions(db, auth.user.id, "revoked", keep_session_id=auth.session.id if auth.session else None)
    db.commit()
    return {"ended": ended}


@app.post("/auth/forgot-password", dependencies=[Depends(rate_limit("forgot-password", 5, 3600))])
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> dict:
    """Always returns the same generic message regardless of whether the
    email is registered, so this endpoint can't be used to enumerate which
    emails have MindHx accounts."""
    generic_response = {"message": "If an account exists for that email, we've sent a link to reset the password."}
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        return generic_response

    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)
    ).delete()

    raw_token = generate_reset_token()
    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES),
    ))
    db.commit()

    reset_link = f"{WEB_ORIGIN}/reset-password?token={raw_token}"
    try:
        send_email(
            to=user.email,
            subject="Reset your MindHx password",
            html_body=(
                f"<p>Someone requested a password reset for your MindHx account.</p>"
                f"<p><a href=\"{reset_link}\">Reset your password</a></p>"
                f"<p>This link expires in {PASSWORD_RESET_EXPIRE_MINUTES} minutes. "
                f"If you didn't request this, you can safely ignore this email.</p>"
            ),
            text_body=(
                f"Reset your MindHx password: {reset_link}\n\n"
                f"This link expires in {PASSWORD_RESET_EXPIRE_MINUTES} minutes. "
                f"If you didn't request this, you can safely ignore this email."
            ),
        )
    except Exception as error:  # smtplib raises several distinct exception types (OSError, SMTPException, ...) - any of them means the reset token still exists but the email didn't go out.
        logger.error("Password reset email to %s failed: %r", user.email, error)
    # Same generic response either way, on purpose: an SMTP failure must not
    # reveal to the caller whether the email address is actually registered
    # (that's the whole point of returning this before checking - see above).
    return generic_response


@app.post("/auth/reset-password", dependencies=[Depends(rate_limit("reset-password", 10, 3600))])
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    _require_hashable_password(payload.new_password)
    token_hash = hash_reset_token(payload.token)
    reset_token = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()
    invalid = HTTPException(status_code=400, detail="This reset link is invalid or has expired. Request a new one.")
    if not reset_token or reset_token.used_at is not None or as_aware_utc(reset_token.expires_at) < datetime.now(timezone.utc):
        raise invalid

    user = db.get(User, reset_token.user_id)
    if not user:
        raise invalid

    user.hashed_password = hash_password(payload.new_password)
    user.token_version = (user.token_version or 0) + 1  # Sign out every existing session.
    end_login_sessions(db, user.id, "password_reset")
    reset_token.used_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Your password has been updated. Sign in with your new password."}


@app.get("/auth/me")
def read_current_user(current_user: User = Depends(get_current_user)) -> dict:
    return _serialize_user(current_user)


@app.put("/auth/me")
def update_current_user(payload: ProfileUpdateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """Partial update: only fields present in the request body are changed
    (model_dump(exclude_unset=True)), so e.g. uploading just a new avatar
    never touches name/phone/etc, and vice versa."""
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return _serialize_user(current_user)


@app.post("/auth/change-password")
def change_password(payload: ChangePasswordRequest, request: Request, auth: AuthContext = Depends(get_current_auth), db: Session = Depends(get_db)) -> dict:
    """Password change for a signed-in user, in place of the email-link
    reset flow (see /auth/forgot-password) - requires the current password
    so it can't be used by someone who's merely stolen a live session."""
    current_user = auth.user
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    _require_hashable_password(payload.new_password)
    current_user.hashed_password = hash_password(payload.new_password)
    # Sign out every other session; hand this one a fresh token (same login
    # session, new token_version) so the person making the change stays
    # signed in.
    current_user.token_version = (current_user.token_version or 0) + 1
    end_login_sessions(db, current_user.id, "password_change", keep_session_id=auth.session.id if auth.session else None)
    db.commit()
    if auth.session:
        access_token = create_access_token(current_user, auth.session)
    else:
        access_token = start_login_session(db, current_user, request, "password_change")
    return {"message": "Your password has been updated.", "access_token": access_token, "token_type": "bearer"}


def checkin_cooldown() -> timedelta:
    """Minimum gap between two saved check-ins for one account. Read on each
    call (not at import) so tests and operators can change it without a
    restart; CHECKIN_COOLDOWN_DAYS=0 turns the limit off (e.g. local dev)."""
    try:
        days = float(os.getenv("CHECKIN_COOLDOWN_DAYS", "7"))
    except ValueError:
        days = 7.0
    return timedelta(days=max(0.0, days))


def checkin_eligibility(db: Session, user: User) -> dict:
    cooldown = checkin_cooldown()
    last = db.query(func.max(CheckIn.created_at)).filter(CheckIn.user_id == user.id).scalar()
    last_at = as_aware_utc(last) if last else None
    next_at = last_at + cooldown if last_at else None
    can_check_in = next_at is None or datetime.now(timezone.utc) >= next_at
    return {
        "can_check_in": can_check_in,
        "cooldown_days": cooldown.total_seconds() / 86400,
        "last_checkin_at": last_at.isoformat() if last_at else None,
        "next_available_at": None if can_check_in else next_at.isoformat(),
    }


@app.get("/checkins/eligibility")
def get_checkin_eligibility(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """Whether this account can save a new check-in yet, and if not, when -
    so the check-in page can say so before someone fills everything in."""
    return checkin_eligibility(db, current_user)


@app.post("/checkins", status_code=201)
def create_checkin(payload: CheckInCreateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """Save every section's structured check-in result, plus the individual
    questionnaire answers when sent, for a signed-in user. The transcript
    and written text arrive separately, inside the PDF report (PUT
    /checkins/{id}/report). At most one per CHECKIN_COOLDOWN_DAYS per
    account."""
    eligibility = checkin_eligibility(db, current_user)
    if not eligibility["can_check_in"]:
        retry_after = int((datetime.fromisoformat(eligibility["next_available_at"]) - datetime.now(timezone.utc)).total_seconds()) + 1
        raise HTTPException(
            status_code=429,
            detail=f"You can save a new check-in once every {checkin_cooldown().days} days. Your next one is available after {eligibility['next_available_at']}.",
            headers={"Retry-After": str(max(1, retry_after))},
        )
    details = {"components": payload.components, "support_plan": payload.support_plan}
    details_json = json.dumps(details) if (payload.components or payload.support_plan) else None
    if details_json and len(details_json) > MAX_CHECKIN_DETAILS_CHARS:
        raise HTTPException(status_code=413, detail="Check-in details are too large")
    # Only themes /risk-assess can actually produce - also keeps the joined
    # string inside the themes column's 200-character limit, which Postgres
    # enforces (SQLite silently doesn't).
    themes = [theme for theme in dict.fromkeys(payload.themes) if theme in KNOWN_THEMES]
    check_in = CheckIn(
        user_id=current_user.id,
        risk_score=payload.risk_score,
        band=payload.band,
        routing_decision=payload.routing_decision,
        themes=",".join(themes),
        details_json=details_json,
        answers_json=json.dumps(payload.answers.model_dump()) if payload.answers else None,
    )
    db.add(check_in)
    db.commit()
    db.refresh(check_in)
    return _serialize_checkin(check_in, include_answers=True)


@app.get("/checkins")
def list_checkins(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    """The account's own history, including its own questionnaire answers."""
    check_ins = db.query(CheckIn).filter(CheckIn.user_id == current_user.id).order_by(CheckIn.created_at.desc()).all()
    # Only the ids - never load PDF bytes just to list history.
    with_reports = {check_in_id for (check_in_id,) in db.query(CheckInReport.check_in_id).filter(CheckInReport.user_id == current_user.id).all()}
    return [_serialize_checkin(check_in, include_answers=True, has_report=check_in.id in with_reports) for check_in in check_ins]


MAX_REPORT_BYTES = 5 * 1024 * 1024  # A generated report is typically well under 200 KB.


def _owned_checkin(check_in_id: str, user: User, db: Session) -> CheckIn:
    """404 (not 403) for someone else's check-in, so ids can't be probed."""
    check_in = db.get(CheckIn, check_in_id)
    if not check_in or check_in.user_id != user.id:
        raise HTTPException(status_code=404, detail="Check-in not found")
    return check_in


@app.put("/checkins/{check_in_id}/report", status_code=201)
async def upload_checkin_report(
    check_in_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Saves the PDF report generated in the browser after a check-in, so
    it can be downloaded again (e.g. to show a doctor). Replaces any report
    already saved for that check-in."""
    _owned_checkin(check_in_id, current_user, db)
    pdf = await file.read(MAX_REPORT_BYTES + 1)
    if len(pdf) > MAX_REPORT_BYTES:
        raise HTTPException(status_code=413, detail="Report is too large")
    if not pdf.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Report must be a PDF file")
    report = db.query(CheckInReport).filter(CheckInReport.check_in_id == check_in_id).first()
    if report:
        report.pdf_data = pdf
        report.size_bytes = len(pdf)
        report.created_at = datetime.now(timezone.utc)
    else:
        db.add(CheckInReport(check_in_id=check_in_id, user_id=current_user.id, pdf_data=pdf, size_bytes=len(pdf)))
    db.commit()
    return {"check_in_id": check_in_id, "size_bytes": len(pdf)}


@app.get("/checkins/{check_in_id}/report")
def download_checkin_report(check_in_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    check_in = _owned_checkin(check_in_id, current_user, db)
    report = db.query(CheckInReport).filter(CheckInReport.check_in_id == check_in_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="No saved report for this check-in")
    filename = f"mindhx-checkin-{as_aware_utc(check_in.created_at).strftime('%Y-%m-%d')}.pdf"
    return Response(
        content=report.pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


@app.delete("/checkins/{check_in_id}/report", status_code=204)
def delete_checkin_report(check_in_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    """Deletes just the saved PDF (the part holding the person's own words
    and answers); the check-in's scores stay in their history."""
    _owned_checkin(check_in_id, current_user, db)
    db.query(CheckInReport).filter(CheckInReport.check_in_id == check_in_id).delete()
    db.commit()


def _serialize_resource(resource: Resource) -> dict:
    return {
        "id": resource.id,
        "resource_type": resource.resource_type,
        "slug": resource.slug,
        "title": resource.title,
        "summary": resource.summary,
        "body": resource.body,
        "image_data_url": resource.image_data_url,
        "published": resource.published,
        "created_at": resource.created_at.isoformat(),
        "updated_at": resource.updated_at.isoformat(),
    }


PAGEVIEW_PATH_PATTERN = re.compile(r"^/[A-Za-z0-9\-._~/]*$")


@app.post("/analytics/pageview", status_code=204, dependencies=[Depends(rate_limit("pageview", 120, 600))])
def record_pageview(payload: PageViewRequest, db: Session = Depends(get_db)) -> None:
    """Public, fire-and-forget - the frontend calls this on every page load
    (see lib/pageview.ts) without waiting for or checking the response. No
    auth, no identifier of any kind is recorded (see PageView's docstring).
    Rate-limited, and only plain site paths are accepted, so the admin
    dashboard's counts can't be trivially flooded with junk entries."""
    if not PAGEVIEW_PATH_PATTERN.match(payload.path):
        raise HTTPException(status_code=400, detail="path must be a plain site path, e.g. /meditation")
    db.add(PageView(path=payload.path[:300]))
    db.commit()


@app.get("/admin/analytics")
def admin_analytics(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> dict:
    """Stats from data already in the database, plus site-visit counts from
    the minimal PageView log (path + timestamp only - see its docstring)."""
    total_users = db.query(User).count()
    total_checkins = db.query(CheckIn).count()

    since_7d = datetime.now(timezone.utc) - timedelta(days=7)
    since_30d = datetime.now(timezone.utc) - timedelta(days=30)
    new_users_7d = db.query(User).filter(User.created_at >= since_7d).count()
    new_users_30d = db.query(User).filter(User.created_at >= since_30d).count()
    checkins_7d = db.query(CheckIn).filter(CheckIn.created_at >= since_7d).count()
    checkins_30d = db.query(CheckIn).filter(CheckIn.created_at >= since_30d).count()

    total_pageviews = db.query(PageView).count()
    pageviews_7d = db.query(PageView).filter(PageView.created_at >= since_7d).count()
    pageviews_30d = db.query(PageView).filter(PageView.created_at >= since_30d).count()

    page_counts: dict[str, int] = {}
    for (path,) in db.query(PageView.path).filter(PageView.created_at >= since_30d).all():
        page_counts[path] = page_counts.get(path, 0) + 1
    top_pages = sorted(page_counts.items(), key=lambda item: item[1], reverse=True)[:10]

    band_counts: dict[str, int] = {}
    theme_counts: dict[str, int] = {}
    for band, themes in db.query(CheckIn.band, CheckIn.themes).all():
        band_counts[band] = band_counts.get(band, 0) + 1
        for theme in (themes or "").split(","):
            theme = theme.strip()
            if theme:
                theme_counts[theme] = theme_counts.get(theme, 0) + 1
    top_themes = sorted(theme_counts.items(), key=lambda item: item[1], reverse=True)[:10]

    return {
        "total_users": total_users,
        "new_users_7d": new_users_7d,
        "new_users_30d": new_users_30d,
        "total_checkins": total_checkins,
        "checkins_7d": checkins_7d,
        "checkins_30d": checkins_30d,
        "total_pageviews": total_pageviews,
        "pageviews_7d": pageviews_7d,
        "pageviews_30d": pageviews_30d,
        "top_pages": [{"path": path, "count": count} for path, count in top_pages],
        "band_counts": band_counts,
        "top_themes": [{"theme": theme, "count": count} for theme, count in top_themes],
    }


@app.get("/admin/users")
def admin_list_users(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> list[dict]:
    """Read-only account list for the admin panel - email, name, signup
    date, last sign-in, admin status, and how many check-ins they've saved. Never the
    password hash or anything from a saved check-in itself."""
    checkin_counts = dict(db.query(CheckIn.user_id, func.count(CheckIn.id)).group_by(CheckIn.user_id).all())
    last_logins = dict(db.query(LoginSession.user_id, func.max(LoginSession.created_at)).group_by(LoginSession.user_id).all())
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": user.is_admin,
            "checkin_count": checkin_counts.get(user.id, 0),
            "last_login_at": as_aware_utc(last_logins[user.id]).isoformat() if last_logins.get(user.id) else None,
            "created_at": user.created_at.isoformat(),
        }
        for user in users
    ]


@app.get("/admin/users/{user_id}/checkins")
def admin_list_user_checkins(user_id: str, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> dict:
    """One account's saved check-ins, newest first, including the individual
    questionnaire answers. Still never a transcript or typed text - those are
    never stored."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    check_ins = db.query(CheckIn).filter(CheckIn.user_id == user.id).order_by(CheckIn.created_at.desc()).all()
    return {
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name},
        "checkins": [_serialize_checkin(check_in, include_answers=True) for check_in in check_ins],
    }


@app.get("/resources")
def list_resources(resource_type: Optional[str] = None, db: Session = Depends(get_db)) -> list[dict]:
    """Public: published resources only. Additive to the existing static
    meditation/therapies content, not a replacement for it."""
    query = db.query(Resource).filter(Resource.published.is_(True))
    if resource_type:
        query = query.filter(Resource.resource_type == resource_type)
    resources = query.order_by(Resource.created_at.desc()).all()
    return [_serialize_resource(resource) for resource in resources]


@app.get("/resources/{slug}")
def get_resource(slug: str, db: Session = Depends(get_db)) -> dict:
    resource = db.query(Resource).filter(Resource.slug == slug, Resource.published.is_(True)).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return _serialize_resource(resource)


@app.get("/admin/resources")
def admin_list_resources(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> list[dict]:
    """Admin: every resource, published or not (unlike GET /resources)."""
    resources = db.query(Resource).order_by(Resource.created_at.desc()).all()
    return [_serialize_resource(resource) for resource in resources]


@app.post("/admin/resources", status_code=201)
def admin_create_resource(payload: ResourceCreateRequest, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> dict:
    resource_type = payload.resource_type.strip().lower()
    if resource_type not in RESOURCE_TYPES:
        raise HTTPException(status_code=400, detail=f"resource_type must be one of {sorted(RESOURCE_TYPES)}")
    slug = payload.slug.strip().lower()
    if not SLUG_PATTERN.match(slug):
        raise HTTPException(status_code=400, detail="slug must be lowercase letters, numbers, and hyphens only")
    if db.query(Resource).filter(Resource.slug == slug).first():
        raise HTTPException(status_code=409, detail="A resource with this slug already exists")
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="title can't be empty")
    resource = Resource(
        resource_type=resource_type,
        slug=slug,
        title=payload.title.strip(),
        summary=payload.summary.strip(),
        body=payload.body,
        image_data_url=payload.image_data_url,
        published=payload.published,
        created_by=admin.id,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return _serialize_resource(resource)


@app.put("/admin/resources/{resource_id}")
def admin_update_resource(resource_id: str, payload: ResourceUpdateRequest, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> dict:
    resource = db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    updates = payload.model_dump(exclude_unset=True)
    # Explicit nulls are only meaningful for the image (removes it); every
    # other field is a NOT NULL column.
    null_fields = sorted(field for field, value in updates.items() if value is None and field != "image_data_url")
    if null_fields:
        raise HTTPException(status_code=400, detail=f"These fields can't be empty: {', '.join(null_fields)}")
    if "title" in updates:
        updates["title"] = updates["title"].strip()
        if not updates["title"]:
            raise HTTPException(status_code=400, detail="title can't be empty")
    if "summary" in updates:
        updates["summary"] = updates["summary"].strip()
    if "resource_type" in updates:
        resource_type = updates["resource_type"].strip().lower()
        if resource_type not in RESOURCE_TYPES:
            raise HTTPException(status_code=400, detail=f"resource_type must be one of {sorted(RESOURCE_TYPES)}")
        updates["resource_type"] = resource_type
    if "slug" in updates:
        slug = updates["slug"].strip().lower()
        if not SLUG_PATTERN.match(slug):
            raise HTTPException(status_code=400, detail="slug must be lowercase letters, numbers, and hyphens only")
        existing = db.query(Resource).filter(Resource.slug == slug, Resource.id != resource_id).first()
        if existing:
            raise HTTPException(status_code=409, detail="A resource with this slug already exists")
        updates["slug"] = slug
    for field, value in updates.items():
        setattr(resource, field, value)
    db.commit()
    db.refresh(resource)
    return _serialize_resource(resource)


@app.delete("/admin/resources/{resource_id}", status_code=204)
def admin_delete_resource(resource_id: str, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> None:
    resource = db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    db.delete(resource)
    db.commit()


@app.post("/session/start")
def start_session(payload: SessionStartRequest) -> dict:
    """Start a stateless session; the API never stores the supplied profile."""
    return {
        "session_token": secrets.token_urlsafe(24),
        "privacy": "Profile context is used for this request flow only. MindHx does not persist it or create an account.",
    }


MAX_AUDIO_BYTES = 25 * 1024 * 1024


async def _read_audio_upload(file: UploadFile) -> bytes:
    """Reads at most MAX_AUDIO_BYTES + 1, so an oversized upload is rejected
    without ever being loaded into memory in full."""
    audio = await file.read(MAX_AUDIO_BYTES + 1)
    if not audio or len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio must be between 1 byte and 25 MB")
    return audio


@app.post("/transcribe", dependencies=[Depends(rate_limit("transcribe", 20, 3600))])
async def transcribe(file: UploadFile = File(...), language: str = Form("auto")) -> dict:
    """Transcribe audio via OpenAI's hosted Whisper API.

    Previously ran faster-whisper in-process. That's the same Whisper model
    family, but loading its runtime (ctranslate2 + onnxruntime) got the
    backend OOM-killed under Railway's memory limit even at the smallest
    model size - the fixed cost of the runtime itself, not the model
    weights, was the problem. Sending the audio to a hosted API instead
    removes that memory cost entirely and keeps the same transcription
    quality (including Urdu), since it's the same underlying model.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Speech-to-text is not configured (OPENAI_API_KEY missing)")

    audio = await _read_audio_upload(file)

    data = {"model": os.getenv("OPENAI_STT_MODEL", "whisper-1"), "response_format": "verbose_json"}
    if language and language != "auto":
        data["language"] = language

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {api_key}"},
                data=data,
                files={"file": (file.filename or "recording.webm", audio, file.content_type or "application/octet-stream")},
            )
    except httpx.HTTPError as error:
        logger.error("OpenAI /transcribe request failed: %r", error)
        raise HTTPException(status_code=503, detail="Speech-to-text service unavailable") from error

    if response.status_code != 200:
        logger.error("OpenAI /transcribe returned %s: %s", response.status_code, response.text[:500])
        raise HTTPException(status_code=502, detail="Speech-to-text request failed")

    result = response.json()
    return {"text": (result.get("text") or "").strip(), "language": result.get("language"), "language_probability": None}


def _decode_audio_mono(av_module, path: str, target_rate: int = 16000) -> tuple[np.ndarray, int]:
    """Decode any container PyAV can read into mono float32 PCM at target_rate."""
    container = av_module.open(path)
    try:
        stream = container.streams.audio[0]
        resampler = av_module.audio.resampler.AudioResampler(format="flt", layout="mono", rate=target_rate)
        chunks = []
        for frame in container.decode(stream):
            for resampled in resampler.resample(frame):
                chunks.append(resampled.to_ndarray())
        for resampled in resampler.resample(None):
            chunks.append(resampled.to_ndarray())
    finally:
        container.close()
    if not chunks:
        return np.array([], dtype=np.float32), target_rate
    return np.concatenate(chunks, axis=1).flatten().astype(np.float32), target_rate


def _prosodic_features(audio: np.ndarray, sample_rate: int) -> dict:
    """Frame-level loudness/pause/rate features computed directly from PCM samples."""
    frame_length = max(1, int(0.025 * sample_rate))
    hop_length = max(1, int(0.010 * sample_rate))
    frames = [audio[start:start + frame_length] for start in range(0, max(1, len(audio) - frame_length), hop_length)]
    if not frames:
        frames = [audio]
    rms = np.array([float(np.sqrt(np.mean(frame.astype(np.float64) ** 2) + 1e-12)) for frame in frames])
    threshold = max(float(rms.mean()) * 0.35, 1e-4)
    voiced_mask = rms > threshold
    pause_ratio = float(1.0 - voiced_mask.mean())
    voiced_rms = rms[voiced_mask]
    energy_variability = float(voiced_rms.std() / (voiced_rms.mean() + 1e-9)) if voiced_rms.size >= 2 else 0.0
    transitions = np.diff(voiced_mask.astype(int))
    segment_count = int(np.sum(transitions == 1)) + (1 if voiced_mask.size and voiced_mask[0] else 0)
    duration_sec = len(audio) / sample_rate
    speaking_rate = segment_count / duration_sec if duration_sec > 0 else 0.0
    return {
        "duration_sec": round(duration_sec, 2),
        "pause_ratio": round(pause_ratio, 3),
        "energy_variability": round(energy_variability, 3),
        "speaking_rate": round(speaking_rate, 3),
    }


def _prosodic_risk_signal(features: dict) -> float:
    """Maps prosodic features to 0..1: more pausing, flatter loudness, and slower speech
    (all associated with psychomotor slowing / low affect in the literature) push it up.
    The thresholds below are reasonable heuristic assumptions, not fitted to labeled data -
    treat this as a proxy signal, not a validated biomarker score."""
    pause_component = min(1.0, max(0.0, (features["pause_ratio"] - 0.3) / 0.4))
    variability_component = min(1.0, max(0.0, (0.5 - features["energy_variability"]) / 0.5))
    rate_component = min(1.0, max(0.0, (2.0 - features["speaking_rate"]) / 2.0))
    signal = 0.4 * pause_component + 0.35 * variability_component + 0.25 * rate_component
    return round(min(1.0, max(0.0, signal)), 2)


def _voice_emotion_scores(features: dict) -> dict:
    """Coarse rule-based reading of the same three prosodic features onto five
    illustrative labels (calm, stress, anger, fatigue, depression_indicator).

    This is NOT emotion recognition from a trained model, and it has no pitch
    or spectral information to work with - only loudness variability, pause
    ratio, and speaking rate. Treat these bars as a rough, transparent proxy
    of vocal energy and pacing, not a clinical or forensic-grade classifier
    of mood or affect. depression_indicator reuses _prosodic_risk_signal's
    psychomotor-slowing heuristic (pausing + flat loudness + slow speech)."""

    def clamp(value: float) -> float:
        return min(1.0, max(0.0, value))

    pause_ratio = features["pause_ratio"]
    variability = features["energy_variability"]
    rate = features["speaking_rate"]

    variability_high = clamp((variability - 0.5) / 0.5)
    variability_low = clamp((0.5 - variability) / 0.5)
    rate_fast = clamp((rate - 2.0) / 2.0)
    rate_slow = clamp((2.0 - rate) / 2.0)
    pause_low = clamp((0.3 - pause_ratio) / 0.3)
    pause_high = clamp((pause_ratio - 0.3) / 0.4)

    # Stress and anger both read as "activated" delivery (louder swings, faster
    # pace, fewer pauses); anger weights the loudness bursts more heavily,
    # stress is a more even blend - a coarse distinction, not a validated one.
    stress = clamp(0.45 * variability_high + 0.35 * rate_fast + 0.20 * pause_low)
    anger = clamp(0.65 * variability_high + 0.35 * rate_fast)
    fatigue = clamp(0.45 * variability_low + 0.35 * rate_slow + 0.20 * pause_high)
    depression_indicator = _prosodic_risk_signal(features)
    calm = clamp(1.0 - max(stress, anger, 0.7 * fatigue))

    return {
        "calm": round(calm, 2),
        "stress": round(stress, 2),
        "anger": round(anger, 2),
        "fatigue": round(fatigue, 2),
        "depression_indicator": round(depression_indicator, 2),
    }


def _analyze_audio_file(av_module, path: str) -> dict:
    """CPU-bound decode + feature extraction - run off the event loop (see
    analyze_voice) so one recording doesn't stall every other request."""
    audio, sample_rate = _decode_audio_mono(av_module, path)
    if audio.size < sample_rate * 0.5:
        raise HTTPException(status_code=422, detail="Audio is too short to analyze (minimum ~0.5s)")
    features = _prosodic_features(audio, sample_rate)
    return {
        "provider": "local-heuristic",
        "risk_signal": _prosodic_risk_signal(features),
        "emotion": _voice_emotion_scores(features),
        **features,
        "note": "Heuristic prosodic signal derived directly from audio (pause ratio, energy variability, speaking rate). Not a validated clinical voice biomarker.",
    }


@app.post("/analyze-voice", dependencies=[Depends(rate_limit("analyze-voice", 20, 3600))])
async def analyze_voice(file: UploadFile = File(...)) -> dict:
    """Extract a heuristic prosodic risk signal directly from audio (pause ratio, loudness
    variability, speaking rate). VOICE_BIOMARKER_PROVIDER selects the provider; only 'local'
    is implemented - no clinical voice-biomarker vendor is integrated."""
    provider = os.getenv("VOICE_BIOMARKER_PROVIDER", "local")
    if provider != "local":
        raise HTTPException(status_code=503, detail=f"Voice biomarker provider '{provider}' is not implemented")

    try:
        import av
    except ImportError as error:
        raise HTTPException(status_code=503, detail="Audio decoding (PyAV) is not installed") from error

    audio_bytes = await _read_audio_upload(file)

    suffix = Path(file.filename or "recording.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
        temp_file.write(audio_bytes)
        temp_path = temp_file.name

    try:
        return await run_in_threadpool(_analyze_audio_file, av, temp_path)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=422, detail="Could not analyze this audio file") from error
    finally:
        Path(temp_path).unlink(missing_ok=True)


@app.post("/analyze-text", dependencies=[Depends(rate_limit("analyze-text", 60, 600))])
async def analyze_text(payload: TextAnalysisRequest) -> dict:
    text = payload.text.strip()
    lowered = text.lower()
    crisis = has_crisis_language(text)
    negative_terms = ["hopeless", "empty", "worthless", "alone", "tired", "sad", "depressed", "اندر سے خالی", "مایوس", "اداس", "تنہا"]
    positive_terms = ["better", "hopeful", "calm", "خوش", "بہتر", "پُرسکون"]
    keywords = sorted({term for term in negative_terms + positive_terms if term in lowered})
    negative_hits = sum(term in lowered for term in negative_terms)
    positive_hits = sum(term in lowered for term in positive_terms)
    sentiment: Literal["negative", "neutral", "positive"] = "negative" if negative_hits > positive_hits else "positive" if positive_hits > negative_hits else "neutral"
    linguistic_features = _linguistic_features(text)
    heuristic_result = {
        "sentiment": sentiment,
        "keyword_flags": keywords,
        "crisis_language": crisis,
        "language": payload.language,
        **_linguistic_indicators(linguistic_features),
    }
    llm_result = await analyze_with_openai(text, payload.language)
    provider = "openai" if llm_result else None
    merged = {
        **heuristic_result,
        **(llm_result or {}),
        "language": payload.language,
        "provider": provider or "heuristic",
        "linguistic_features": linguistic_features,
    }
    # Never let the LLM's classification suppress a crisis flag the
    # deterministic keyword check already caught - the spread above would
    # otherwise let a false "crisis_language": false from the LLM silently
    # overwrite the heuristic's true, and this value gates whether a crisis
    # is shown/handled at all (see /risk-assess and /ai/chat). The LLM can
    # still ADD a detection the heuristic missed; it just can't remove one.
    merged["crisis_language"] = bool(heuristic_result["crisis_language"] or merged.get("crisis_language"))
    return merged


@app.post("/support-resources")
def get_support_resources(payload: SupportResourcesRequest) -> dict:
    return support_resources(payload.themes, payload.language)


AI_CHAT_COPY = {
    "en": {
        "escalate": "A safety concern requires immediate professional or emergency support. This chat cannot provide crisis counseling.",
        "escalate_resource": "Immediate professional support",
        "grounded": "Here is grounded information related to what you shared. It is general education, not a diagnosis or treatment plan.",
    },
    "ur": {
        "escalate": "ایک حفاظتی خدشے کے لیے فوری پیشہ ورانہ یا ہنگامی مدد درکار ہے۔ یہ چیٹ بحرانی مشاورت فراہم نہیں کر سکتی۔",
        "escalate_resource": "فوری پیشہ ورانہ مدد",
        "grounded": "آپ نے جو بتایا اس سے متعلق مصدقہ معلومات یہ ہیں۔ یہ عمومی تعلیم ہے، تشخیص یا علاج کا منصوبہ نہیں۔",
    },
}


CHAT_SYSTEM_PROMPT = """You are MindHx's grounded support assistant for early-stage stress and mental-health check-ins, used mainly in Pakistan (English and Urdu). You are talking to someone before things escalate, not during a crisis - crisis messages are filtered out before they ever reach you.

STRICT RULES, no exceptions:
- Never diagnose, never name or imply a diagnosis, never prescribe or recommend medication, dosages, or brand names.
- Never provide crisis counseling or safety planning - that is handled elsewhere. If anything in the conversation reads as risk, do not improvise; keep your reply brief and defer to a professional.
- Only use facts from the "Reference material" and "Situational context" you are given. Do not invent facts, statistics, studies, or advice beyond that material. If the reference material doesn't cover something, say so plainly rather than guessing.
- Keep replies short and warm (2-5 sentences), not clinical or lecture-like.
- If the user's message is vague (e.g. "I don't feel good", "not okay", "stressed"), do not guess what's wrong - ask exactly ONE short clarifying question instead, unless the conversation history shows you already asked a clarifying question on this topic and got an answer.
- Situational context (risk band, questionnaire scores, mood trend, screening history) is background, not something to recite or diagnose from. Let it quietly shape tone and depth: e.g. more caution and a gentler pace for a rising trend or elevated band, a lighter touch for a stable low score - never mention the numbers themselves back to the user.
- If an interactive exercise fits the moment and is available in the reference material, offer to walk through it right now rather than only describing it.
- If this person has a practice listed as previously helpful, prefer offering that one again before suggesting something new.
- After 3 or more exchanges on the same topic without resolution, gently suggest one concrete next step already available in the app that fits the conversation.
- Reply in the requested language only (English or Urdu, matching the user's language field).

Return ONLY a JSON object with this exact shape:
{"action": "clarify" | "respond", "message": "<your reply text>", "offer_exercise": "<exercise id from the list, or null>", "suggested_cta": {"label": "<short label>", "href": "<one of the allowed paths>"} | null}"""

ALLOWED_CTA_HREFS = {"/", "/meditation", "/therapies", "/medication", "/therapist", "/results"}


def summarize_trajectory(check_ins: list[CheckIn]) -> Optional[str]:
    """Turns a person's recent saved check-ins into a one-line trend summary
    for the chat's situational context - never shown verbatim to the user."""
    if len(check_ins) < 2:
        return None
    order = {"low": 0, "watch": 1, "elevated": 2, "crisis": 3}
    bands = [c.band for c in reversed(check_ins) if c.band in order]
    if len(bands) < 2:
        return None
    if order[bands[-1]] > order[bands[0]]:
        trend = "rising (getting more elevated over time)"
    elif order[bands[-1]] < order[bands[0]]:
        trend = "falling (improving over time)"
    else:
        trend = "stable"
    return f"Recent screening bands, oldest to newest: {', '.join(bands)}. Trend: {trend}."


async def compose_chat_reply(
    message: str,
    language: str,
    history: list[ChatTurn],
    documents: list[dict],
    screening_context: Optional[ScreeningContext],
    trajectory_summary: Optional[str],
    mood_checkins: list[int],
    helpful_practices: list[str],
) -> Optional[dict]:
    """Composes a grounded, guarded chat reply via OpenAI's chat completions API.
    Returns None on any failure or unsafe/malformed output, so the caller can
    fall back to the deterministic template response - the chat never goes
    unanswered, it just loses the conversational layer."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    provider, model = "openai", os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    context_lines = []
    if screening_context:
        parts = []
        if screening_context.band:
            parts.append(f"risk band: {screening_context.band}")
        if screening_context.themes:
            parts.append(f"themes: {', '.join(screening_context.themes)}")
        if parts:
            context_lines.append("Current screening context (situational grounding only, not a diagnosis): " + "; ".join(parts))
    if trajectory_summary:
        context_lines.append(trajectory_summary)
    if mood_checkins:
        context_lines.append(f"Recent daily mood check-ins (1=low, 5=high), oldest to newest: {mood_checkins}")
    if helpful_practices:
        context_lines.append(f"Practices this person has said helped before: {', '.join(helpful_practices)}")

    reference_material = "\n\n".join(f"[{document['id']}] {document[language]['title']}: {document[language]['content']}" for document in documents)
    exercise_ids = ", ".join(INTERACTIVE_EXERCISES.keys())

    messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]
    for turn in history[-8:]:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": "\n\n".join([
        f"Language: {language}",
        "\n".join(context_lines) if context_lines else "No situational context available.",
        f"Reference material:\n{reference_material}",
        f"Available interactive exercise ids: {exercise_ids}",
        f"Allowed suggested_cta hrefs: {', '.join(sorted(ALLOWED_CTA_HREFS))}",
        f"User message: {message}",
    ])})

    payload = {"model": model, "temperature": 0, "response_format": {"type": "json_object"}, "messages": messages}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            result = json.loads(content)
    except httpx.HTTPStatusError as error:
        logger.error("OpenAI /ai/chat returned %s: %s", error.response.status_code, error.response.text[:500])
        return None
    except (httpx.HTTPError, KeyError, TypeError, IndexError, ValueError) as error:
        logger.error("OpenAI /ai/chat request failed: %r", error)
        return None

    if result.get("action") not in {"clarify", "respond"}:
        return None
    if not isinstance(result.get("message"), str) or not result["message"].strip():
        return None
    if has_crisis_language(result["message"]):
        # Defense in depth: never surface a generated reply that reads as crisis-adjacent,
        # even though the input was already gated - fall back to the deterministic template.
        return None
    if language == "ur" and not is_urdu_script(result["message"]):
        # The system prompt asks the model to reply in the requested language, but LLMs
        # don't always comply - never show an Urdu-selected user an English generated
        # reply; fall back to the deterministic, verified-Urdu template instead.
        return None
    if result.get("offer_exercise") not in INTERACTIVE_EXERCISES:
        result["offer_exercise"] = None
    cta = result.get("suggested_cta")
    if not (isinstance(cta, dict) and isinstance(cta.get("href"), str) and cta["href"] in ALLOWED_CTA_HREFS and isinstance(cta.get("label"), str)):
        result["suggested_cta"] = None
    result["_provider"] = provider
    result["_model"] = model
    return result


@app.post("/ai/chat", dependencies=[Depends(rate_limit("ai-chat", 30, 600))])
async def ai_chat(payload: AiSupportRequest, current_user: Optional[User] = Depends(get_optional_current_user), db: Session = Depends(get_db)) -> dict:
    """Return grounded support content only after the caller's risk gate is clear.
    Works fully anonymously; personalizes further (trajectory, remembered helpful
    practices) when a signed-in user's token is presented."""
    lang = "ur" if payload.language == "ur" else "en"
    text = AI_CHAT_COPY[lang]
    # Earlier user turns count too: once someone has disclosed a crisis in
    # this conversation, a follow-up like "what should I do?" must not get a
    # generated reply built on top of that history.
    crisis_in_conversation = has_crisis_language(payload.message) or any(
        turn.role == "user" and has_crisis_language(turn.content) for turn in payload.history
    )
    if not payload.risk_clear or crisis_in_conversation:
        return {
            "status": "escalate",
            "message": text["escalate"],
            "resources": [{"title": text["escalate_resource"], "link": "/therapist"}],
        }

    documents = retrieve_rag_documents(payload.message)
    mood_checkins = payload.mood_checkins
    helpful_practices = payload.helpful_practices
    trajectory_summary = None
    if current_user:
        recent_check_ins = db.query(CheckIn).filter(CheckIn.user_id == current_user.id).order_by(CheckIn.created_at.desc()).limit(5).all()
        trajectory_summary = summarize_trajectory(recent_check_ins)
        recent_moods = db.query(MoodCheckIn).filter(MoodCheckIn.user_id == current_user.id).order_by(MoodCheckIn.created_at.desc()).limit(14).all()
        if recent_moods:
            mood_checkins = [entry.mood for entry in reversed(recent_moods)]
        recent_practices = db.query(HelpfulPractice).filter(HelpfulPractice.user_id == current_user.id).order_by(HelpfulPractice.created_at.desc()).limit(5).all()
        if recent_practices:
            helpful_practices = [entry.practice_name for entry in recent_practices]

    composed = await compose_chat_reply(
        message=payload.message, language=lang, history=payload.history, documents=documents,
        screening_context=payload.screening_context, trajectory_summary=trajectory_summary,
        mood_checkins=mood_checkins, helpful_practices=helpful_practices,
    )

    if composed is None:
        return {
            "status": "grounded_support",
            "intent": documents[0]["intent"],
            "message": text["grounded"],
            "sources": [localize_rag_document(document, lang) for document in documents],
            "generation": {"provider": "approved-rag-library", "model": "bounded-template", "diagnosis": False, "medication_prescribing": False},
        }

    response: dict = {
        "status": "clarifying" if composed["action"] == "clarify" else "grounded_support",
        "intent": documents[0]["intent"],
        "message": composed["message"],
        "sources": [] if composed["action"] == "clarify" else [localize_rag_document(document, lang) for document in documents],
        "generation": {"provider": composed["_provider"], "model": composed["_model"], "diagnosis": False, "medication_prescribing": False},
    }
    if composed.get("offer_exercise"):
        exercise_id = composed["offer_exercise"]
        response["exercise"] = {"id": exercise_id, **INTERACTIVE_EXERCISES[exercise_id][lang]}
    if composed.get("suggested_cta"):
        response["suggested_cta"] = composed["suggested_cta"]
    return response


@app.post("/mood-checkins", status_code=201)
def create_mood_checkin(payload: MoodCheckInCreateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    entry = MoodCheckIn(user_id=current_user.id, mood=payload.mood)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "mood": entry.mood, "created_at": entry.created_at.isoformat()}


@app.get("/mood-checkins")
def list_mood_checkins(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    entries = db.query(MoodCheckIn).filter(MoodCheckIn.user_id == current_user.id).order_by(MoodCheckIn.created_at.desc()).limit(30).all()
    return [{"id": entry.id, "mood": entry.mood, "created_at": entry.created_at.isoformat()} for entry in entries]


@app.post("/helpful-practices", status_code=201)
def create_helpful_practice(payload: HelpfulPracticeRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    entry = HelpfulPractice(user_id=current_user.id, practice_name=payload.practice_name)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "practice_name": entry.practice_name, "created_at": entry.created_at.isoformat()}


@app.post("/synthesize", dependencies=[Depends(rate_limit("synthesize", 30, 3600))])
async def synthesize(payload: SpeechRequest) -> Response:
    """Generate audio with Uplift AI for Urdu text."""
    if payload.language != "ur":
        raise HTTPException(status_code=400, detail="Uplift speech generation currently supports Urdu only")
    api_key = os.getenv("UPLIFT_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="UPLIFT_API_KEY is not configured")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.upliftai.org/v1/synthesis/text-to-speech",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "voiceId": os.getenv("UPLIFT_VOICE_ID", "v_8eelc901"),
                    "text": payload.text,
                    "outputFormat": os.getenv("UPLIFT_OUTPUT_FORMAT", "MP3_22050_128"),
                },
            )
            response.raise_for_status()
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail="Uplift speech generation failed") from error

    return Response(content=response.content, media_type=response.headers.get("content-type", "audio/mpeg"))


@app.post("/score-phq9")
def score_phq9(payload: Phq9Request) -> dict:
    answers = [max(0, min(3, answer)) for answer in payload.answers]
    item_9_crisis = answers[8] > 0
    if item_9_crisis:
        return {
            "total_score": sum(answers),
            "severity_band": "crisis_flag",
            "item_9_crisis": True,
            "routing_decision": "refer_immediately",
        }
    total_score = sum(answers)
    return {
        "total_score": total_score,
        "severity_band": severity_for(total_score),
        "item_9_crisis": False,
        "routing_decision": "refer" if total_score >= 10 else "no_referral_needed",
    }


@app.post("/score-gad7")
def score_gad7_endpoint(payload: QuestionnaireRequest) -> dict:
    if len(payload.answers) != 7:
        raise HTTPException(status_code=422, detail="GAD-7 requires exactly 7 answers")
    return score_gad7(payload.answers)


@app.post("/score-k10")
def score_k10_endpoint(payload: QuestionnaireRequest) -> dict:
    if len(payload.answers) != 10:
        raise HTTPException(status_code=422, detail="K10 requires exactly 10 answers")
    return score_k10(payload.answers)


def _unit_float(value: Any) -> Optional[float]:
    """value as a float in [0, 1], or None if it isn't a real number."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return max(0.0, min(1.0, float(value)))


def _sanitize_text_analysis(supplied: dict, combined_text: str) -> dict:
    """Keeps only well-formed fields from a client-supplied /analyze-text
    result (reused to avoid a second LLM call). Crisis detection is never
    taken on the client's word: the deterministic check always runs here
    on the actual text, and can only add a crisis flag, never clear one."""
    sentiment = supplied.get("sentiment")
    result: dict = {
        "sentiment": sentiment if sentiment in {"negative", "neutral", "positive"} else "neutral",
        "crisis_language": bool(supplied.get("crisis_language") is True or has_crisis_language(combined_text)),
    }
    for field in ("anxiety_level", "stress_level", "depression_indicator"):
        value = _unit_float(supplied.get(field))
        if value is not None:
            result[field] = value
    return result


def _sanitize_voice_features(supplied: dict) -> dict:
    risk_signal = _unit_float(supplied.get("risk_signal"))
    if risk_signal is None:
        return {}
    emotion = supplied.get("emotion")
    clean_emotion = None
    if isinstance(emotion, dict):
        clean_emotion = {key: _unit_float(emotion.get(key)) for key in ("calm", "stress", "anger", "fatigue", "depression_indicator")}
        clean_emotion = {key: value for key, value in clean_emotion.items() if value is not None} or None
    return {"risk_signal": risk_signal, "emotion": clean_emotion}


@app.post("/risk-assess")
async def risk_assess(payload: RiskAssessmentRequest) -> dict:
    # Always scored here from the raw answers - a client-supplied
    # phq9_result is ignored (the field is still accepted for backward
    # compatibility), since trusting it let item 9's crisis flag be dropped.
    phq_result = score_phq9(Phq9Request(answers=payload.phq9_answers))
    gad_result = score_gad7(payload.gad7_answers)
    k10_result = score_k10(payload.k10_answers)
    combined_text = f"{payload.transcript}\n{payload.typed_text}"
    if payload.text_analysis:
        text_result = _sanitize_text_analysis(payload.text_analysis, combined_text)
    else:
        text_result = await analyze_text(TextAnalysisRequest(text=combined_text, language=payload.language))
    crisis = bool(phq_result.get("item_9_crisis") or text_result.get("crisis_language"))
    profile_data = payload.profile.model_dump() if payload.profile else {}
    themes = classify_themes(phq_result, gad_result, k10_result, text_result, combined_text)
    components = evaluate_components(phq_result, gad_result, k10_result, text_result, _sanitize_voice_features(payload.voice_features))
    plan = support_plan(phq_result, gad_result, k10_result, crisis, profile_data, themes)
    if crisis:
        return {
            "risk_score": 1.0,
            "band": "crisis",
            "explanation": ["A crisis signal was detected and takes priority over the combined score."],
            "routing_decision": "refer_immediately",
            "crisis_flag": True,
            "themes": themes,
            "components": components,
            "phq9": phq_result,
            "gad7": gad_result,
            "k10": k10_result,
            "support_plan": plan,
        }

    risk_score = components["combined_signal"]
    band = "elevated" if risk_score >= 0.40 else "watch" if risk_score >= 0.2 else "low"
    if plan["route"] == "psychiatric_referral":
        # A moderate-or-worse result on any single questionnaire already
        # routes to a professional evaluation; never pair that advice with a
        # "low" or "watch" label just because the other signals were quiet.
        band = "elevated"
    return {
        "risk_score": risk_score,
        "band": band,
        "explanation": [f"PHQ-9 contributed {components['phq9']['score']} of 27 points.", f"GAD-7 contributed {components['gad7']['score']} of 21 points and K10 contributed {components['k10']['score']} of 50 points.", f"Text sentiment was {text_result.get('sentiment', 'neutral')}.", components["voice"]["note"]],
        "routing_decision": "refer" if plan["route"] == "psychiatric_referral" else "no_referral_needed",
        "crisis_flag": False,
        "themes": themes,
        "components": components,
        "phq9": phq_result,
        "gad7": gad_result,
        "k10": k10_result,
        "support_plan": plan,
    }
