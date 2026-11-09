

import os
import csv
import io
import random
import base64
import binascii
import hashlib
import hmac
import secrets
import subprocess
import tempfile
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from functools import wraps
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file, Response
from werkzeug.exceptions import HTTPException
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import text
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import check_password_hash, generate_password_hash

try:
    from .email_service import send_verification_code
except ImportError:
    from email_service import send_verification_code


load_dotenv()

SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise SystemExit(
        "SECRET_KEY is not set. Add it to backend/.env before starting the app."
    )

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit(
        "No DATABASE_URL found. Run 'python dev.py' from the repo root to "
        "create backend/.env, then start the app again."
    )

TOKEN_MAX_AGE = 60 * 60 * 24  

VERIFICATION_TTL = timedelta(minutes=15)
VERIFICATION_MAX_ATTEMPTS = 5
VERIFICATION_RESEND_SECONDS = 60

CONSENT_VERSION = "v1.0, 2026-11-03"

DEMO_EMAIL = "demo@gellybank.com"
DEMO_PASSWORD = "demo12345"

BACKUP_DIR = Path(__file__).resolve().parent.parent / "backups"

# In-memory brute force protection for login attempts
LOGIN_ATTEMPTS = {}
LOGIN_ATTEMPT_WINDOW = 300  # 5 minutes
LOGIN_ATTEMPT_MAX = 5


app = Flask(__name__)
app.config["SECRET_KEY"] = SECRET_KEY
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
env_origin = os.environ.get("FRONTEND_ORIGIN")
if env_origin:
    ALLOWED_ORIGINS = [env_origin]
CORS(app, origins=ALLOWED_ORIGINS)

db = SQLAlchemy()
db.init_app(app)

ID_TYPE = db.BigInteger().with_variant(db.Integer, "sqlite")
SMALL_ID_TYPE = db.SmallInteger().with_variant(db.Integer, "sqlite")


DEFAULT_CURRENCY = "PHP"
CENT = Decimal("0.01")


def to_money(value):
    try:
        return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("Enter a valid amount.")


def check_amount(value):
    amount = to_money(value)
    if amount <= 0:
        raise ValueError("Amount must be greater than zero.")
    return amount


def as_number(amount):
    return float(amount or 0)



def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def new_reference():
    return "TXN-" + uuid4().hex[:10].upper()


def new_account_number():
    return str(uuid4().int)[:12].zfill(12)


def as_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def body():
    return request.get_json(silent=True) or {}


def error(message, status=400, code=None):
    payload = {"message": message}
    if code:
        payload["code"] = code
    return jsonify(payload), status


def prune_login_attempts(now):
    """Drop expired entries so LOGIN_ATTEMPTS stays small."""
    for key in list(LOGIN_ATTEMPTS):
        count, first_at = LOGIN_ATTEMPTS[key]
        if now - first_at > LOGIN_ATTEMPT_WINDOW:
            del LOGIN_ATTEMPTS[key]


def login_is_locked(email, ip_address):
    """Return remaining lock seconds if either the email or IP is throttled."""
    now = time.monotonic()
    prune_login_attempts(now)
    for key in (f"email:{email}", f"ip:{ip_address}"):
        entry = LOGIN_ATTEMPTS.get(key)
        if not entry:
            continue
        count, first_at = entry
        if count >= LOGIN_ATTEMPT_MAX:
            remaining = LOGIN_ATTEMPT_WINDOW - (now - first_at)
            if remaining > 0:
                return remaining
            del LOGIN_ATTEMPTS[key]
    return 0


def record_login_failure(email, ip_address):
    now = time.monotonic()
    for key in (f"email:{email}", f"ip:{ip_address}"):
        count, first_at = LOGIN_ATTEMPTS.get(key, (0, now))
        LOGIN_ATTEMPTS[key] = (count + 1, first_at if now - first_at <= LOGIN_ATTEMPT_WINDOW else now)


def clear_login_attempts(email, ip_address):
    LOGIN_ATTEMPTS.pop(f"email:{email}", None)
    LOGIN_ATTEMPTS.pop(f"ip:{ip_address}", None)



def hash_password(password):
    return generate_password_hash(password)


def check_password(password_hash, password):
    return check_password_hash(password_hash, password)


def make_token(user):
    serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])
    return serializer.dumps({
        "user_id": user.user_id,
        "auth_token_version": user.auth_token_version,
    }, salt="auth")


def current_user():
    return authenticated_user()


