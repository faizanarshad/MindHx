"""Password hashing and JWT session tokens for the optional account feature.

JWT_SECRET_KEY must be set explicitly in any real deployment. If it's
unset, we generate a random one for this process only - tokens issued
before a restart become invalid, which is a safe failure mode (nobody
stays "logged in" on a secret nobody chose), unlike silently shipping a
fixed default secret that would let anyone forge tokens.
"""

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError
from sqlalchemy.orm import Session

from database import get_db
from models import User

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    JWT_SECRET_KEY = secrets.token_urlsafe(32)
    print("WARNING: JWT_SECRET_KEY is not set - using a random per-process secret. "
          "Set JWT_SECRET_KEY in the environment for any real deployment; otherwise "
          "every restart invalidates all issued tokens.")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
PASSWORD_RESET_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30"))

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(subject: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expires_at}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except PyJWTError:
        return None


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    if not credentials:
        raise unauthorized
    user_id = decode_access_token(credentials.credentials)
    if not user_id:
        raise unauthorized
    user = db.get(User, user_id)
    if not user:
        raise unauthorized
    return user


def generate_reset_token() -> str:
    """The raw, high-entropy token put in the emailed reset link. Only its
    hash (see hash_reset_token) is ever stored, so a leaked database can't
    be used to forge password resets."""
    return secrets.token_urlsafe(32)


def hash_reset_token(token: str) -> str:
    # A fast hash is fine here (unlike bcrypt for passwords): the token
    # itself already has 256 bits of entropy, so it isn't brute-forceable
    # the way a human-chosen password is.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def as_aware_utc(value: datetime) -> datetime:
    """SQLite (local dev) hands back naive datetimes for DateTime(timezone=True)
    columns; Postgres (production) hands back timezone-aware ones. Normalize
    to aware-UTC before comparing so expiry checks work on both."""
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Like get_current_user, but returns None instead of raising 401 - for
    endpoints (like /ai/chat) that must work for anonymous callers too, while
    still personalizing when a valid token is present."""
    if not credentials:
        return None
    user_id = decode_access_token(credentials.credentials)
    if not user_id:
        return None
    return db.get(User, user_id)
