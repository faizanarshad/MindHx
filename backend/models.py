"""SQLAlchemy models for the account/dashboard feature.

CheckIn stores every section's structured result (scores, bands,
sentiment/mood/voice breakdowns, support plan) and the individual
questionnaire answers (answers_json, which admins can also read). The
voice transcript and written reflection are stored only inside the PDF
report (CheckInReport) generated after each check-in, so the person can
show it to their doctor later; that report is visible only to its owner,
can be deleted by them at any time, and is deleted with the check-in or
account. This makes a leaked database more sensitive than scores alone
would be.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    age_range: Mapped[str] = mapped_column(String(20), nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    marital_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    life_context: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    preferred_language: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    # A small (client-resized, ~256px) image as a data: URL, stored inline
    # rather than in object storage - simplest option given no external
    # storage service is configured, and avatars are small enough that this
    # doesn't meaningfully bloat the row. Text, not String, since base64
    # image data comfortably exceeds a typical varchar length.
    avatar_data_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Grants access to /admin (analytics + resource CMS). Never settable via
    # any user-facing endpoint (registration, profile update) - only ever
    # flipped in the database, via `python backend/manage.py promote <email>`,
    # so signing up (even with an email meant to be an admin's) can't grant it.
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Embedded in every issued JWT and bumped on each password change/reset,
    # so tokens issued before the change stop working immediately instead of
    # living out their expiry.
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    check_ins: Mapped[list["CheckIn"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class CheckIn(Base):
    __tablename__ = "check_ins"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    band: Mapped[str] = mapped_column(String(20), nullable=False)
    routing_decision: Mapped[str] = mapped_column(String(30), nullable=False)
    themes: Mapped[str] = mapped_column(String(200), default="")
    # Every section's structured result (PHQ-9/GAD-7/K10 sub-scores+bands,
    # text sentiment/mood breakdown, voice signal breakdown, support plan) as
    # JSON. The transcript, typed text, and individual answers aren't in
    # here - they're only in the PDF report (CheckInReport), which the
    # owner can delete on its own.
    details_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # The individual PHQ-9/GAD-7/K10 item answers, as JSON
    # {"phq9": [9 ints 0-3], "gad7": [7 ints 0-3], "k10": [10 ints 1-5]},
    # readable by admins from the admin panel (GET /admin/users/{id}/checkins)
    # and disclosed to users on the register/login/dashboard pages. Still
    # never the transcript or typed text. Null for check-ins saved before
    # answers were recorded.
    answers_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped[User] = relationship(back_populates="check_ins")


class MoodCheckIn(Base):
    """A lightweight 1-5 daily mood check-in, separate from a full PHQ-family
    screening - a cheap trend signal for the AI chat's situational context."""
    __tablename__ = "mood_checkins"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    mood: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class PasswordResetToken(Base):
    """A one-time, expiring token for the forgot-password flow. Stores a
    hash of the token, never the raw value emailed to the user - mirrors
    how User.hashed_password is never the plaintext password."""
    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class HelpfulPractice(Base):
    """A coping practice this specific person has said helped before, so the
    AI chat can reference it instead of suggesting something new every time."""
    __tablename__ = "helpful_practices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    practice_name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Resource(Base):
    """An admin-authored resource post (meditation/therapy/medication/general
    guidance), shown on the public /resources page. Separate from the
    existing static content in src/app/meditation/data.ts and
    src/app/therapies/data.ts, which stays exactly as it is - this is
    additive content admins can publish without a code change/deploy, not a
    replacement for what's already shipped."""
    __tablename__ = "resources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    resource_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # "meditation" | "therapy" | "medication" | "general"
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(String(400), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    # Client-resized image as a data: URL, same inline-storage approach as
    # User.avatar_data_url - no object storage service is configured.
    image_data_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class PageView(Base):
    """One row per page load, for the admin analytics dashboard's site-visit
    counts. Deliberately minimal: just the path and a timestamp - no IP
    address, user agent, referrer, cookie, or session identifier of any
    kind, so this can never be used to reconstruct an individual visitor's
    path through the site. That's a real constraint on what "site visits"
    can mean here, not an oversight: this app already goes out of its way
    (see CheckIn's docstring) to keep what it collects to the minimum that's
    actually useful, and a mental-health app is a bad place to add
    fine-grained visitor tracking as a side effect of an admin dashboard."""
    __tablename__ = "page_views"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    path: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)


class LoginSession(Base):
    """One row per successful sign-in (login or registration) - the
    account's login history, and the server-side record each JWT is tied
    to (its "sid" claim), so a session can be signed out from anywhere.

    ip_address and user_agent are kept so a person can recognise their own
    devices and spot a sign-in that wasn't them. Unlike PageView (which is
    deliberately anonymous), this is visible only to the account's owner,
    exists only for people who chose to create an account, is pruned after
    LOGIN_HISTORY_RETENTION_DAYS, and is deleted with the account."""
    __tablename__ = "login_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    method: Mapped[str] = mapped_column(String(20), nullable=False, default="login")  # "login" | "register" | "password_change"
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    # Set on sign-out, on "sign out this device" from the history list, or
    # when a password change/reset signs out other sessions.
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_reason: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # "logout" | "revoked" | "password_change" | "password_reset"


class CheckInReport(Base):
    """The PDF report generated in the browser after a check-in (see
    src/app/lib/resultsPdf.ts), saved so the person can re-download and show
    it to a doctor later. Kept in its own table so listing check-ins never
    loads PDF bytes. One report per check-in; re-uploading replaces it."""
    __tablename__ = "check_in_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    check_in_id: Mapped[str] = mapped_column(String(36), ForeignKey("check_ins.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    pdf_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
