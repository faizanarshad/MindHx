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

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
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
