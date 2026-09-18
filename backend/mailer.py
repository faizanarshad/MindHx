"""Minimal SMTP email sender, used only by the forgot-password flow.

No SMTP_HOST configured (the local-dev default) means there is nowhere to
actually deliver mail, so this logs the message - including the reset link
- to the console instead of failing. That mirrors JWT_SECRET_KEY's
fail-safe-for-local-dev pattern elsewhere in this codebase: the feature
stays testable with no external setup, but silently doing nothing in a
real deployment would be worse than a loud warning. Set SMTP_* in the
environment for any real deployment.
"""

import os
import smtplib
from email.message import EmailMessage

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "no-reply@mindhx.local")


def send_email(to: str, subject: str, html_body: str, text_body: str) -> None:
    if not SMTP_HOST:
        print(
            f"WARNING: SMTP_HOST is not set - printing email instead of sending it.\n"
            f"--- Email to {to} ---\nSubject: {subject}\n\n{text_body}\n--- end email ---"
        )
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = to
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
        server.starttls()
        if SMTP_USERNAME and SMTP_PASSWORD:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(message)
