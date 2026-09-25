"""SQLAlchemy models for the optional account/dashboard feature.

The core check-in flow remains fully anonymous and requires no account -
these tables only back the opt-in "save my history" feature for signed-in
users. CheckIn stores every section's structured result (scores, bands,
sentiment/mood/voice breakdowns, support plan) but deliberately never the
raw transcript, typed text, or individual question answers, so a saved
history can't leak someone's actual free-text disclosures even if the
database were compromised.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
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
    # flipped directly in the database, so signing up can't grant it.
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
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
    # JSON - deliberately still never the raw transcript, typed text, or
    # individual question answers, which stay browser-only (see
    # HomeClient's mindhx:last-checkin-detail and resultsPdf.ts). This is a
    # meaningfully bigger set of saved detail than before, but keeps the
    # same "no raw free text ever persisted" line the rest of this file's
    # docstring describes.
    details_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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
