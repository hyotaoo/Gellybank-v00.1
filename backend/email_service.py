"""Minimal SMTP delivery for account verification codes.

Configure with SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM and
optionally SMTP_USE_SSL. Set MAIL_SUPPRESS=1 to capture messages in OUTBOX
instead of sending them (used by the test suite).
"""

import os
import smtplib
from email.message import EmailMessage

OUTBOX = []


def _is_suppressed():
    if os.environ.get("MAIL_SUPPRESS") == "1":
        return True
    try:
        from flask import current_app

        return bool(current_app.config.get("TESTING"))
    except (ImportError, RuntimeError):
        return False


def send_verification_code(to_email, code):
    if _is_suppressed():
        OUTBOX.append({"to": to_email, "code": code})
        if os.environ.get("MAIL_SUPPRESS") == "1":
            print(f"[mail suppressed] verification code for {to_email}: {code}", flush=True)
        return

    host = os.environ.get("SMTP_HOST")
    sender = os.environ.get("SMTP_FROM")
    if not host or not sender:
        raise RuntimeError("SMTP_HOST and SMTP_FROM must be set to send verification email.")

    port = int(os.environ.get("SMTP_PORT", "587"))
    use_ssl = os.environ.get("SMTP_USE_SSL") == "1"
    username = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")

    message = EmailMessage()
    message["Subject"] = "Your Gellybank verification code"
    message["From"] = sender
    message["To"] = to_email
    message.set_content(
        f"Your Gellybank verification code is {code}.\n\n"
        "It expires in 15 minutes. If you did not create an account, ignore this email."
    )

    if use_ssl:
        client = smtplib.SMTP_SSL(host, port, timeout=15)
    else:
        client = smtplib.SMTP(host, port, timeout=15)
    try:
        if not use_ssl:
            client.starttls()
        if username:
            client.login(username, password or "")
        client.send_message(message)
    finally:
        client.quit()
