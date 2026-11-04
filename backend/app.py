

import os
import random
import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from functools import wraps
from uuid import uuid4

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import check_password_hash, generate_password_hash


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

DEMO_EMAIL = "demo@gellybank.com"
DEMO_PASSWORD = "demo12345"

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
    status = db.Column(db.String(20), nullable=False, default="ACTIVE")
    terms_accepted_at = db.Column(db.DateTime)
    privacy_accepted_at = db.Column(db.DateTime)
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
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="CUSTOMER")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
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
            "firstName": customer.first_name if customer else self.username,
            "lastName": customer.last_name if customer else "",
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


class BankCard(db.Model):
    __tablename__ = "bank_cards"

    card_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    account_id = db.Column(db.BigInteger, db.ForeignKey("bank_accounts.account_id"), nullable=False)
    card_number_token_or_last4 = db.Column(db.String(100), nullable=False, unique=True)
    card_type = db.Column(db.String(20), nullable=False, default="DEBIT")  
    status = db.Column(db.String(20), nullable=False, default="ACTIVE")
    issued_at = db.Column(db.DateTime, default=utcnow)
    expires_on = db.Column(db.Date)
    blocked_at = db.Column(db.DateTime)
    cancelled_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            "id": str(self.card_id),
            "type": self.card_type.lower(),
            "last4": self.card_number_token_or_last4,
            "status": self.status.lower(),
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


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    reset_token_id = db.Column(ID_TYPE, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.BigInteger, db.ForeignKey("app_users.user_id", ondelete="CASCADE"), nullable=False
    )
    token_hash = db.Column(db.String(64), nullable=False, unique=True)
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
        metrics = {
            "totalUsers": AppUser.query.count(),
            "pendingApplications": AccountApplication.query.filter_by(status="PENDING").count(),
            "totalAccounts": BankAccount.query.count(),
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
    entries = query.order_by(AuditLog.created_at.desc()).limit(200).all()
    return jsonify([entry.to_dict() for entry in entries])


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


@app.get("/api/admin/transactions")
@staff_required
def admin_list_transactions():
    """Admin monitors all transactions without modifying them."""
    query = Transaction.query
    tx_type = request.args.get("type", "").upper()
    if tx_type:
        if tx_type not in ("DEPOSIT", "WITHDRAWAL", "TRANSFER_IN", "TRANSFER_OUT", "ADJUSTMENT"):
            return error("Invalid transaction type filter.", 400, "invalid_type")
        query = query.filter_by(transaction_type=tx_type)
    limit = request.args.get("limit", type=int) or 50
    limit = max(1, min(limit, 200))
    transactions = (
        query
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for tx in transactions:
        item = tx.to_dict()
        staff = db.session.get(AppUser, tx.performed_by_user_id) if tx.performed_by_user_id else None
        item["performedBy"] = staff.role.lower() if staff else None
        result.append(item)
    return jsonify(result)


@app.get("/api/admin/reports")
@admin_required
def admin_reports():
    """Basic operational report: totals and counts, ignoring voided transactions."""
    active_filter = Transaction.status != "VOID"
    done = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    def sums(start=None):
        query = Transaction.query.filter(active_filter)
        if start:
            query = query.filter(Transaction.created_at >= start)
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
    return jsonify({
        "accounts": counts,
        "lifetimeByType": sums(),
        "todayByType": sums(done),
        "deployedBalance": as_number(
            db.session.query(
                db.func.coalesce(db.func.sum(BankAccount.current_balance), 0)
            ).filter(BankAccount.status != "CLOSED").scalar()
        ),
        "systemHealth": "healthy" if db_check else "degraded",
    })


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
        db.session.commit()
    except Exception:
        db.session.rollback()
        return error("Transaction failed. Please try again.", 500, "transaction_failed")

    return tx


@app.post("/api/transactions")
@authenticated_required
def create_transaction():
    """Customer self-service deposit/withdraw on their own account."""
    user = current_user()
    denied = reject_admin_transaction(user)
    if denied:
        return denied
    data = body()

    account = my_account(data.get("accountId"), user)
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
    else:
        beneficiary = Beneficiary.query.filter_by(
            beneficiary_id=as_int(data.get("beneficiaryId")),
            customer_id=user.customer_id,
        ).first()
        if not beneficiary:
            return error("Recipient not found.", 404, "not_found")

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



@app.get("/api/insights/spending")
@authenticated_required
def spending():
    user = current_user()
    account_id = request.args.get("accountId")

    if not user.customer_id:
        owned_ids = []
    else:
        owned_ids = [a.account_id for a in BankAccount.query.filter_by(customer_id=user.customer_id).all()]
    if account_id:
        wanted = as_int(account_id)
        owned_ids = [i for i in owned_ids if i == wanted]

    if not owned_ids:
        return jsonify({
            "total": 0,
            "currency": DEFAULT_CURRENCY,
            "categories": [],
            "tips": [],
        })

    outgoing = Transaction.query.filter(
        Transaction.account_id.in_(owned_ids),
        Transaction.transaction_type.in_(("WITHDRAWAL", "TRANSFER_OUT")),
        Transaction.status != "VOID",
    ).all()

    totals = {}
    for tx in outgoing:
        label = tx.description or "Other"
        totals[label] = totals.get(label, Decimal("0")) + tx.amount

    total = sum(totals.values(), Decimal("0"))
    categories = []
    for label, amount in sorted(totals.items(), key=lambda item: item[1], reverse=True):
        percent = round(float(amount / total) * 100) if total else 0
        categories.append({"label": label, "value": percent, "amount": as_number(amount)})

    return jsonify({
        "total": as_number(total),
        "currency": DEFAULT_CURRENCY,
        "categories": categories,
        "tips": ["Review your biggest spending category each week."],
    })



def parse_date(value):
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def join_phone(country_code, phone):
    combined = f"{country_code or ''}{phone or ''}".strip()
    return combined[:20] or None


@app.post("/api/auth/register")
def register():
    data = body()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if "@" not in email or "." not in email:
        return error("Enter a valid email address.", 400, "invalid_email")
    if len(password) < 8 or not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        return error("Password needs 8+ characters with a letter and a number.", 400, "weak_password")
    if not data.get("acceptTerms"):
        return error("You must agree to the Terms of Agreement.", 400, "terms_not_accepted")
    if not data.get("acceptPrivacy"):
        return error("You must agree to the Privacy Notice.", 400, "privacy_not_accepted")
    if AppUser.query.filter_by(username=email).first() or Customer.query.filter_by(email=email).first():
        return error("An account with that email already exists.", 409, "email_taken")

    customer = Customer(
        first_name=(data.get("firstName") or "").strip(),
        middle_name=(data.get("middleName") or "").strip() or None,
        last_name=(data.get("lastName") or "").strip(),
        date_of_birth=parse_date(data.get("birthdate")),
        email=email,
        phone=join_phone(data.get("countryCode"), data.get("phone")),
        address=(data.get("address") or "").strip() or None,
        terms_accepted_at=utcnow(),
        privacy_accepted_at=utcnow(),
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
    db.session.commit()

    return jsonify({"user": user.to_dict(), "token": make_token(user)}), 201


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

    user.last_login_at = utcnow()
    clear_login_attempts(email, ip_address)
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
            value = str(data[key] or "").strip()[:50] or None
            if field in ("first_name", "last_name") and not value:
                return error(f"{'First' if field == 'first_name' else 'Last'} name cannot be empty.", 400, "invalid_input")
            setattr(customer, field, value)
            updates.append(key)
    if "phone" in data:
        customer.phone = join_phone(None, data.get("phone"))[:20] or None
        updates.append("phone")
    if "address" in data:
        customer.address = str(data.get("address") or "").strip()[:255] or None
        updates.append("address")

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
    if len(new_password) < 8 or not any(c.isalpha() for c in new_password) or not any(c.isdigit() for c in new_password):
        return error("Password needs 8+ characters with a letter and a number.", 400, "weak_password")

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
    if len(password) < 8 or not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        return error("Password needs 8+ characters with a letter and a number.", 400, "weak_password")

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