def authenticated_user():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None

    serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])
    try:
        data = serializer.loads(header[7:], salt="auth", max_age=TOKEN_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None

    user = db.session.get(AppUser, data.get("user_id"))
    if not user or not user.is_active:
        return None
    if data.get("auth_token_version", 0) != user.auth_token_version:
        return None
    return user


def authenticated_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not authenticated_user():
            return error("Authentication required.", 401, "unauthorized")
        return view(*args, **kwargs)
    return wrapped


def role_required(role):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            user = authenticated_user()
            if not user:
                return error("Authentication required.", 401, "unauthorized")
            if user.role != role.upper():
                return error("You do not have permission to perform this action.", 403, "forbidden")
            return view(*args, **kwargs)
        return wrapped
    return decorator


def admin_required(view):
    return role_required("ADMIN")(view)


def teller_required(view):
    return role_required("TELLER")(view)


def staff_required(view):
    """Admin or teller."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = authenticated_user()
        if not user:
            return error("Authentication required.", 401, "unauthorized")
        if user.role not in ("ADMIN", "TELLER"):
            return error("You do not have permission to perform this action.", 403, "forbidden")
        return view(*args, **kwargs)
    return wrapped


def log_audit(action, entity_type, entity_id=None, actor_user_id=None, severity="INFO", details=None):
    db.session.add(AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        severity=severity,
        details=details,
        ip_address=request.remote_addr,
    ))



class Customer(db.Model):
    __tablename__ = "customers"

    customer_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    first_name = db.Column(db.String(50), nullable=False)
    middle_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50), nullable=False)
    date_of_birth = db.Column(db.Date)
    email = db.Column(db.String(254), nullable=False, unique=True)
    phone = db.Column(db.String(20))
    address = db.Column(db.String(255))
    avatar = db.Column(db.Text().with_variant(MEDIUMTEXT(), "mysql"))
    status = db.Column(db.String(20), nullable=False, default="ACTIVE")
    terms_accepted_at = db.Column(db.DateTime)
    privacy_accepted_at = db.Column(db.DateTime)
    consent_version = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    @property
    def full_name(self):
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join(part for part in parts if part)


class AppUser(db.Model):
    __tablename__ = "app_users"

    user_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    customer_id = db.Column(db.BigInteger, db.ForeignKey("customers.customer_id"))
    username = db.Column(db.String(50), nullable=False, unique=True)
    display_name = db.Column(db.String(100))
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="CUSTOMER")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    email_verified_at = db.Column(db.DateTime)
    auth_token_version = db.Column(db.Integer, nullable=False, default=0)
    last_login_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    @property
    def customer(self):
        if not self.customer_id:
            return None
        return db.session.get(Customer, self.customer_id)

    def to_dict(self):
        customer = self.customer
        return {
            "id": str(self.user_id),
            "firstName": customer.first_name if customer else self.display_name or self.username,
            "lastName": customer.last_name if customer else "",
            "displayName": self.display_name,
            "email": customer.email if customer else self.username,
            "role": {
                "ADMIN": "admin",
                "TELLER": "teller",
                "CUSTOMER": "customer",
            }.get(self.role, "customer"),
        }


class AccountType(db.Model):
    __tablename__ = "account_types"

    account_type_id = db.Column(SMALL_ID_TYPE, primary_key=True, autoincrement=True)
    type_name = db.Column(db.String(30), nullable=False, unique=True)  
    description = db.Column(db.String(255))
    minimum_balance = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    default_interest_rate = db.Column(db.Numeric(5, 2), nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=utcnow)


class BankAccount(db.Model):
    __tablename__ = "bank_accounts"

    account_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    customer_id = db.Column(db.BigInteger, db.ForeignKey("customers.customer_id"), nullable=False)
    account_type_id = db.Column(
        db.SmallInteger, db.ForeignKey("account_types.account_type_id"), nullable=False
    )
    account_number = db.Column(db.String(20), nullable=False, unique=True)
    current_balance = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    interest_rate = db.Column(db.Numeric(5, 2), nullable=False, default=0)
    status = db.Column(db.String(20), nullable=False, default="ACTIVE")
    opened_at = db.Column(db.DateTime, default=utcnow)
    closed_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    @property
    def account_type(self):
        return db.session.get(AccountType, self.account_type_id)

    @property
    def type_name(self):
        return (self.account_type.type_name if self.account_type else "savings").lower()

    def to_dict(self, is_primary=False):
        return {
            "id": str(self.account_id),
            "accountNumber": self.account_number,
            "type": self.type_name,
            "label": self.type_name.capitalize(),
            "balance": as_number(self.current_balance),
            "currency": DEFAULT_CURRENCY,
            "status": self.status.lower(),
            "isPrimary": is_primary,
            "interestRate": as_number(self.interest_rate),
            "createdAt": self.opened_at.isoformat() + "Z" if self.opened_at else None,
        }


class Transfer(db.Model):
    __tablename__ = "transfers"

    transfer_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    reference_code = db.Column(db.String(40), nullable=False, unique=True)
    from_account_id = db.Column(db.BigInteger, db.ForeignKey("bank_accounts.account_id"), nullable=False)
    to_account_id = db.Column(db.BigInteger, db.ForeignKey("bank_accounts.account_id"), nullable=False)
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="COMPLETED")
    initiated_by_user_id = db.Column(db.BigInteger, db.ForeignKey("app_users.user_id"))
    description = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=utcnow)
    completed_at = db.Column(db.DateTime)


class Transaction(db.Model):
    __tablename__ = "transactions"

    transaction_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    account_id = db.Column(db.BigInteger, db.ForeignKey("bank_accounts.account_id"), nullable=False)
    transfer_id = db.Column(db.BigInteger, db.ForeignKey("transfers.transfer_id"))
    transaction_type = db.Column(db.String(20), nullable=False)
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    balance_after = db.Column(db.Numeric(15, 2), nullable=False)
    reference_code = db.Column(db.String(40), nullable=False, unique=True)
    description = db.Column(db.String(255))
    performed_by_user_id = db.Column(db.BigInteger, db.ForeignKey("app_users.user_id"))
    status = db.Column(db.String(20), nullable=False, default="COMPLETED")
    created_at = db.Column(db.DateTime, default=utcnow)

    APP_TYPES = {
        "DEPOSIT": "deposit",
        "WITHDRAWAL": "withdraw",
        "TRANSFER_OUT": "transfer",
        "TRANSFER_IN": "deposit",  
        "ADJUSTMENT": "deposit",
    }

    @property
    def app_type(self):
        return self.APP_TYPES.get(self.transaction_type, "deposit")

    @property
    def counterparty(self):
        if not self.transfer_id:
            return None
        transfer = db.session.get(Transfer, self.transfer_id)
        if not transfer:
            return None
        other_id = transfer.to_account_id if self.transaction_type == "TRANSFER_OUT" else transfer.from_account_id
        other = db.session.get(BankAccount, other_id)
        if not other:
            return None
        customer = db.session.get(Customer, other.customer_id)
        return customer.full_name if customer else other.account_number

    def to_dict(self):
        return {
            "id": str(self.transaction_id),
            "accountId": str(self.account_id),
            "type": self.app_type,
            "amount": as_number(self.amount),
            "currency": DEFAULT_CURRENCY,
            "balanceAfter": as_number(self.balance_after),
            "note": self.description,
            "counterparty": self.counterparty,
            "reference": self.reference_code,
            "status": self.status.lower(),
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class Notification(db.Model):
    __tablename__ = "notifications"

    notification_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey("app_users.user_id"), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    message = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(30), nullable=False, default="SYSTEM")
    link = db.Column(db.String(255))
    read_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": str(self.notification_id),
            "title": self.title,
            "message": self.message,
            "category": self.category.lower(),
            "link": self.link,
            "read": self.read_at is not None,
            "readAt": self.read_at.isoformat() + "Z" if self.read_at else None,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


def push_notification(user_id, title, message, category="SYSTEM", link=None):
    """Queue an in-app notification; the caller is responsible for committing."""
    if user_id is None:
        return
    db.session.add(Notification(
        user_id=user_id,
        title=(title or "").strip()[:120],
        message=(message or "").strip()[:255],
        category=category,
        link=link,
    ))


def notification_user_id(customer_id):
    """Map a customer to the app user that should receive account notifications."""
    if customer_id is None:
        return None
    user = AppUser.query.filter_by(customer_id=customer_id).first()
    return user.user_id if user else None


class BankCard(db.Model):
    __tablename__ = "bank_cards"

    card_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    account_id = db.Column(db.BigInteger, db.ForeignKey("bank_accounts.account_id"), nullable=False)
    card_number_token_or_last4 = db.Column(db.String(100), nullable=False, unique=True)
    card_number = db.Column(db.String(19), unique=True)
    cvv = db.Column(db.String(4))
    card_type = db.Column(db.String(20), nullable=False, default="DEBIT")  
    status = db.Column(db.String(20), nullable=False, default="ACTIVE")
    issued_at = db.Column(db.DateTime, default=utcnow)
    expires_on = db.Column(db.Date)
    blocked_at = db.Column(db.DateTime)
    cancelled_at = db.Column(db.DateTime)

    def to_dict(self):
        number = self.card_number or self.card_number_token_or_last4
        return {
            "id": str(self.card_id),
            "accountId": str(self.account_id),
            "type": self.card_type.lower(),
            "last4": number[-4:] if number else None,
            "cardNumber": self.card_number,
            "cvv": self.cvv,
            "status": self.status.lower(),
            "expiresOn": self.expires_on.isoformat() if self.expires_on else None,
            "issuedAt": self.issued_at.isoformat() + "Z" if self.issued_at else None,
        }


class Beneficiary(db.Model):
    __tablename__ = "beneficiaries"

    beneficiary_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    customer_id = db.Column(db.BigInteger, db.ForeignKey("customers.customer_id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    account_number = db.Column(db.String(30), nullable=False)
    bank = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": str(self.beneficiary_id),
            "name": self.name,
            "accountNumber": self.account_number,
            "bank": self.bank,
        }


class AccountApplication(db.Model):
    __tablename__ = "account_applications"

    application_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    customer_id = db.Column(db.BigInteger, db.ForeignKey("customers.customer_id"), nullable=False)
    applicant_user_id = db.Column(db.BigInteger, db.ForeignKey("app_users.user_id"), nullable=False)
    account_type_id = db.Column(
        db.SmallInteger, db.ForeignKey("account_types.account_type_id"), nullable=False
    )
    initial_deposit = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    account_label = db.Column(db.String(40))
    make_primary = db.Column(db.Boolean, nullable=False, default=False)
    status = db.Column(db.String(20), nullable=False, default="PENDING")
    rejection_reason = db.Column(db.String(500))
    created_account_id = db.Column(db.BigInteger, db.ForeignKey("bank_accounts.account_id"))
    reviewed_by_user_id = db.Column(db.BigInteger, db.ForeignKey("app_users.user_id"))
    created_at = db.Column(db.DateTime, default=utcnow)
    reviewed_at = db.Column(db.DateTime)

    @property
    def customer(self):
        return db.session.get(Customer, self.customer_id)

    @property
    def account_type(self):
        return db.session.get(AccountType, self.account_type_id)

    def to_dict(self):
        customer = self.customer
        account_type = self.account_type
        account = (
            db.session.get(BankAccount, self.created_account_id)
            if self.created_account_id is not None
            else None
        )
        return {
            "id": str(self.application_id),
            "customerId": str(self.customer_id),
            "customerName": customer.full_name if customer else "",
            "customerEmail": customer.email if customer else "",
            "accountType": account_type.type_name.lower() if account_type else "",
            "initialDeposit": as_number(self.initial_deposit),
            "label": self.account_label,
            "status": self.status.lower(),
            "rejectionReason": self.rejection_reason,
            "accountId": str(self.created_account_id) if self.created_account_id is not None else None,
            "accountNumber": account.account_number if account else None,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "reviewedAt": self.reviewed_at.isoformat() + "Z" if self.reviewed_at else None,
        }


class TransactionRequest(db.Model):
    __tablename__ = "transaction_requests"

    request_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    customer_id = db.Column(db.BigInteger, db.ForeignKey("customers.customer_id"), nullable=False)
    account_id = db.Column(db.BigInteger, db.ForeignKey("bank_accounts.account_id"), nullable=False)
    requested_by_user_id = db.Column(
        db.BigInteger, db.ForeignKey("app_users.user_id", ondelete="CASCADE"), nullable=False
    )
    transaction_type = db.Column(db.String(20), nullable=False)  # DEPOSIT or WITHDRAWAL
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    note = db.Column(db.String(255))
    status = db.Column(db.String(20), nullable=False, default="PENDING")
    rejection_reason = db.Column(db.String(500))
    reviewed_by_user_id = db.Column(db.BigInteger, db.ForeignKey("app_users.user_id"))
    transaction_id = db.Column(db.BigInteger, db.ForeignKey("transactions.transaction_id"))
    created_at = db.Column(db.DateTime, default=utcnow)
    reviewed_at = db.Column(db.DateTime)

    @property
    def customer(self):
        return db.session.get(Customer, self.customer_id)

    @property
    def account(self):
        return db.session.get(BankAccount, self.account_id)

    def to_dict(self, include_customer=False):
        customer = self.customer
        account = self.account
        reviewer = (
            db.session.get(AppUser, self.reviewed_by_user_id)
            if self.reviewed_by_user_id is not None
            else None
        )
        data = {
            "id": str(self.request_id),
            "accountId": str(self.account_id),
            "accountNumber": account.account_number if account else None,
            "accountLabel": account.type_name.capitalize() if account else None,
            "type": self.transaction_type.lower(),
            "amount": as_number(self.amount),
            "currency": DEFAULT_CURRENCY,
            "note": self.note,
            "status": self.status.lower(),
            "rejectionReason": self.rejection_reason,
            "transactionId": str(self.transaction_id) if self.transaction_id is not None else None,
            "reviewedByRole": reviewer.role.lower() if reviewer else None,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "reviewedAt": self.reviewed_at.isoformat() + "Z" if self.reviewed_at else None,
        }
        if include_customer:
            data["customerName"] = customer.full_name if customer else ""
            data["customerEmail"] = customer.email if customer else ""
            data["customerId"] = str(self.customer_id)
        return data


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    reset_token_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.BigInteger, db.ForeignKey("app_users.user_id", ondelete="CASCADE"), nullable=False
    )
    token_hash = db.Column(db.String(64), nullable=False, unique=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)


class EmailVerificationToken(db.Model):
    __tablename__ = "email_verification_tokens"

    verification_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.BigInteger, db.ForeignKey("app_users.user_id", ondelete="CASCADE"), nullable=False
    )
    code_hash = db.Column(db.String(64), nullable=False)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    audit_log_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    actor_user_id = db.Column(db.BigInteger, db.ForeignKey("app_users.user_id"))
    action = db.Column(db.String(100), nullable=False)
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.String(100))
    details = db.Column(db.JSON)
    severity = db.Column(db.String(10), nullable=False, default="INFO")
    ip_address = db.Column(db.String(45))
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": str(self.audit_log_id),
            "actorId": str(self.actor_user_id) if self.actor_user_id is not None else None,
            "action": self.action,
            "entityType": self.entity_type,
            "entityId": self.entity_id,
            "severity": self.severity,
            "details": self.details or {},
            "ipAddress": self.ip_address,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class BankSetting(db.Model):
    """Single-row table (setting_id=1) with site-wide bank configuration."""
    __tablename__ = "bank_settings"

    setting_id = db.Column(SMALL_ID_TYPE, primary_key=True, autoincrement=True)
    bank_name = db.Column(db.String(80), nullable=False, default="GellyBank!")
    contact_email = db.Column(db.String(254))
    contact_phone = db.Column(db.String(20))
    address = db.Column(db.String(255))
    logo_data = db.Column(db.Text().with_variant(MEDIUMTEXT(), "mysql"))
    maintenance_mode = db.Column(db.Boolean, nullable=False, default=False)
    updated_by_user_id = db.Column(db.BigInteger)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    def public_dict(self):
        return {
            "bankName": self.bank_name,
            "contactEmail": self.contact_email,
            "contactPhone": self.contact_phone,
            "address": self.address,
            "logo": self.logo_data,
            "maintenanceMode": bool(self.maintenance_mode),
        }


def bank_settings():
    """Loads (creating once) the single settings row."""
    setting = db.session.get(BankSetting, 1)
    if setting is None:
        setting = BankSetting(setting_id=1)
        db.session.add(setting)
        db.session.commit()
    return setting


MAINTENANCE_EXEMPT_PREFIXES = ("/api/settings", "/api/health", "/api/auth/", "/api/admin/")


@app.before_request
def enforce_maintenance_mode():
    """Customer/teller API calls are blocked while maintenance mode is on."""
    path = request.path
    if not path.startswith("/api/") or any(path.startswith(p) for p in MAINTENANCE_EXEMPT_PREFIXES):
        return None
    try:
        settings_row = db.session.get(BankSetting, 1)
    except SQLAlchemyError:
        return None
    if settings_row is None or not settings_row.maintenance_mode:
        return None
    return error("The system is down for maintenance. Try again later.", 503, "maintenance")


def primary_account_id(customer_id):
    first = (
        BankAccount.query
        .filter_by(customer_id=customer_id, status="ACTIVE")
        .order_by(BankAccount.account_id)
        .first()
    )
    return first.account_id if first else None


def my_account(account_id, user):
    if not user.customer_id:
        return None
    return BankAccount.query.filter_by(
        account_id=as_int(account_id), customer_id=user.customer_id
    ).first()


def any_account(account_id):
    """Look up any bank account by id, for admin/teller oversight."""
    return BankAccount.query.filter_by(account_id=as_int(account_id)).first()



@app.get("/api/accounts")
@authenticated_required
def list_accounts():
    user = current_user()
    if not user.customer_id:
        return jsonify([])

    accounts = (
        BankAccount.query
        .filter_by(customer_id=user.customer_id)
        .order_by(BankAccount.account_id)
        .all()
    )
    primary = primary_account_id(user.customer_id)
    return jsonify([a.to_dict(is_primary=(a.account_id == primary)) for a in accounts])


@app.post("/api/accounts")
@authenticated_required
def create_account():
    user = authenticated_user()
    if not user:
        return error("Authentication required.", 401, "unauthorized")
    if user.role != "CUSTOMER":
        return error("Only customer accounts can apply for a bank account.", 403, "forbidden")
    if not user.customer_id:
        return error("No customer profile for this user.", 400, "no_customer")

    data = body()
    type_name = str(data.get("type") or "savings").upper()
    account_type = AccountType.query.filter_by(type_name=type_name).first()
    if not account_type:
        return error("Account type must be 'savings' or 'checking'.", 400, "invalid_type")

    try:
        initial = to_money(data.get("initialDeposit") or 0)
    except ValueError:
        return error("Enter a valid initial deposit.", 400, "invalid_amount")
    if initial < 0:
        return error("Initial deposit cannot be negative.", 400, "invalid_amount")
    if type_name == "SAVINGS" and initial > 0 and initial < account_type.minimum_balance:
        return error(
            f"Savings accounts require at least {as_number(account_type.minimum_balance):.2f} to open.",
            400,
            "minimum_initial_deposit",
        )

    application = AccountApplication(
        customer_id=user.customer_id,
        applicant_user_id=user.user_id,
        account_type_id=account_type.account_type_id,
        initial_deposit=initial,
        account_label=(data.get("label") or "").strip()[:40] or None,
        make_primary=bool(data.get("isPrimary")),
    )
    db.session.add(application)
    db.session.commit()

    result = application.to_dict()
    result["label"] = application.account_label or account_type.type_name.title()
    return jsonify(result), 201


@app.get("/api/admin/dashboard")
@admin_required
def admin_dashboard():
    try:
        db.session.execute(text("SELECT 1"))

        def tx_sums(start=None):
            query = Transaction.query.filter(Transaction.status != "VOID")
            if start:
                query = query.filter(Transaction.created_at >= start)
            rows = query.with_entities(
                Transaction.transaction_type,
                db.func.count().label("count"),
                db.func.coalesce(db.func.sum(Transaction.amount), 0).label("total"),
            ).group_by(Transaction.transaction_type).all()
            return {
                row[0].lower(): {"count": row[1], "total": as_number(row[2])}
                for row in rows
                if row[0] in ("DEPOSIT", "WITHDRAWAL")
            }

        day_start = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        recent_activity = (
            AuditLog.query
            .order_by(AuditLog.created_at.desc(), AuditLog.audit_log_id.desc())
            .limit(8)
            .all()
        )
        metrics = {
            "totalUsers": AppUser.query.count(),
            "totalCustomers": Customer.query.count(),
            "totalTellers": AppUser.query.filter_by(role="TELLER", is_active=True).count(),
            "totalTransactions": Transaction.query.count(),
            "pendingApplications": AccountApplication.query.filter_by(status="PENDING").count(),
            "pendingRequests": TransactionRequest.query.filter_by(status="PENDING").count(),
            "totalAccounts": BankAccount.query.count(),
            "transactionOverview": {
                "today": tx_sums(day_start),
                "lifetime": tx_sums(),
            },
            "recentActivity": [entry.to_dict() for entry in recent_activity],
            "systemHealth": "healthy",
        }
    except SQLAlchemyError:
        db.session.rollback()
        return error("Unable to load admin dashboard metrics.", 503, "system_unavailable")

    return jsonify(metrics)


@app.get("/api/admin/users")
@admin_required
def admin_list_users():
    query = AppUser.query.outerjoin(Customer, AppUser.customer_id == Customer.customer_id)
    search = request.args.get("search", "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            db.or_(
                AppUser.username.ilike(pattern),
                Customer.first_name.ilike(pattern),
                Customer.last_name.ilike(pattern),
                db.cast(AppUser.user_id, db.String).ilike(pattern),
            )
        )
    role = request.args.get("role", "").lower()
    if role:
        if role not in ("admin", "teller", "customer"):
            return error("Role must be admin, teller, or customer.", 400, "invalid_role")
        query = query.filter(AppUser.role == role.upper())
    status = request.args.get("status", "").lower()
    if status:
        if status not in ("active", "suspended"):
            return error("Status must be active or suspended.", 400, "invalid_status")
        query = query.filter(AppUser.is_active == (status == "active"))
    users = query.order_by(AppUser.user_id.desc()).all()
    return jsonify([
        {
            "id": str(user.user_id),
            "name": user.customer.full_name if user.customer else user.username,
            "email": user.customer.email if user.customer else user.username,
            "role": user.to_dict()["role"],
            "status": "active" if user.is_active else "suspended",
        }
        for user in users
    ])


def admin_user_detail(user):
    customer = user.customer
    return {
        "id": str(user.user_id),
        "name": customer.full_name if customer else user.username,
        "email": customer.email if customer else user.username,
        "role": user.to_dict()["role"],
        "status": "active" if user.is_active else "suspended",
        "displayName": user.display_name,
        "emailVerified": user.email_verified_at is not None,
        "lastLoginAt": user.last_login_at.isoformat() + "Z" if user.last_login_at else None,
        "createdAt": user.created_at.isoformat() + "Z" if user.created_at else None,
        "phone": customer.phone if customer else None,
        "address": customer.address if customer else None,
        "customerStatus": customer.status.lower() if customer else None,
        "accounts": [
            account_with_owner(account)
            for account in BankAccount.query
            .filter_by(customer_id=customer.customer_id)
            .order_by(BankAccount.account_id)
            .all()
        ] if customer else [],
    }


@app.get("/api/admin/users/<user_id>")
@admin_required
def admin_get_user(user_id):
    user = db.session.get(AppUser, as_int(user_id))
    if not user:
        return error("User not found.", 404, "not_found")
    return jsonify(admin_user_detail(user))


@app.post("/api/admin/users")
@admin_required
def admin_create_user():
    """Creates a staff (teller/admin) login. Customers self-register instead."""
    data = body()
    role = str(data.get("role") or "").lower()
    if role not in ("teller", "admin"):
        return error("Role must be teller or admin.", 400, "invalid_role")
    email = str(data.get("email") or "").strip().lower()
    if "@" not in email or "." not in email:
        return error("Enter a valid email address.", 400, "invalid_email")
    password = str(data.get("password") or "")
    message, code = validate_password(password)
    if message:
        return error(message, 400, code)
    if (
        AppUser.query.filter_by(username=email).first()
        or Customer.query.filter_by(email=email).first()
    ):
        return error("An account with that email already exists.", 409, "email_taken")

    user = AppUser(
        username=email,
        password_hash=hash_password(password),
        role=role.upper(),
        email_verified_at=utcnow(),
    )
    db.session.add(user)
    actor = authenticated_user()
    log_audit(
        "USER_CREATED",
        "APP_USER",
        entity_id=user.user_id,
        actor_user_id=actor.user_id,
        details={"role": role},
    )
    db.session.commit()
    return jsonify(admin_user_detail(user)), 201


@app.patch("/api/admin/users/<user_id>")
@admin_required
def admin_update_user(user_id):
    user = db.session.get(AppUser, as_int(user_id))
    if not user:
        return error("User not found.", 404, "not_found")
    data = body()
    new_role = str(data.get("role") or user.role).upper()
    if new_role not in ("ADMIN", "TELLER", "CUSTOMER"):
        return error("Role must be customer, teller, or admin.", 400, "invalid_role")
    if "isActive" in data and not isinstance(data["isActive"], bool):
        return error("isActive must be a boolean.", 400, "invalid_status")

    actor = authenticated_user()
    is_active = data.get("isActive", user.is_active)
    if actor.user_id == user.user_id and (new_role != "ADMIN" or not is_active):
        return error("You cannot remove your own admin access.", 400, "self_access_change")
    if user.role == "ADMIN" and (new_role != "ADMIN" or not is_active):
        active_admins = AppUser.query.filter_by(role="ADMIN", is_active=True).count()
        if user.is_active and active_admins <= 1:
            return error("At least one active admin account must remain.", 409, "last_admin")

    old_role = user.role
    old_active = user.is_active
    user.role = new_role
    user.is_active = is_active
    if old_role != new_role or old_active != is_active:
        user.auth_token_version += 1
    if old_role != new_role:
        log_audit(
            "USER_ROLE_UPDATED",
            "APP_USER",
            entity_id=user.user_id,
            actor_user_id=actor.user_id,
            details={"from": old_role.lower(), "to": new_role.lower()},
        )
    if old_active != is_active:
        log_audit(
            "USER_STATUS_UPDATED",
            "APP_USER",
            entity_id=user.user_id,
            actor_user_id=actor.user_id,
            severity="WARN" if not is_active else "INFO",
            details={"status": "active" if is_active else "suspended"},
        )
    db.session.commit()
    return jsonify({
        "id": str(user.user_id),
        "name": user.customer.full_name if user.customer else user.username,
        "email": user.customer.email if user.customer else user.username,
        "role": user.to_dict()["role"],
        "status": "active" if user.is_active else "suspended",
    })


@app.post("/api/admin/users/<user_id>/password-reset")
@admin_required
def admin_issue_password_reset(user_id):
    user = db.session.get(AppUser, as_int(user_id))
    if not user:
        return error("User not found.", 404, "not_found")
    if not user.is_active:
        return error("A suspended user cannot receive a password reset link.", 409, "user_suspended")
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    PasswordResetToken.query.filter_by(user_id=user.user_id).delete()
    db.session.add(PasswordResetToken(
        user_id=user.user_id,
        token_hash=token_hash,
        expires_at=utcnow() + timedelta(hours=1),
    ))
    actor = authenticated_user()
    log_audit(
        "PASSWORD_RESET_ISSUED",
        "APP_USER",
        entity_id=user.user_id,
        actor_user_id=actor.user_id,
        severity="WARN",
    )
    db.session.commit()
    return jsonify({"resetToken": token, "expiresInSeconds": 3600})


@app.get("/api/admin/applications")
@admin_required
def admin_list_applications():
    status = request.args.get("status", "pending").upper()
    if status not in ("PENDING", "APPROVED", "REJECTED", "ALL"):
        return error("Status must be pending, approved, rejected, or all.", 400, "invalid_status")
    query = AccountApplication.query
    if status != "ALL":
        query = query.filter_by(status=status)
    applications = query.order_by(AccountApplication.created_at.desc()).all()
    return jsonify([application.to_dict() for application in applications])


@app.post("/api/admin/applications/<application_id>/decision")
@admin_required
def admin_decide_application(application_id):
    application = AccountApplication.query.filter_by(
        application_id=as_int(application_id)
    ).with_for_update().first()
    if not application:
        return error("Application not found.", 404, "not_found")
    if application.status != "PENDING":
        return error("This application has already been reviewed.", 409, "already_reviewed")

    data = body()
    decision = str(data.get("decision") or "").lower()
    if decision not in ("approve", "reject"):
        return error("Decision must be approve or reject.", 400, "invalid_decision")
    reason = str(data.get("reason") or "").strip()
    if decision == "reject" and not reason:
        return error("A rejection reason is required.", 400, "reason_required")
    if len(reason) > 500:
        return error("Rejection reason must be 500 characters or fewer.", 400, "reason_too_long")

    actor = authenticated_user()
    application.reviewed_by_user_id = actor.user_id
    application.reviewed_at = utcnow()
    if decision == "reject":
        application.status = "REJECTED"
        application.rejection_reason = reason
        log_audit(
            "ACCOUNT_APPLICATION_REJECTED",
            "ACCOUNT_APPLICATION",
            entity_id=application.application_id,
            actor_user_id=actor.user_id,
            severity="WARN",
            details={"reason": reason},
        )
    else:
        account_type = db.session.get(AccountType, application.account_type_id)
        if not account_type:
            return error("The requested account type is no longer available.", 409, "invalid_account_type")
        account = BankAccount(
            customer_id=application.customer_id,
            account_type_id=application.account_type_id,
            account_number=new_account_number(),
            current_balance=application.initial_deposit,
            interest_rate=account_type.default_interest_rate,
        )
        db.session.add(account)
        db.session.flush()
        application.created_account_id = account.account_id
        if application.initial_deposit > 0:
            db.session.add(Transaction(
                account_id=account.account_id,
                transaction_type="DEPOSIT",
                amount=application.initial_deposit,
                balance_after=application.initial_deposit,
                reference_code=new_reference(),
                description="Initial deposit from approved account application",
                performed_by_user_id=application.applicant_user_id,
            ))
        application.status = "APPROVED"
        log_audit(
            "ACCOUNT_APPLICATION_APPROVED",
            "ACCOUNT_APPLICATION",
            entity_id=application.application_id,
            actor_user_id=actor.user_id,
            details={"accountId": str(account.account_id)},
        )
    db.session.commit()
    return jsonify(application.to_dict())


@app.get("/api/admin/card-requests")
@admin_required
def admin_list_card_requests():
    status = request.args.get("status", "pending").upper()
    if status not in ("PENDING", "APPROVED", "REJECTED", "ALL"):
        return error("Status must be pending, approved, rejected, or all.", 400, "invalid_status")
    query = TransactionRequest.query.filter_by(transaction_type="CARD_LOST")
    if status != "ALL":
        query = query.filter_by(status=status)
    rows = query.order_by(TransactionRequest.created_at.desc()).limit(100).all()
    return jsonify([row.to_dict(include_customer=True) for row in rows])


@app.post("/api/admin/card-requests/<request_id>/approve")
@admin_required
def admin_approve_card_request(request_id):
    user = current_user()
    row = TransactionRequest.query.filter_by(
        request_id=as_int(request_id),
        transaction_type="CARD_LOST",
    ).with_for_update().first()
    if not row:
        return error("Card request not found.", 404, "not_found")
    if row.status != "PENDING":
        return error("This request has already been processed.", 409, "already_reviewed")

    account = db.session.get(BankAccount, row.account_id)
    if not account:
        return error("The account for this request no longer exists.", 409, "no_account")

    cancel_customer_active_cards(row.customer_id)
    card = issue_card_for_account(account)

    row.status = "APPROVED"
    row.reviewed_by_user_id = user.user_id
    row.reviewed_at = utcnow()
    log_audit(
        "CARD_LOST_APPROVED",
        "TRANSACTION_REQUEST",
        entity_id=row.request_id,
        actor_user_id=user.user_id,
        details={"accountId": str(row.account_id)},
    )
    push_notification(
        row.requested_by_user_id,
        "Replacement card issued",
        f"Your lost card report was approved. A replacement debit card ending in {card.card_number[-4:]} is ready to use.",
        category="CARD",
        link="/dashboard/profile",
    )
    db.session.commit()
    return jsonify(row.to_dict(include_customer=True))


@app.post("/api/admin/card-requests/<request_id>/reject")
@admin_required
def admin_reject_card_request(request_id):
    user = current_user()
    row = TransactionRequest.query.filter_by(
        request_id=as_int(request_id),
        transaction_type="CARD_LOST",
    ).with_for_update().first()
    if not row:
        return error("Card request not found.", 404, "not_found")
    if row.status != "PENDING":
        return error("This request has already been processed.", 409, "already_reviewed")

    reason = (body().get("reason") or "").strip()
    if not reason:
        return error("A rejection reason is required.", 400, "reason_required")
    if len(reason) > 500:
        return error("Rejection reason must be 500 characters or fewer.", 400, "reason_too_long")

    row.status = "REJECTED"
    row.rejection_reason = reason
    row.reviewed_by_user_id = user.user_id
    row.reviewed_at = utcnow()
    log_audit(
        "CARD_LOST_REJECTED",
        "TRANSACTION_REQUEST",
        entity_id=row.request_id,
        actor_user_id=user.user_id,
        severity="WARN",
        details={"reason": reason},
    )
    push_notification(
        row.requested_by_user_id,
        "Lost card report rejected",
        f"Your lost card report was rejected. Reason: {reason}",
        category="CARD",
        link="/dashboard/profile",
    )
    db.session.commit()
    return jsonify(row.to_dict(include_customer=True))


@app.get("/api/admin/logs")
@admin_required
def admin_list_logs():
    query = AuditLog.query
    severity = request.args.get("severity", "").upper()
    actor_id = request.args.get("actorId")
    if severity:
        if severity not in ("INFO", "WARN", "ERROR"):
            return error("Severity must be INFO, WARN, or ERROR.", 400, "invalid_severity")
        query = query.filter_by(severity=severity)
    if actor_id:
        parsed_actor_id = as_int(actor_id)
        if parsed_actor_id is None:
            return error("Actor ID must be numeric.", 400, "invalid_actor")
        query = query.filter_by(actor_user_id=parsed_actor_id)
    action = (request.args.get("action") or "").strip()
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    entity_type = (request.args.get("entityType") or "").strip()
    if entity_type:
        query = query.filter(AuditLog.entity_type.ilike(f"%{entity_type}%"))
    date_from = parse_date(request.args.get("from"))
    date_to = parse_date(request.args.get("to"))
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at < date_to + timedelta(days=1))
    entries = query.order_by(AuditLog.created_at.desc(), AuditLog.audit_log_id.desc()).limit(200).all()
    return jsonify([entry.to_dict() for entry in entries])


LOGIN_HISTORY_ACTIONS = ("LOGIN_SUCCESS", "LOGIN_FAILED", "FAILED_LOGIN_SPIKE")


@app.get("/api/admin/login-history")
@admin_required
def admin_login_history():
    """Recent successful + failed logins, derived from the audit trail."""
    email = (request.args.get("email") or "").strip()
    query = AuditLog.query.filter(AuditLog.action.in_(LOGIN_HISTORY_ACTIONS))
    rows = (
        query
        .order_by(AuditLog.created_at.desc(), AuditLog.audit_log_id.desc())
        .limit(200)
        .all()
    )
    if email:
        rows = [
            row for row in rows
            if str((row.details or {}).get("accountKey") or "").lower() == email.lower()
        ]
    return jsonify([
        {
            "id": str(row.audit_log_id),
            "action": row.action,
            "email": (row.details or {}).get("accountKey"),
            "userId": (row.details or {}).get("attemptedUserId"),
            "ipAddress": row.ip_address or (row.details or {}).get("ipAddress"),
            "severity": row.severity,
            "createdAt": row.created_at.isoformat() + "Z" if row.created_at else None,
        }
        for row in rows
    ])


@app.get("/api/admin/security-summary")
@admin_required
def admin_security_summary():
    """Counters for the security monitoring tab."""
    now = utcnow()
    hour_start = now - timedelta(hours=1)
    day_start = now - timedelta(hours=24)

    def count_recent(action, since):
        return AuditLog.query.filter(
            AuditLog.action == action,
            AuditLog.created_at >= since,
        ).count()

    return jsonify({
        "failedLogins24h": count_recent("LOGIN_FAILED", day_start),
        "failedLogins1h": count_recent("LOGIN_FAILED", hour_start),
        "successfulLogins24h": count_recent("LOGIN_SUCCESS", day_start),
        "loginSpikes24h": count_recent("FAILED_LOGIN_SPIKE", day_start),
        "warnings24h": AuditLog.query.filter(
            AuditLog.severity == "WARN",
            AuditLog.created_at >= day_start,
        ).count(),
        "errors24h": AuditLog.query.filter(
            AuditLog.severity == "ERROR",
            AuditLog.created_at >= day_start,
        ).count(),
    })


@app.get("/api/settings")
def public_bank_settings():
    """Public bank settings for branding on the customer-facing UI."""
    return jsonify(bank_settings().public_dict())


@app.get("/api/admin/settings")
@admin_required
def admin_get_settings():
    return jsonify(bank_settings().public_dict())


@app.patch("/api/admin/settings")
@admin_required
def admin_update_settings():
    data = body()
    updates = []
    setting = bank_settings()

    if "bankName" in data:
        bank_name = str(data["bankName"] or "").strip()
        if not bank_name:
            return error("Bank name is required.", 400, "invalid_bank_name")
        if len(bank_name) > 80:
            return error("Bank name must be 80 characters or fewer.", 400, "invalid_bank_name")
        setting.bank_name = bank_name
        updates.append("bankName")
    if "contactEmail" in data:
        contact_email = str(data["contactEmail"] or "").strip() or None
        if contact_email and ("@" not in contact_email or "." not in contact_email):
            return error("Enter a valid contact email address.", 400, "invalid_email")
        setting.contact_email = contact_email
        updates.append("contactEmail")
    if "contactPhone" in data:
        contact_phone = str(data["contactPhone"] or "").strip() or None
        if contact_phone and (len(contact_phone) > 20 or not all(ch.isdigit() or ch in "+-() " for ch in contact_phone)):
            return error("Contact phone must be 20 digits/–, spaces and parentheses at most.", 400, "invalid_phone")
        setting.contact_phone = contact_phone
        updates.append("contactPhone")
    if "address" in data:
        setting.address = str(data["address"] or "").strip()[:255] or None
        updates.append("address")
    if "maintenanceMode" in data:
        if not isinstance(data["maintenanceMode"], bool):
            return error("maintenanceMode must be a boolean.", 400, "invalid_maintenance")
        setting.maintenance_mode = data["maintenanceMode"]
        updates.append("maintenanceMode")
    if "logo" in data:
        raw_logo = data["logo"]
        if raw_logo in (None, ""):
            setting.logo_data = None
        else:
            if not isinstance(raw_logo, str) or len(raw_logo) > 2_000_000:
                return error("Logo must be an image up to 1 MB.", 400, "invalid_logo")
            mime, separator, payload = raw_logo.partition(";base64,")
            if not separator or mime not in ("data:image/png", "data:image/jpeg", "data:image/webp"):
                return error("Logo must be a PNG, JPG, or WebP image.", 400, "invalid_logo")
            try:
                decoded = base64.b64decode(payload, validate=True)
            except (binascii.Error, ValueError):
                return error("Logo is not a valid image.", 400, "invalid_logo")
            if len(decoded) > 1_048_576:
                return error("Logo must be an image up to 1 MB.", 400, "invalid_logo")
            setting.logo_data = raw_logo
        updates.append("logo")

    if not updates:
        return error("Nothing to update.", 400, "no_changes")

    actor = authenticated_user()
    setting.updated_by_user_id = actor.user_id
    log_audit(
        "BANK_SETTINGS_UPDATED",
        "BANK_SETTINGS",
        actor_user_id=actor.user_id,
        severity="WARN" if "maintenanceMode" in updates else "INFO",
        details={"fields": updates, "maintenanceMode": bool(setting.maintenance_mode)},
    )
    db.session.commit()
    return jsonify(setting.public_dict())


@app.get("/api/auth/me")
@authenticated_required
def whoami():
    """Identity for the signed-in staff/customer user."""
    return jsonify(current_user().to_dict())


@app.get("/api/admin/profile")
@admin_required
def admin_get_profile():
    actor = authenticated_user()
    detail = admin_user_detail(actor)
    detail["displayName"] = actor.display_name
    return jsonify(detail)


@app.patch("/api/admin/profile")
@admin_required
def admin_update_profile():
    data = body()
    actor = authenticated_user()
    if "displayName" in data:
        display_name = str(data["displayName"] or "").strip()
        if not display_name:
            return error("Display name cannot be empty.", 400, "invalid_name")
        if len(display_name) > 100:
            return error("Display name must be 100 characters or fewer.", 400, "invalid_name")
        actor.display_name = display_name
        log_audit(
            "USER_PROFILE_UPDATED",
            "APP_USER",
            entity_id=actor.user_id,
            actor_user_id=actor.user_id,
            details={"displayName": display_name},
        )
        db.session.commit()
        return jsonify(admin_user_detail(actor))
    return error("Nothing to update.", 400, "no_changes")


@app.get("/api/admin/backups")
@admin_required
def admin_list_backups():
    if not BACKUP_DIR.is_dir():
        return jsonify([])
    backups = []
    for path in sorted(BACKUP_DIR.glob("*.sql"), key=lambda entry: entry.stat().st_mtime, reverse=True):
        stat = path.stat()
        backups.append({
            "name": path.name,
            "size": stat.st_size,
            "createdAt": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        })
    return jsonify(backups)


@app.get("/api/admin/backups/<filename>")
@admin_required
def admin_download_backup(filename):
    if Path(filename).name != filename or not filename.endswith(".sql"):
        return error("Backup file not found.", 404, "not_found")
    path = (BACKUP_DIR / filename).resolve()
    if path.parent != BACKUP_DIR.resolve() or not path.is_file():
        return error("Backup file not found.", 404, "not_found")
    return send_file(
        path,
        as_attachment=True,
        download_name=path.name,
        mimetype="application/sql",
    )


BACKUP_SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "backup_db.sh"
RESTORE_SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "restore_db.sh"


def run_project_script(script_path, *args):
    result = subprocess.run(
        ["bash", str(script_path), *(str(arg) for arg in args)],
        capture_output=True,
        text=True,
        timeout=600,
    )
    return result


def admin_backup_summaries():
    if not BACKUP_DIR.is_dir():
        return []
    return [
        {
            "name": path.name,
            "size": path.stat().st_size,
            "createdAt": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
        }
        for path in sorted(
            BACKUP_DIR.glob("*.sql"), key=lambda entry: entry.stat().st_mtime, reverse=True
        )
    ]


@app.post("/api/admin/backups")
@admin_required
def admin_generate_backup():
    """Dumps the database via scripts/backup_db.sh; the file auto-downloads on
    success from the UI."""
    if not BACKUP_SCRIPT.is_file():
        return error("The backup script is not available.", 503, "script_missing")
    try:
        result = run_project_script(BACKUP_SCRIPT)
    except subprocess.TimeoutExpired:
        return error("The backup timed out.", 503, "backup_timeout")
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip().splitlines()
        return error(detail[-1] if detail else "Backup generation failed.", 503, "backup_failed")

    latest = admin_backup_summaries()
    if not latest:
        return error("Backup generation produced no file.", 503, "backup_failed")

    actor = authenticated_user()
    log_audit(
        "BACKUP_GENERATED",
        "BACKUP",
        actor_user_id=actor.user_id,
        details={"file": latest[0]["name"]},
    )
    db.session.commit()
    return jsonify({"backups": latest, "generated": latest[0]["name"]}), 201


@app.post("/api/admin/backups/restore")
@admin_required
def admin_restore_backup():
    """Restores a backup file. Requires explicit typed confirmation because the
    database is overwritten."""
    data = body()
    filename = str(data.get("filename") or "")
    confirmation = str(data.get("confirm") or "").strip()

    if not filename.endswith(".sql") or Path(filename).name != filename:
        return error("Backup file not found.", 404, "not_found")
    path = (BACKUP_DIR / filename).resolve()
    if path.parent != BACKUP_DIR.resolve() or not path.is_file():
        return error("Backup file not found.", 404, "not_found")

    if confirmation != "RESTORE":
        return error(
            "Type RESTORE to confirm overwriting the database.",
            400,
            "confirmation_invalid",
        )
    if not RESTORE_SCRIPT.is_file():
        return error("The restore script is not available.", 503, "script_missing")

    try:
        result = run_project_script(RESTORE_SCRIPT, path, "--yes")
    except subprocess.TimeoutExpired:
        return error("The restore timed out.", 503, "restore_timeout")
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip().splitlines()
        return error(detail[-1] if detail else "Restore failed.", 503, "restore_failed")

    # Sessions may hold pre-restore data; drop cached state.
    db.session.remove()

    actor = authenticated_user()
    log_audit(
        "BACKUP_RESTORED",
        "BACKUP",
        actor_user_id=actor.user_id,
        severity="WARN",
        details={"file": filename},
    )
    db.session.commit()
    return jsonify({"message": f"Database restored from {filename}."})


BACKUP_UPLOAD_MAX_BYTES = 50 * 1024 * 1024


@app.post("/api/admin/backups/restore-upload")
@admin_required
def admin_restore_backup_upload():
    """Restores a .sql dump uploaded by the admin from their own computer.
    Requires explicit typed confirmation because the database is overwritten."""
    uploaded = request.files.get("file")
    confirmation = str(request.form.get("confirm") or "").strip()

    if confirmation != "RESTORE":
        return error(
            "Type RESTORE to confirm overwriting the database.",
            400,
            "confirmation_invalid",
        )
    if uploaded is None or not uploaded.filename:
        return error("Choose a .sql backup file to restore.", 400, "file_missing")

    raw_name = uploaded.filename
    if Path(raw_name).name != raw_name or not raw_name.endswith(".sql"):
        return error("The file must be a .sql backup.", 400, "file_invalid")
    original_name = Path(raw_name).name

    if not RESTORE_SCRIPT.is_file():
        return error("The restore script is not available.", 503, "script_missing")

    temp_path = Path(tempfile.gettempdir()) / f"gellybank_upload_{uuid4().hex}.sql"
    bytes_written = 0
    try:
        with temp_path.open("wb") as sink:
            while chunk := uploaded.stream.read(1024 * 1024):
                bytes_written += len(chunk)
                if bytes_written > BACKUP_UPLOAD_MAX_BYTES:
                    return error(
                        "The backup file is too large (50 MB max).",
                        413,
                        "file_too_large",
                    )
                sink.write(chunk)
        if bytes_written == 0:
            return error("The uploaded file is empty.", 400, "file_empty")

        try:
            result = run_project_script(RESTORE_SCRIPT, temp_path, "--yes")
        except subprocess.TimeoutExpired:
            return error("The restore timed out.", 503, "restore_timeout")
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "").strip().splitlines()
            return error(detail[-1] if detail else "Restore failed.", 503, "restore_failed")

        # Sessions may hold pre-restore data; drop cached state.
        db.session.remove()

        actor = authenticated_user()
        log_audit(
            "BACKUP_RESTORED",
            "BACKUP",
            actor_user_id=actor.user_id,
            severity="WARN",
            details={"file": original_name, "source": "upload"},
        )
        db.session.commit()
        return jsonify({"message": f"Database restored from {original_name}."})
    finally:
        temp_path.unlink(missing_ok=True)


def account_with_owner(account):
    customer = db.session.get(Customer, account.customer_id)
    return {
        **account.to_dict(),
        "customerName": customer.full_name if customer else "",
        "customerEmail": customer.email if customer else "",
    }


@app.get("/api/admin/accounts")
@staff_required
def admin_list_accounts():
    """Admin oversees all customer bank accounts."""
    query = BankAccount.query
    status = request.args.get("status", "").upper()
    if status:
        if status not in ("ACTIVE", "FROZEN", "CLOSED"):
            return error("Status must be active, frozen, or closed.", 400, "invalid_status")
        query = query.filter_by(status=status)
    search = request.args.get("search", "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.outerjoin(
            Customer, BankAccount.customer_id == Customer.customer_id
        ).filter(
            db.or_(
                BankAccount.account_number.ilike(pattern),
                Customer.first_name.ilike(pattern),
                Customer.last_name.ilike(pattern),
                Customer.email.ilike(pattern),
            )
        )
    accounts = query.order_by(BankAccount.account_id).all()
    return jsonify([account_with_owner(a) for a in accounts])


@app.get("/api/admin/accounts/<account_id>")
@staff_required
def admin_get_account(account_id):
    account = any_account(account_id)
    if not account:
        return error("Account not found.", 404, "not_found")
    transactions = (
        Transaction.query
        .filter_by(account_id=account.account_id)
        .order_by(Transaction.created_at.desc())
        .limit(20)
        .all()
    )
    return jsonify({
        "account": account_with_owner(account),
        "recentTransactions": [tx.to_dict() for tx in transactions],
    })


ACCOUNT_STAFF_STATUS = {
    "freeze": "FROZEN",
    "unfreeze": "ACTIVE",
    "close": "CLOSED",
    "reopen": "ACTIVE",
}


@app.patch("/api/admin/accounts/<account_id>/status")
@admin_required
def admin_update_account_status(account_id):
    """Admin may freeze/unfreeze/close/reopen accounts but not touch balances."""
    account = any_account(account_id)
    if not account:
        return error("Account not found.", 404, "not_found")
    action = str(body().get("action") or "").lower()
    if action not in ACCOUNT_STAFF_STATUS:
        return error("Action must be freeze, unfreeze, close, or reopen.", 400, "invalid_action")

    new_status = ACCOUNT_STAFF_STATUS[action]
    if account.status == new_status:
        return error(f"This account is already {new_status.lower()}.", 409, "status_unchanged")
    if action == "close" and account.current_balance != 0:
        return error("Account balance must be zero before closing.", 400, "balance_not_zero")

    old_status = account.status
    account.status = new_status
    account.closed_at = utcnow() if new_status == "CLOSED" else None
    actor = authenticated_user()
    log_audit(
        f"ACCOUNT_{action.upper()}",
        "BANK_ACCOUNT",
        entity_id=account.account_id,
        actor_user_id=actor.user_id,
        severity="WARN" if action in ("freeze", "close") else "INFO",
        details={"status": new_status, "previousStatus": old_status},
    )
    db.session.commit()
    return jsonify(account_with_owner(account))


def admin_transaction_row(tx):
    account = db.session.get(BankAccount, tx.account_id)
    customer = db.session.get(Customer, account.customer_id) if account else None
    item = tx.to_dict()
    item["accountNumber"] = account.account_number if account else None
    item["accountLabel"] = account.type_name.capitalize() if account else None
    item["customerName"] = customer.full_name if customer else None
    item["customerEmail"] = customer.email if customer else None
    staff = db.session.get(AppUser, tx.performed_by_user_id) if tx.performed_by_user_id else None
    item["performedBy"] = staff.role.lower() if staff else None
    return item


@app.get("/api/admin/transactions")
@staff_required
def admin_list_transactions():
    """Admin monitors all transactions without modifying them."""
    query = Transaction.query
    tx_type = request.args.get("type", "").lower()
    type_map = {
        "deposit": ["DEPOSIT"],
        "withdrawal": ["WITHDRAWAL"],
        "transfer": ["TRANSFER_IN", "TRANSFER_OUT"],
        "adjustment": ["ADJUSTMENT"],
    }
    if tx_type:
        if tx_type not in type_map:
            return error("Invalid transaction type filter.", 400, "invalid_type")
        query = query.filter(Transaction.transaction_type.in_(type_map[tx_type]))
    status = request.args.get("status", "").lower()
    if status:
        if status not in ("completed", "void"):
            return error("Status must be completed or void.", 400, "invalid_status")
        query = query.filter(Transaction.status == status.upper())
    search = request.args.get("search", "").strip()
    if search:
        pattern = f"%{search}%"
        query = (
            query.join(BankAccount, Transaction.account_id == BankAccount.account_id)
            .outerjoin(Customer, BankAccount.customer_id == Customer.customer_id)
            .filter(
                db.or_(
                    Transaction.reference_code.ilike(pattern),
                    Transaction.description.ilike(pattern),
                    BankAccount.account_number.ilike(pattern),
                    Customer.first_name.ilike(pattern),
                    Customer.last_name.ilike(pattern),
                    Customer.email.ilike(pattern),
                )
            )
        )
    date_from = parse_date(request.args.get("from"))
    date_to = parse_date(request.args.get("to"))
    if date_from:
        query = query.filter(Transaction.created_at >= date_from)
    if date_to:
        query = query.filter(Transaction.created_at < date_to + timedelta(days=1))
    limit = request.args.get("limit", type=int) or 50
    limit = max(1, min(limit, 200))
    transactions = (
        query
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .all()
    )
    return jsonify([admin_transaction_row(tx) for tx in transactions])


@app.get("/api/admin/transactions/<tx_id>")
@staff_required
def admin_get_transaction(tx_id):
    tx = db.session.get(Transaction, as_int(tx_id))
    if not tx:
        return error("Transaction not found.", 404, "not_found")
    account = db.session.get(BankAccount, tx.account_id)
    performed_by = None
    if tx.performed_by_user_id:
        performed_by = db.session.get(AppUser, tx.performed_by_user_id)
    item = admin_transaction_row(tx)
    item["performedBy"] = performed_by.role.lower() if performed_by else None
    item["account"] = account_with_owner(account) if account else None
    return jsonify(item)


@app.post("/api/admin/transactions/<tx_id>/reverse")
@admin_required
def admin_reverse_transaction(tx_id):
    """Authorised correction: undoes a completed transaction with a
    compensating ADJUSTMENT and voids the original."""
    tx = db.session.get(Transaction, as_int(tx_id))
    if not tx:
        return error("Transaction not found.", 404, "not_found")
    if tx.status == "VOID":
        return error("This transaction is already void.", 409, "already_void")

    data = body()
    reason = str(data.get("reason") or "").strip()
    if not reason:
        return error("A reversal reason is required.", 400, "reason_required")
    if len(reason) > 500:
        return error("The reversal reason is 500 characters or fewer.", 400, "reason_too_long")

    adjustments = []
    if tx.transfer_id:
        transfer = db.session.get(Transfer, tx.transfer_id)
        if not transfer:
            return error("Transfer not found.", 404, "not_found")
        adjustments = [
            (transfer.to_account_id, -transfer.amount),
            (transfer.from_account_id, transfer.amount),
        ]
    elif tx.transaction_type == "DEPOSIT":
        adjustments = [(tx.account_id, -tx.amount)]
    elif tx.transaction_type == "WITHDRAWAL":
        adjustments = [(tx.account_id, tx.amount)]
    else:
        return error(
            "Only deposits, withdrawals, and transfers can be reversed.",
            400,
            "reversal_unsupported",
        )

    try:
        locked_accounts = {}
        for account_id, delta in adjustments:
            locked = BankAccount.query.filter_by(
                account_id=account_id
            ).with_for_update().first()
            if not locked:
                return error("Account not found.", 404, "not_found")
            if locked.current_balance + delta < 0:
                return error(
                    "Reversing this transaction would leave the account below zero. "
                    "Deposits cannot be reversed after the funds have been spent.",
                    409,
                    "insufficient_funds",
                )
            locked.current_balance += delta
            locked_accounts[account_id] = locked

        actor = authenticated_user()
        note = "Reversal of " + tx.reference_code + ": " + reason
        for account_id, delta in adjustments:
            db.session.add(Transaction(
                account_id=account_id,
                transaction_type="ADJUSTMENT",
                amount=abs(delta),
                balance_after=locked_accounts[account_id].current_balance,
                reference_code=new_reference(),
                description=note,
                performed_by_user_id=actor.user_id,
            ))

        if tx.transfer_id:
            for leg in Transaction.query.filter_by(transfer_id=tx.transfer_id).all():
                leg.status = "VOID"
            transfer = db.session.get(Transfer, tx.transfer_id)
            transfer.status = "REVERSED"
        else:
            tx.status = "VOID"

        log_audit(
            "TRANSACTION_REVERSED",
            "TRANSACTION",
            entity_id=tx.transaction_id,
            actor_user_id=actor.user_id,
            severity="WARN",
            details={
                "reference": tx.reference_code,
                "amount": as_number(tx.amount),
                "reason": reason,
            },
        )
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return error("Unable to reverse this transaction.", 503, "system_unavailable")

    return jsonify(admin_transaction_row(tx))


@app.get("/api/admin/reports")
@admin_required
def admin_reports():
    """Basic operational report: totals and counts, ignoring voided transactions."""
    date_from = parse_date(request.args.get("from"))
    date_to = parse_date(request.args.get("to"))
    active_filter = Transaction.status != "VOID"
    done = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    def sums(start=None, end=None):
        query = Transaction.query.filter(active_filter)
        if start:
            query = query.filter(Transaction.created_at >= start)
        if end:
            query = query.filter(Transaction.created_at < end + timedelta(days=1))
        rows = query.with_entities(
            Transaction.transaction_type,
            db.func.count().label("count"),
            db.func.coalesce(db.func.sum(Transaction.amount), 0).label("total"),
        ).group_by(Transaction.transaction_type).all()
        return {row[0]: {"count": row[1], "total": as_number(row[2])} for row in rows}

    counts = {
        "customers": Customer.query.count(),
        "users": AppUser.query.count(),
        "activeUsers": AppUser.query.filter_by(is_active=True).count(),
        "accounts": BankAccount.query.count(),
        "activeAccounts": BankAccount.query.filter_by(status="ACTIVE").count(),
        "frozenAccounts": BankAccount.query.filter_by(status="FROZEN").count(),
        "pendingApplications": AccountApplication.query.filter_by(status="PENDING").count(),
    }
    db_check = False
    try:
        db.session.execute(text("SELECT 1"))
        db_check = True
    except SQLAlchemyError:
        db.session.rollback()

    teller_volume_query = (
        Transaction.query
        .filter(active_filter, Transaction.performed_by_user_id.isnot(None))
    )
    if date_from:
        teller_volume_query = teller_volume_query.filter(Transaction.created_at >= date_from)
    if date_to:
        teller_volume_query = teller_volume_query.filter(
            Transaction.created_at < date_to + timedelta(days=1)
        )
    teller_rows = (
        teller_volume_query
        .join(AppUser, Transaction.performed_by_user_id == AppUser.user_id)
        .with_entities(
            Transaction.performed_by_user_id,
            db.func.count().label("count"),
            db.func.coalesce(db.func.sum(Transaction.amount), 0).label("total"),
        )
        .group_by(Transaction.performed_by_user_id)
        .order_by(db.func.count().desc())
        .all()
    )
    new_customers = Customer.query
    if date_from:
        new_customers = new_customers.filter(Customer.created_at >= date_from)
    if date_to:
        new_customers = new_customers.filter(Customer.created_at < date_to + timedelta(days=1))

    return jsonify({
        "accounts": counts,
        "lifetimeByType": sums(),
        "todayByType": sums(done),
        "rangeByType": sums(date_from, date_to) if (date_from or date_to) else sums(),
        "tellerStats": [
            {
                "id": str(row[0]),
                "name": db.session.get(AppUser, row[0]).username,
                "transactions": row[1],
                "total": as_number(row[2]),
            }
            for row in teller_rows
        ],
        "customerStats": {
            "totalCustomers": counts["customers"],
            "newCustomers": new_customers.count(),
            "totalAccounts": counts["accounts"],
            "activeAccounts": counts["activeAccounts"],
            "frozenAccounts": counts["frozenAccounts"],
        },
        "deployedBalance": as_number(
            db.session.query(
                db.func.coalesce(db.func.sum(BankAccount.current_balance), 0)
            ).filter(BankAccount.status != "CLOSED").scalar()
        ),
        "systemHealth": "healthy" if db_check else "degraded",
    })


@app.get("/api/admin/reports/export")
@admin_required
def admin_reports_export():
    """CSV export of transactions for recordkeeping (opens in Excel)."""
    date_from = parse_date(request.args.get("from"))
    date_to = parse_date(request.args.get("to"))
    query = Transaction.query
    if date_from:
        query = query.filter(Transaction.created_at >= date_from)
    if date_to:
        query = query.filter(Transaction.created_at < date_to + timedelta(days=1))
    transactions = query.order_by(Transaction.created_at.asc()).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "reference", "date", "type", "amount", "currency", "status",
        "account", "customer", "note", "performed_by",
    ])
    for tx in transactions:
        account = db.session.get(BankAccount, tx.account_id)
        customer = db.session.get(Customer, account.customer_id) if account else None
        staff = db.session.get(AppUser, tx.performed_by_user_id) if tx.performed_by_user_id else None
        writer.writerow([
            tx.reference_code,
            tx.created_at.isoformat() if tx.created_at else "",
            tx.transaction_type.lower(),
            as_number(tx.amount),
            DEFAULT_CURRENCY,
            tx.status.lower(),
            account.account_number if account else "",
            customer.full_name if customer else "",
            tx.description or "",
            staff.username if staff else "",
        ])
    response = Response(buffer.getvalue(), mimetype="text/csv")
    filename = "gellybank_transactions"
    if date_from:
        filename += f"_{date_from.isoformat()}"
    if date_to:
        filename += f"-{date_to.isoformat()}"
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}.csv"'
    return response


@app.get("/api/accounts/<account_id>")
@authenticated_required
def get_account(account_id):
    user = current_user()
    account = my_account(account_id, user)
    if not account:
        return error("Account not found.", 404, "not_found")

    primary = primary_account_id(user.customer_id)
    return jsonify(account.to_dict(is_primary=(account.account_id == primary)))


@app.patch("/api/accounts/<account_id>")
@authenticated_required
def update_account(account_id):
    user = current_user()
    account = my_account(account_id, user)
    if not account:
        return error("Account not found.", 404, "not_found")

    primary = primary_account_id(user.customer_id)
    return jsonify(account.to_dict(is_primary=(account.account_id == primary)))


@app.delete("/api/accounts/<account_id>")
@authenticated_required
def close_account(account_id):
    account = my_account(account_id, current_user())
    if not account:
        return error("Account not found.", 404, "not_found")
    if account.current_balance != 0:
        return error("Account balance must be zero before closing.", 400, "balance_not_zero")

    account.status = "CLOSED"
    account.closed_at = utcnow()
    db.session.commit()
    return "", 204



def my_transaction(tx_id, user):
    if not user.customer_id:
        return None
    return (
        Transaction.query
        .join(BankAccount, Transaction.account_id == BankAccount.account_id)
        .filter(
            Transaction.transaction_id == as_int(tx_id),
            BankAccount.customer_id == user.customer_id,
        )
        .first()
    )


def reject_admin_transaction(user):
    if user.role == "ADMIN":
        return error("Admins cannot execute or modify financial transactions.", 403, "admin_transaction_forbidden")
    return None


@app.get("/api/transactions")
@authenticated_required
def list_transactions():
    user = current_user()
    if not user.customer_id:
        return jsonify([])

    account_id = request.args.get("accountId")
    limit = request.args.get("limit", type=int)

    query = (
        Transaction.query
        .join(BankAccount, Transaction.account_id == BankAccount.account_id)
        .filter(BankAccount.customer_id == user.customer_id)
    )
    if account_id:
        query = query.filter(Transaction.account_id == as_int(account_id))

    query = query.order_by(Transaction.created_at.desc())
    if limit:
        query = query.limit(limit)

    return jsonify([tx.to_dict() for tx in query.all()])


def process_deposit_withdraw(user, account, kind, amount, note):
    """Shared deposit/withdrawal processing with row locking, for customer
    self-service and teller-assisted transactions."""
    try:
        # Lock the balance row before reading/writing to prevent concurrent races.
        locked = BankAccount.query.filter_by(
            account_id=account.account_id
        ).with_for_update().first()

        if not locked:
            return error("Account not found.", 404, "not_found")
        if locked.status != "ACTIVE":
            return error("This account is not active.", 400, "account_inactive")

        if kind == "withdraw":
            if amount > locked.current_balance:
                return error("Insufficient funds.", 400, "insufficient_funds")
            locked.current_balance -= amount
            tx_type = "WITHDRAWAL"
        else:
            locked.current_balance += amount
            tx_type = "DEPOSIT"

        tx = Transaction(
            account_id=locked.account_id,
            transaction_type=tx_type,
            amount=amount,
            balance_after=locked.current_balance,
            reference_code=new_reference(),
            description=(note or "").strip() or None,
            performed_by_user_id=user.user_id,
        )
        db.session.add(tx)
        label = "Deposit" if kind == "deposit" else "Withdrawal"
        push_notification(
            notification_user_id(locked.customer_id),
            f"{label} completed",
            f"{label} of {DEFAULT_CURRENCY} {as_number(amount):,.2f} was processed. New balance: {DEFAULT_CURRENCY} {as_number(locked.current_balance):,.2f}.",
            category="TRANSACTION",
            link="/dashboard/history",
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        return error("Transaction failed. Please try again.", 500, "transaction_failed")

    return tx


@app.post("/api/transactions")
@authenticated_required
def create_transaction():
    """Customers submit requests instead; only tellers process deposits/withdrawals."""
    user = current_user()
    denied = reject_admin_transaction(user)
    if denied:
        return denied
    if user.role == "CUSTOMER":
        return error(
            "Deposits and withdrawals are done by teller. Submit a request instead.",
            403,
            "request_required",
        )
    data = body()

    account = BankAccount.query.filter_by(
        account_id=as_int(data.get("accountId")),
        customer_id=user.customer_id,
    ).first() if user.customer_id else None
    if not account:
        return error("Account not found.", 404, "not_found")

    kind = data.get("type")
    if kind not in ("deposit", "withdraw"):
        return error("Type must be 'deposit' or 'withdraw'.", 400, "invalid_type")

    try:
        amount = check_amount(data.get("amount"))
    except ValueError as message:
        return error(str(message), 400, "invalid_amount")

    result = process_deposit_withdraw(user, account, kind, amount, data.get("note"))
    if isinstance(result, tuple):
        return result
    return jsonify(result.to_dict()), 201


@app.post("/api/transactions/transfer")
@authenticated_required
def create_transfer():
    user = current_user()
    denied = reject_admin_transaction(user)
    if denied:
        return denied
    data = body()

    source = my_account(data.get("sourceAccountId"), user)
    if not source:
        return error("Source account not found.", 404, "not_found")

    try:
        amount = check_amount(data.get("amount"))
    except ValueError as message:
        return error(str(message), 400, "invalid_amount")

    if source.status != "ACTIVE":
        return error("This account is not active.", 400, "account_inactive")

    destination = None
    beneficiary = None
    if data.get("destinationAccountId"):
        destination = my_account(data["destinationAccountId"], user)
        if not destination:
            return error("Destination account not found.", 404, "not_found")
        if destination.account_id == source.account_id:
            return error("Choose a different destination account.", 400, "same_account")
    elif data.get("destinationAccountNumber"):
        destination = BankAccount.query.filter_by(
            account_number=str(data["destinationAccountNumber"]).strip()
        ).first()
        if not destination:
            return error("Account number not found.", 404, "not_found")
        if destination.account_id == source.account_id:
            return error("Choose a different destination account.", 400, "same_account")
    else:
        beneficiary = Beneficiary.query.filter_by(
            beneficiary_id=as_int(data.get("beneficiaryId")),
            customer_id=user.customer_id,
        ).first()
        if not beneficiary:
            return error("Recipient not found.", 404, "not_found")
        destination = BankAccount.query.filter_by(
            account_number=beneficiary.account_number
        ).first()
        if not destination:
            return error("Recipient account not found.", 404, "not_found")
        if destination.account_id == source.account_id:
            return error("Choose a different destination account.", 400, "same_account")

    note = (data.get("note") or "").strip() or None
    reference = new_reference()

    try:
        # Lock the balance rows before reading to prevent concurrent race conditions.
        db.session.commit()
        locked_source = BankAccount.query.filter_by(
            account_id=source.account_id
        ).with_for_update().first()

        if not locked_source:
            return error("Source account not found.", 404, "not_found")

        locked_destination = None
        if destination:
            locked_destination = BankAccount.query.filter_by(
                account_id=destination.account_id
            ).with_for_update().first()

            if not locked_destination:
                return error("Destination account not found.", 404, "not_found")

        if locked_source.status != "ACTIVE":
            return error("This account is not active.", 400, "account_inactive")

        if amount > locked_source.current_balance:
            return error("Insufficient funds.", 400, "insufficient_funds")

        locked_source.current_balance -= amount
        transfer = None

        if locked_destination:
            locked_destination.current_balance += amount
            transfer = Transfer(
                reference_code=reference,
                from_account_id=locked_source.account_id,
                to_account_id=locked_destination.account_id,
                amount=amount,
                status="COMPLETED",
                initiated_by_user_id=user.user_id,
                description=note,
                completed_at=utcnow(),
            )
            db.session.add(transfer)
            db.session.flush()

            db.session.add(Transaction(
                account_id=locked_destination.account_id,
                transfer_id=transfer.transfer_id,
                transaction_type="TRANSFER_IN",
                amount=amount,
                balance_after=locked_destination.current_balance,
                reference_code=new_reference(),
                description=note,
                performed_by_user_id=user.user_id,
            ))

        tx = Transaction(
            account_id=locked_source.account_id,
            transfer_id=transfer.transfer_id if transfer else None,
            transaction_type="TRANSFER_OUT",
            amount=amount,
            balance_after=locked_source.current_balance,
            reference_code=reference,
            description=note or (f"Transfer to {beneficiary.name}" if beneficiary else None),
            performed_by_user_id=user.user_id,
        )
        db.session.add(tx)

        push_notification(
            user.user_id,
            "Money sent",
            f"Transfer of {DEFAULT_CURRENCY} {as_number(amount):,.2f} was sent. Reference: {reference}.",
            category="TRANSACTION",
            link="/dashboard/history",
        )
        if locked_destination:
            push_notification(
                notification_user_id(locked_destination.customer_id),
                "Money received",
                f"Transfer of {DEFAULT_CURRENCY} {as_number(amount):,.2f} was received. Reference: {reference}.",
                category="TRANSACTION",
                link="/dashboard/history",
            )

        db.session.commit()
    except Exception:
        db.session.rollback()
        return error("Transfer failed. Please try again.", 500, "transfer_failed")

    return jsonify(tx.to_dict()), 201


@app.patch("/api/transactions/<tx_id>")
@authenticated_required
def update_note(tx_id):
    user = current_user()
    denied = reject_admin_transaction(user)
    if denied:
        return denied
    tx = my_transaction(tx_id, user)
    if not tx:
        return error("Transaction not found.", 404, "not_found")

    tx.description = (body().get("note") or "").strip() or None
    db.session.commit()
    return jsonify(tx.to_dict())


@app.delete("/api/transactions/<tx_id>")
@authenticated_required
def void_transaction(tx_id):
    user = current_user()
    denied = reject_admin_transaction(user)
    if denied:
        return denied
    tx = my_transaction(tx_id, user)
    if not tx:
        return error("Transaction not found.", 404, "not_found")

    tx.status = "VOID"
    db.session.commit()
    return "", 204


# ============================================================
# CUSTOMER: deposit/withdraw requests for teller processing
# ============================================================

@app.post("/api/requests")
@authenticated_required
def create_request():
    """Customer submits a deposit or withdrawal request for teller approval."""
    user = current_user()
    if user.role != "CUSTOMER":
        return error("Only customer accounts can submit requests.", 403, "forbidden")
    if not user.customer_id:
        return error("No customer profile for this user.", 400, "no_customer")

    data = body()
    account = my_account(data.get("accountId"), user)
    if not account:
        return error("Account not found.", 404, "not_found")
    if account.status != "ACTIVE":
        return error("This account is not active.", 400, "account_inactive")

    kind = str(data.get("type") or "").lower()
    if kind not in ("deposit", "withdraw", "card", "card_lost"):
        return error("Type must be 'deposit', 'withdraw', 'card', or 'card_lost'.", 400, "invalid_type")

    if kind == "card":
        request_row = TransactionRequest(
            customer_id=user.customer_id,
            account_id=account.account_id,
            requested_by_user_id=user.user_id,
            transaction_type="CARD",
            amount=Decimal("0.00"),
            note=(data.get("note") or "").strip() or None,
        )
        db.session.add(request_row)
        push_notification(
            user.user_id,
            "Card request sent",
            f"Your new card request for {account.type_name} account was sent to the teller for approval.",
            category="CARD",
            link="/dashboard/requests",
        )
        db.session.commit()

        result = request_row.to_dict()
        result["label"] = result["accountLabel"]
        return jsonify(result), 201

    if kind == "card_lost":
        existing = TransactionRequest.query.filter_by(
            customer_id=user.customer_id,
            account_id=account.account_id,
            transaction_type="CARD_LOST",
            status="PENDING",
        ).first()
        if existing:
            return error(
                "A lost card report for this account is already pending.",
                409,
                "already_pending",
            )
        request_row = TransactionRequest(
            customer_id=user.customer_id,
            account_id=account.account_id,
            requested_by_user_id=user.user_id,
            transaction_type="CARD_LOST",
            amount=Decimal("0.00"),
            note=(data.get("note") or "").strip() or None,
        )
        db.session.add(request_row)
        push_notification(
            user.user_id,
            "Lost card reported",
            f"Your lost card report for {account.type_name} account was sent to the administrator.",
            category="CARD",
            link="/dashboard/requests",
        )
        db.session.commit()

        result = request_row.to_dict()
        result["label"] = result["accountLabel"]
        return jsonify(result), 201

    try:
        amount = check_amount(data.get("amount"))
    except ValueError as message:
        return error(str(message), 400, "invalid_amount")

    if kind == "withdraw" and user.customer_id:
        pending_withdraw = (
            TransactionRequest.query
            .filter_by(
                customer_id=user.customer_id,
                account_id=account.account_id,
                transaction_type="WITHDRAWAL",
                status="PENDING",
            )
            .all()
        )
        pending_total = sum((Decimal(str(r.amount)) for r in pending_withdraw), Decimal("0"))
        if amount + pending_total > account.current_balance:
            return error(
                "Insufficient funds (pending withdrawals are held against your balance).",
                400,
                "insufficient_funds",
            )

    request_row = TransactionRequest(
        customer_id=user.customer_id,
        account_id=account.account_id,
        requested_by_user_id=user.user_id,
        transaction_type="WITHDRAWAL" if kind == "withdraw" else "DEPOSIT",
        amount=amount,
        note=(data.get("note") or "").strip() or None,
    )
    db.session.add(request_row)
    label = "Withdrawal" if kind == "withdraw" else "Deposit"
    push_notification(
        user.user_id,
        f"{label} request sent",
        f"Your {label.lower()} request of {DEFAULT_CURRENCY} {as_number(amount):,.2f} was sent to the teller for approval.",
        category="REQUEST",
        link="/dashboard/requests",
    )
    db.session.commit()

    result = request_row.to_dict()
    result["label"] = result["accountLabel"]
    return jsonify(result), 201


@app.get("/api/requests")
@authenticated_required
def list_my_requests():
    """Customer views their own requests."""
    user = current_user()
    if not user.customer_id:
        return jsonify([])
    status = request.args.get("status", "").upper()
    query = TransactionRequest.query.filter_by(customer_id=user.customer_id)
    if status:
        if status not in ("PENDING", "APPROVED", "REJECTED"):
            return error("Status must be pending, approved, or rejected.", 400, "invalid_status")
        query = query.filter_by(status=status)
    rows = query.order_by(TransactionRequest.created_at.desc()).limit(100).all()
    return jsonify([r.to_dict() for r in rows])


@app.delete("/api/requests/<request_id>")
@authenticated_required
def cancel_request(request_id):
    """Customer cancels their own pending request."""
    user = current_user()
    row = TransactionRequest.query.filter_by(
        request_id=as_int(request_id),
        customer_id=user.customer_id,
    ).first()
    if not row:
        return error("Request not found.", 404, "not_found")
    if row.status != "PENDING":
        return error("Only pending requests can be cancelled.", 409, "already_reviewed")

    row.status = "CANCELLED"
    row.reviewed_at = utcnow()
    log_audit(
        "REQUEST_CANCELLED",
        "TRANSACTION_REQUEST",
        entity_id=row.request_id,
        actor_user_id=user.user_id,
    )
    db.session.commit()
    return "", 204


# ============================================================
# TELLER: customer service and transaction processing
# ============================================================

def teller_customer_summary(customer):
    accounts = (
        BankAccount.query
        .filter_by(customer_id=customer.customer_id)
        .order_by(BankAccount.account_id)
        .all()
    )
    return {
        "customerId": str(customer.customer_id),
        "name": customer.full_name,
        "email": customer.email,
        "phone": customer.phone,
        "status": customer.status.lower(),
        "accounts": [account_with_owner(a) for a in accounts],
    }


@app.get("/api/teller/customers")
@teller_required
def teller_lookup_customers():
    """Teller looks up customer and account information."""
    search = request.args.get("search", "").strip()
    query = Customer.query
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            db.or_(
                Customer.first_name.ilike(pattern),
                Customer.last_name.ilike(pattern),
                Customer.email.ilike(pattern),
            )
        )
    customers = query.order_by(Customer.customer_id).limit(25).all()
    return jsonify([teller_customer_summary(c) for c in customers])


@app.get("/api/teller/accounts/<account_id>")
@teller_required
def teller_get_account(account_id):
    """Teller verifies a specific customer account before processing."""
    account = any_account(account_id)
    if not account:
        return error("Account not found.", 404, "not_found")
    return jsonify(teller_customer_summary(db.session.get(
        Customer, account.customer_id
    )))


@app.post("/api/teller/transactions")
@teller_required
def teller_process_transaction():
    """Teller records a customer deposit/withdrawal.

    Eligibility checks run here (active account, sufficient funds) and the
    outcome is recorded as a normal transaction. Tellers cannot set balances
    directly - they go through the same validation as customer transactions.
    """
    user = current_user()
    data = body()

    account = any_account(data.get("accountId"))
    if not account:
        return error("Account not found.", 404, "not_found")

    kind = data.get("type")
    if kind not in ("deposit", "withdraw"):
        return error("Type must be 'deposit' or 'withdraw'.", 400, "invalid_type")

    try:
        amount = check_amount(data.get("amount"))
    except ValueError as message:
        return error(str(message), 400, "invalid_amount")

    result = process_deposit_withdraw(user, account, kind, amount, data.get("note"))
    if isinstance(result, tuple):
        return result

    customer = db.session.get(Customer, account.customer_id)
    log_audit(
        "TELLER_TRANSACTION",
        "TRANSACTION",
        entity_id=result.transaction_id,
        actor_user_id=user.user_id,
        details={
            "type": kind.upper(),
            "amount": as_number(amount),
            "accountId": str(account.account_id),
            "customerEmail": customer.email if customer else None,
        },
    )
    db.session.commit()
    return jsonify(result.to_dict()), 201


@app.get("/api/teller/accounts/<account_id>/transactions")
@teller_required
def teller_account_transactions(account_id):
    """Teller reviews a customer account's transaction history."""
    account = any_account(account_id)
    if not account:
        return error("Account not found.", 404, "not_found")
    limit = request.args.get("limit", type=int) or 50
    limit = max(1, min(limit, 200))
    transactions = (
        Transaction.query
        .filter_by(account_id=account.account_id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .all()
    )
    return jsonify([tx.to_dict() for tx in transactions])


@app.get("/api/teller/requests")
@teller_required
def teller_list_requests():
    """Teller dashboard: view pending (or reviewed) customer requests."""
    status = request.args.get("status", "pending").upper()
    if status not in ("PENDING", "APPROVED", "REJECTED", "CANCELLED", "ALL"):
        return error("Status must be pending, approved, rejected, cancelled, or all.", 400, "invalid_status")
    query = TransactionRequest.query.filter(TransactionRequest.transaction_type != "CARD_LOST")
    if status != "ALL":
        query = query.filter_by(status=status)
    rows = query.order_by(TransactionRequest.created_at.desc()).limit(100).all()
    return jsonify([r.to_dict(include_customer=True) for r in rows])


@app.post("/api/teller/requests/<request_id>/approve")
@teller_required
def teller_approve_request(request_id):
    """Teller approves a pending request and completes the transaction."""
    user = current_user()
    row = TransactionRequest.query.filter_by(
        request_id=as_int(request_id)
    ).with_for_update().first()
    if not row:
        return error("Request not found.", 404, "not_found")
    if row.status != "PENDING":
        return error("This request has already been processed.", 409, "already_reviewed")

    account = db.session.get(BankAccount, row.account_id)
    if not account:
        return error("The account for this request no longer exists.", 409, "no_account")

    if row.transaction_type == "CARD":
        cancel_customer_active_cards(row.customer_id)
        card = issue_card_for_account(account)
        db.session.commit()

        row.status = "APPROVED"
        row.reviewed_by_user_id = user.user_id
        row.reviewed_at = utcnow()
        log_audit(
            "REQUEST_APPROVED",
            "TRANSACTION_REQUEST",
            entity_id=row.request_id,
            actor_user_id=user.user_id,
            details={"type": "CARD", "accountId": str(row.account_id)},
        )
        push_notification(
            row.requested_by_user_id,
            "New card issued",
            f"Your card request was approved. Debit card ending in {card.card_number[-4:]} is ready to use.",
            category="CARD",
            link="/dashboard",
        )
        db.session.commit()
        return jsonify(row.to_dict(include_customer=True))

    kind = "withdraw" if row.transaction_type == "WITHDRAWAL" else "deposit"
    result = process_deposit_withdraw(user, account, kind, row.amount, row.note)
    if isinstance(result, tuple):
        # Eligibility failed at processing time (e.g. balance changed, account frozen).
        return result
    db.session.commit()

    row.status = "APPROVED"
    row.reviewed_by_user_id = user.user_id
    row.reviewed_at = utcnow()
    row.transaction_id = result.transaction_id
    log_audit(
        "REQUEST_APPROVED",
        "TRANSACTION_REQUEST",
        entity_id=row.request_id,
        actor_user_id=user.user_id,
        details={
            "type": kind.upper(),
            "amount": as_number(row.amount),
            "accountId": str(row.account_id),
            "transactionId": str(result.transaction_id),
        },
    )
    push_notification(
        row.requested_by_user_id,
        "Request approved",
        f"Your {kind} request of {DEFAULT_CURRENCY} {as_number(row.amount):,.2f} was approved by the teller.",
        category="REQUEST",
        link="/dashboard/requests",
    )
    db.session.commit()
    return jsonify(row.to_dict(include_customer=True))


@app.post("/api/teller/requests/<request_id>/reject")
@teller_required
def teller_reject_request(request_id):
    """Teller rejects a pending request with a required reason."""
    user = current_user()
    row = TransactionRequest.query.filter_by(
        request_id=as_int(request_id)
    ).with_for_update().first()
    if not row:
        return error("Request not found.", 404, "not_found")
    if row.status != "PENDING":
        return error("This request has already been processed.", 409, "already_reviewed")

    reason = (body().get("reason") or "").strip()
    if not reason:
        return error("A rejection reason is required.", 400, "reason_required")
    if len(reason) > 500:
        return error("Rejection reason must be 500 characters or fewer.", 400, "reason_too_long")

    row.status = "REJECTED"
    row.rejection_reason = reason
    row.reviewed_by_user_id = user.user_id
    row.reviewed_at = utcnow()
    log_audit(
        "REQUEST_REJECTED",
        "TRANSACTION_REQUEST",
        entity_id=row.request_id,
        actor_user_id=user.user_id,
        severity="WARN",
        details={"type": row.transaction_type, "reason": reason},
    )
    kind_label = "Card" if row.transaction_type == "CARD" else (
        "Withdrawal" if row.transaction_type == "WITHDRAWAL" else "Deposit"
    )
    push_notification(
        row.requested_by_user_id,
        "Request rejected",
        f"Your {kind_label.lower()} request was rejected. Reason: {reason}",
        category="REQUEST",
        link="/dashboard/requests",
    )
    db.session.commit()
    return jsonify(row.to_dict(include_customer=True))



def my_beneficiary(ben_id, user):
    if not user.customer_id:
        return None
    return Beneficiary.query.filter_by(
        beneficiary_id=as_int(ben_id), customer_id=user.customer_id
    ).first()


@app.get("/api/beneficiaries")
@authenticated_required
def list_beneficiaries():
    user = current_user()
    if not user.customer_id:
        return jsonify([])

    items = (
        Beneficiary.query
        .filter_by(customer_id=user.customer_id)
        .order_by(Beneficiary.created_at)
        .all()
    )
    return jsonify([item.to_dict() for item in items])


@app.post("/api/beneficiaries")
@authenticated_required
def create_beneficiary():
    user = current_user()
    if not user.customer_id:
        return error("No customer profile for this user.", 400, "no_customer")

    data = body()
    name = (data.get("name") or "").strip()
    account_number = (data.get("accountNumber") or "").strip()
    if not name or not account_number:
        return error("Name and account number are required.", 400, "invalid_input")

    item = Beneficiary(
        customer_id=user.customer_id,
        name=name,
        account_number=account_number,
        bank=(data.get("bank") or "").strip() or None,
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@app.patch("/api/beneficiaries/<ben_id>")
@authenticated_required
def update_beneficiary(ben_id):
    item = my_beneficiary(ben_id, current_user())
    if not item:
        return error("Beneficiary not found.", 404, "not_found")

    data = body()
    if data.get("name"):
        item.name = str(data["name"]).strip()
    if data.get("accountNumber"):
        item.account_number = str(data["accountNumber"]).strip()
    if "bank" in data:
        item.bank = (data.get("bank") or "").strip() or None

    db.session.commit()
    return jsonify(item.to_dict())


@app.delete("/api/beneficiaries/<ben_id>")
@authenticated_required
def delete_beneficiary(ben_id):
    item = my_beneficiary(ben_id, current_user())
    if not item:
        return error("Beneficiary not found.", 404, "not_found")

    db.session.delete(item)
    db.session.commit()
    return "", 204


def issue_card_for_account(account):
    """Generate, add (uncommitted), and return a new debit card for an account."""
    while True:
        number = "5476" + f"{random.randint(0, 999999999999):012d}"
        if not BankCard.query.filter_by(card_number=number).first():
            break

    cvv = f"{random.randint(1, 999):03d}"

    last4 = None
    for _ in range(20):
        candidate = number[-4:]
        if not BankCard.query.filter_by(card_number_token_or_last4=candidate).first():
            last4 = candidate
            break
    if last4 is None:
        last4 = f"{random.randint(0, 999999):06d}"

    today = utcnow().date()
    expiry_year = today.year + 3
    try:
        expires_on = today.replace(year=expiry_year)
    except ValueError:
        expires_on = today.replace(year=expiry_year, day=28)

    card = BankCard(
        account_id=account.account_id,
        card_number_token_or_last4=last4,
        card_number=number,
        cvv=cvv,
        expires_on=expires_on,
    )
    db.session.add(card)
    return card


def cancel_customer_active_cards(customer_id):
    """Cancel every active card held by a customer and return them."""
    cards = (
        BankCard.query
        .join(BankAccount, BankCard.account_id == BankAccount.account_id)
        .filter(
            BankAccount.customer_id == customer_id,
            BankCard.status == "ACTIVE",
        )
        .all()
    )
    now = utcnow()
    for card in cards:
        card.status = "CANCELLED"
        card.cancelled_at = now
    return cards


@app.get("/api/cards")
@authenticated_required
def list_cards():
    user = current_user()
    if not user.customer_id:
        return jsonify([])

    accounts = BankAccount.query.filter_by(customer_id=user.customer_id, status="ACTIVE").all()
    if not accounts:
        return jsonify([])

    requested = None
    if request.args.get("accountId"):
        wanted = as_int(request.args.get("accountId"))
        requested = next((a for a in accounts if a.account_id == wanted), None)
        if requested is None:
            return jsonify([])

    source = next((a for a in accounts if a.type_name == "savings"), None) or accounts[0]
    customer = user.customer

    active_cards = (
        BankCard.query
        .join(BankAccount, BankCard.account_id == BankAccount.account_id)
        .filter(
            BankAccount.customer_id == user.customer_id,
            BankCard.status == "ACTIVE",
        )
        .order_by(BankCard.card_id.desc())
        .all()
    )
    card = active_cards[0] if active_cards else None
    changed = False

    # A customer holds one card. Retire any extra active cards left by older data.
    for extra in active_cards[1:]:
        extra.status = "CANCELLED"
        extra.cancelled_at = utcnow()
        changed = True

    if card is None or not card.card_number:
        if card is not None:
            card.status = "CANCELLED"
            card.cancelled_at = utcnow()
        card = issue_card_for_account(source)
        changed = True
        db.session.flush()
        push_notification(
            user.user_id,
            "New card issued",
            f"Debit card ending in {card.card_number[-4:]} was issued for your account.",
            category="CARD",
            link="/dashboard",
        )

    if changed:
        db.session.commit()

    card_account = requested or db.session.get(BankAccount, card.account_id) or source
    data = card.to_dict()
    data["accountId"] = str(card_account.account_id)
    data["holder"] = customer.full_name if customer else ""
    data["accountNumber"] = card_account.account_number
    return jsonify([data])


@app.post("/api/cards/request")
@authenticated_required
def request_card():
    user = current_user()
    if not user.customer_id:
        return error("No customer profile for this user.", 400, "no_customer")

    data = body()

    account = None
    if data.get("accountId"):
        account = BankAccount.query.filter_by(
            account_id=as_int(data["accountId"]), customer_id=user.customer_id
        ).first()
    if not account:
        account = (
            BankAccount.query
            .filter_by(customer_id=user.customer_id, status="ACTIVE")
            .order_by(BankAccount.account_id)
            .first()
        )
    if not account:
        return error("Open an account before requesting a card.", 400, "no_account")

    last4 = None
    for _ in range(20):
        candidate = f"{random.randint(0, 9999):04d}"
        if not BankCard.query.filter_by(card_number_token_or_last4=candidate).first():
            last4 = candidate
            break
    if last4 is None:
        return error("Could not issue a card right now.", 500, "card_failed")

    card = BankCard(
        account_id=account.account_id,
        card_number_token_or_last4=last4,
        card_type="DEBIT",
    )
    db.session.add(card)
    db.session.commit()
    return jsonify(card.to_dict()), 201


@app.get("/api/notifications")
@authenticated_required
def list_notifications():
    user = current_user()
    rows = (
        Notification.query
        .filter_by(user_id=user.user_id)
        .order_by(Notification.created_at.desc(), Notification.notification_id.desc())
        .limit(30)
        .all()
    )
    unread = Notification.query.filter_by(user_id=user.user_id, read_at=None).count()
    return jsonify({"unread": unread, "items": [n.to_dict() for n in rows]})


@app.post("/api/notifications/<notification_id>/read")
@authenticated_required
def mark_notification_read(notification_id):
    user = current_user()
    row = Notification.query.filter_by(
        notification_id=as_int(notification_id), user_id=user.user_id
    ).first()
    if not row:
        return error("Notification not found.", 404, "not_found")
    if row.read_at is None:
        row.read_at = utcnow()
        db.session.commit()
    return jsonify(row.to_dict())


@app.post("/api/notifications/read-all")
@authenticated_required
def mark_all_notifications_read():
    user = current_user()
    rows = Notification.query.filter_by(user_id=user.user_id, read_at=None).all()
    if rows:
        now = utcnow()
        for row in rows:
            row.read_at = now
        db.session.commit()
    return jsonify({"updated": len(rows)})



def validate_password(password):
    """Return (message, code) when a password is weak, or (None, None) when valid."""
    if len(password) < 8 or not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        return "Password needs 8+ characters with a letter and a number.", "weak_password"
    return None, None


def parse_date(value):
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def join_phone(country_code, phone):
    combined = f"{country_code or ''}{phone or ''}".strip()
    return combined[:20] or None


NAME_PUNCTUATION = {" ", "-", "'", "."}


def validate_person_name(value, label, required=True):
    """Return an error message for an invalid person name, or None when valid."""
    if not value:
        return f"{label} is required." if required else None
    if len(value) < 2:
        return f"{label} must be at least 2 characters."
    if len(value) > 50:
        return f"{label} must be 50 characters or fewer."
    if not all(ch.isalpha() or ch in NAME_PUNCTUATION for ch in value):
        return f"{label} can only contain letters, spaces, hyphens, apostrophes, and periods."
    return None


def new_verification_code():
    return str(secrets.randbelow(900000) + 100000)


def verification_code_hash(user_id, code):
    payload = f"{user_id}:{code}:{SECRET_KEY}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def issue_verification_code(user):
    code = new_verification_code()
    EmailVerificationToken.query.filter_by(user_id=user.user_id).delete()
    db.session.add(EmailVerificationToken(
        user_id=user.user_id,
        code_hash=verification_code_hash(user.user_id, code),
        expires_at=utcnow() + VERIFICATION_TTL,
    ))
    return code


@app.post("/api/auth/register")
def register():
    data = body()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if "@" not in email or "." not in email:
        return error("Enter a valid email address.", 400, "invalid_email")
    message, code = validate_password(password)
    if message:
        return error(message, 400, code)
    if not data.get("acceptTerms"):
        return error("You must agree to the Terms of Agreement.", 400, "terms_not_accepted")
    if not data.get("acceptPrivacy"):
        return error("You must agree to the Privacy Notice.", 400, "privacy_not_accepted")
    if AppUser.query.filter_by(username=email).first() or Customer.query.filter_by(email=email).first():
        return error("An account with that email already exists.", 409, "email_taken")

    first_name = (data.get("firstName") or "").strip()
    middle_name = (data.get("middleName") or "").strip()
    last_name = (data.get("lastName") or "").strip()
    for label, value, is_required in (
        ("First name", first_name, True),
        ("Middle name", middle_name, False),
        ("Last name", last_name, True),
    ):
        message = validate_person_name(value, label, required=is_required)
        if message:
            return error(message, 400, "invalid_name")

    accepted_at = utcnow()
    customer = Customer(
        first_name=first_name,
        middle_name=middle_name or None,
        last_name=last_name,
        date_of_birth=parse_date(data.get("birthdate")),
        email=email,
        phone=join_phone(data.get("countryCode"), data.get("phone")),
        address=(data.get("address") or "").strip() or None,
        terms_accepted_at=accepted_at,
        privacy_accepted_at=accepted_at,
        consent_version=CONSENT_VERSION,
    )
    db.session.add(customer)
    db.session.flush()  

    user = AppUser(
        customer_id=customer.customer_id,
        username=email,
        password_hash=hash_password(password),
        role="CUSTOMER",
    )
    db.session.add(user)
    db.session.flush()

    code = issue_verification_code(user)
    try:
        send_verification_code(email, code)
    except Exception:
        db.session.rollback()
        app.logger.exception("Could not send verification email to %s", email)
        return error(
            "We could not send the verification email. Please try again later.",
            503,
            "email_delivery_failed",
        )

    db.session.commit()
    return jsonify({
        "email": email,
        "message": "We sent a verification code to your email address.",
    }), 201


@app.post("/api/auth/verify-email")
def verify_email():
    data = body()
    email = (data.get("email") or "").strip().lower()
    code = str(data.get("code") or "").strip()

    if len(code) != 6 or not code.isdigit():
        return error("Enter the 6-digit code.", 400, "invalid_verification_code")

    user = AppUser.query.filter_by(username=email).first()
    if not user:
        return error("That code is incorrect or has expired.", 400, "invalid_verification_code")
    if user.email_verified_at is not None:
        return error("That email address is already verified.", 409, "email_already_verified")

    record = (
        EmailVerificationToken.query
        .filter_by(user_id=user.user_id)
        .order_by(EmailVerificationToken.verification_id.desc())
        .first()
    )
    if not record or record.expires_at <= utcnow():
        return error("That code is incorrect or has expired.", 400, "invalid_verification_code")
    if record.attempts >= VERIFICATION_MAX_ATTEMPTS:
        return error("Too many attempts. Request a new code.", 429, "too_many_attempts")

    if not hmac.compare_digest(record.code_hash, verification_code_hash(user.user_id, code)):
        record.attempts += 1
        db.session.commit()
        return error("That code is incorrect or has expired.", 400, "invalid_verification_code")

    user.email_verified_at = utcnow()
    EmailVerificationToken.query.filter_by(user_id=user.user_id).delete()
    db.session.commit()
    return jsonify({"user": user.to_dict(), "token": make_token(user)})


@app.post("/api/auth/resend-verification")
def resend_verification():
    data = body()
    email = (data.get("email") or "").strip().lower()
    message = {"message": "If that account needs verification, a new code has been sent."}

    user = AppUser.query.filter_by(username=email).first()
    if not user or user.email_verified_at is not None:
        return jsonify(message)

    latest = (
        EmailVerificationToken.query
        .filter_by(user_id=user.user_id)
        .order_by(EmailVerificationToken.verification_id.desc())
        .first()
    )
    if latest and (utcnow() - latest.created_at).total_seconds() < VERIFICATION_RESEND_SECONDS:
        return jsonify(message)

    code = issue_verification_code(user)
    try:
        send_verification_code(email, code)
    except Exception:
        db.session.rollback()
        app.logger.exception("Could not resend verification email to %s", email)
        return error(
            "We could not send the verification email. Please try again later.",
            503,
            "email_delivery_failed",
        )

    db.session.commit()
    return jsonify(message)


@app.post("/api/auth/login")
def login():
    data = body()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    ip_address = request.remote_addr

    remaining = login_is_locked(email, ip_address)
    if remaining:
        return error(
            "Too many failed login attempts. Try again in a few minutes.",
            429,
            "too_many_attempts",
        )

    user = AppUser.query.filter_by(username=email).first()
    if not user or not user.is_active or not check_password(user.password_hash, password):
        record_login_failure(email, ip_address)
        now = utcnow()
        window_start = now - timedelta(minutes=5)
        failures = AuditLog.query.filter(
            AuditLog.action == "LOGIN_FAILED",
            AuditLog.created_at >= window_start,
        ).all()
        account_failures = 1
        ip_failures = 1
        for failure in failures:
            details = failure.details or {}
            if details.get("accountKey") == email:
                account_failures += 1
            if ip_address and details.get("ipAddress") == ip_address:
                ip_failures += 1
        repeated_failures = max(account_failures, ip_failures)
        log_audit(
            "LOGIN_FAILED",
            "AUTH",
            actor_user_id=None,
            severity="WARN" if repeated_failures >= 5 else "INFO",
            details={
                "accountKey": email,
                "attemptedUserId": str(user.user_id) if user else None,
                "ipAddress": ip_address,
                "failureCount": repeated_failures,
            },
        )
        if repeated_failures == 5:
            log_audit(
                "FAILED_LOGIN_SPIKE",
                "AUTH",
                actor_user_id=None,
                severity="WARN",
                details={
                    "accountKey": email,
                    "attemptedUserId": str(user.user_id) if user else None,
                    "ipAddress": ip_address,
                    "failureCount": repeated_failures,
                    "windowMinutes": 5,
                },
            )
        db.session.commit()
        return error("Invalid email or password.", 401, "invalid_credentials")

    if user.email_verified_at is None:
        return error(
            "Verify your email address before signing in.",
            403,
            "email_not_verified",
        )

    user.last_login_at = utcnow()
    clear_login_attempts(email, ip_address)
    log_audit(
        "LOGIN_SUCCESS",
        "AUTH",
        actor_user_id=user.user_id,
        details={
            "accountKey": email,
            "ipAddress": ip_address,
        },
    )
    db.session.commit()

    return jsonify({"user": user.to_dict(), "token": make_token(user)})


@app.get("/api/profile")
@authenticated_required
def get_profile():
    """Customer views their personal information."""
    user = current_user()
    customer = user.customer
    if not customer:
        return error("No customer profile for this user.", 400, "no_customer")
    return jsonify({
        "customerId": str(customer.customer_id),
        "firstName": customer.first_name,
        "middleName": customer.middle_name,
        "lastName": customer.last_name,
        "email": customer.email,
        "phone": customer.phone,
        "address": customer.address,
        "avatar": customer.avatar,
        "emailVerified": user.email_verified_at is not None,
        "customerStatus": customer.status,
    })


@app.patch("/api/profile")
@authenticated_required
def update_profile():
    """Customer manages their personal information (email stays fixed)."""
    user = current_user()
    customer = user.customer
    if not customer:
        return error("No customer profile for this user.", 400, "no_customer")

    data = body()
    updates = []
    field_keys = [("first_name", "firstName"), ("middle_name", "middleName"), ("last_name", "lastName")]
    for field, key in field_keys:
        if key in data:
            value = str(data[key] or "").strip()
            label = "First name" if field == "first_name" else ("Middle name" if field == "middle_name" else "Last name")
            message = validate_person_name(value, label, required=field != "middle_name")
            if message:
                return error(message, 400, "invalid_name")
            setattr(customer, field, value or None)
            updates.append(key)
    if "phone" in data:
        customer.phone = join_phone(None, data.get("phone"))[:20] or None
        updates.append("phone")
    if "address" in data:
        customer.address = str(data.get("address") or "").strip()[:255] or None
        updates.append("address")
    if "avatar" in data:
        raw_avatar = data.get("avatar")
        if raw_avatar in (None, ""):
            customer.avatar = None
        else:
            if not isinstance(raw_avatar, str) or len(raw_avatar) > 2_000_000:
                return error("Avatar must be an image up to 1 MB.", 400, "invalid_avatar")
            mime, separator, payload = raw_avatar.partition(";base64,")
            if not separator or mime not in ("data:image/png", "data:image/jpeg", "data:image/webp"):
                return error("Avatar must be a PNG, JPG, or WebP image.", 400, "invalid_avatar")
            try:
                decoded = base64.b64decode(payload, validate=True)
            except (binascii.Error, ValueError):
                return error("Avatar image is not valid.", 400, "invalid_avatar")
            if len(decoded) > 1_048_576:
                return error("Avatar must be an image up to 1 MB.", 400, "invalid_avatar")
            customer.avatar = raw_avatar
        updates.append("avatar")

    if not updates:
        return error("Nothing to update.", 400, "no_changes")

    log_audit(
        "PROFILE_UPDATED",
        "CUSTOMER",
        entity_id=customer.customer_id,
        actor_user_id=user.user_id,
        details={"fields": updates},
    )
    db.session.commit()
    return jsonify({
        "customerId": str(customer.customer_id),
        "firstName": customer.first_name,
        "middleName": customer.middle_name,
        "lastName": customer.last_name,
        "email": customer.email,
        "phone": customer.phone,
        "address": customer.address,
        "avatar": customer.avatar,
        "emailVerified": user.email_verified_at is not None,
        "customerStatus": customer.status,
    })


@app.post("/api/auth/change-password")
@authenticated_required
def change_password():
    """Customer changes their own password (account security)."""
    user = current_user()
    data = body()
    current_password = data.get("currentPassword") or ""
    new_password = data.get("newPassword") or ""

    if not check_password(user.password_hash, current_password):
        return error("Your current password is incorrect.", 401, "wrong_password")
    message, code = validate_password(new_password)
    if message:
        return error(message, 400, code)

    user.password_hash = hash_password(new_password)
    user.auth_token_version += 1
    log_audit(
        "PASSWORD_CHANGED",
        "APP_USER",
        entity_id=user.user_id,
        actor_user_id=user.user_id,
    )
    db.session.commit()
    return jsonify({"message": "Password updated. Please sign in again."})


@app.post("/api/auth/reset-password")
def reset_password():
    data = body()
    token = str(data.get("token") or "")
    password = str(data.get("password") or "")
    message, code = validate_password(password)
    if message:
        return error(message, 400, code)

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    reset = PasswordResetToken.query.filter_by(token_hash=token_hash).with_for_update().first()
    if not reset or reset.expires_at <= utcnow():
        return error("This password reset link is invalid or expired.", 400, "invalid_reset_token")

    user = db.session.get(AppUser, reset.user_id)
    if not user or not user.is_active:
        return error("This password reset link is invalid or expired.", 400, "invalid_reset_token")

    user.password_hash = hash_password(password)
    user.auth_token_version += 1
    db.session.delete(reset)
    log_audit(
        "PASSWORD_RESET_COMPLETED",
        "APP_USER",
        entity_id=user.user_id,
        actor_user_id=user.user_id,
    )
    db.session.commit()
    return jsonify({"message": "Password updated."})



@app.get("/")
def home():
    return {"message": "Gellybank backend is running!"}


@app.get("/api/health")
def health():
    return {"status": "success", "message": "Gellybank backend API is live!"}


@app.errorhandler(404)
def not_found(_e):
    return error("Endpoint not found.", 404, "not_found")


@app.errorhandler(500)
def internal_error(_e):
    db.session.rollback()
    return error("Something went wrong. Please try again.", 500, "internal_error")


@app.errorhandler(Exception)
def unhandled_error(e):
    if isinstance(e, HTTPException):
        return jsonify({"message": e.description}), e.code
    app.logger.exception("Unhandled error: %s", e)
    db.session.rollback()
    return error("Something went wrong. Please try again.", 500, "internal_error")



def add_demo_data():
    if Customer.query.first():
        return  

    savings_type = AccountType.query.filter_by(type_name="SAVINGS").first()
    checking_type = AccountType.query.filter_by(type_name="CHECKING").first()
    if not savings_type or not checking_type:
        return  

    customer = Customer(
        first_name="Jhamel",
        last_name="Sumague",
        email=DEMO_EMAIL,
        phone="+639171234567",
        address="Manila, Philippines",
    )
    db.session.add(customer)
    db.session.flush()  

    user = AppUser(
        customer_id=customer.customer_id,
        username=DEMO_EMAIL,  
        password_hash=hash_password(DEMO_PASSWORD),
        role="CUSTOMER",
        email_verified_at=utcnow(),
    )
    db.session.add(user)
    db.session.flush()

    savings = BankAccount(
        customer_id=customer.customer_id,
        account_type_id=savings_type.account_type_id,
        account_number=new_account_number(),
        current_balance=25000.00,
        interest_rate=savings_type.default_interest_rate,
    )
    checking = BankAccount(
        customer_id=customer.customer_id,
        account_type_id=checking_type.account_type_id,
        account_number=new_account_number(),
        current_balance=8500.00,
        interest_rate=checking_type.default_interest_rate,
    )
    db.session.add_all([savings, checking])
    db.session.flush()

    db.session.add_all([
        Transaction(
            account_id=savings.account_id,
            transaction_type="DEPOSIT",
            amount=25000.00,
            balance_after=25000.00,
            reference_code=new_reference(),
            description="Initial deposit",
            performed_by_user_id=user.user_id,
            created_at=utcnow(),
        ),
        Transaction(
            account_id=checking.account_id,
            transaction_type="DEPOSIT",
            amount=8500.00,
            balance_after=8500.00,
            reference_code=new_reference(),
            description="Payroll",
            performed_by_user_id=user.user_id,
            created_at=utcnow(),
        ),
    ])

    db.session.add(Beneficiary(
        customer_id=customer.customer_id,
        name="Maria Santos",
        account_number="100020003099",
        bank="GellyBank",
    ))

    db.session.commit()


if os.environ.get("SEED_DEMO") == "1":
    with app.app_context():
        add_demo_data()

if __name__ == "__main__":
    app.run(
        debug=os.environ.get("FLASK_DEBUG") == "1",
        port=int(os.environ.get("GELLYBANK_BACKEND_PORT", "5000")),
    )
