

import os
import random
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from functools import wraps
from uuid import uuid4

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import check_password_hash, generate_password_hash


load_dotenv()

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit(
        "No DATABASE_URL found. Run 'python dev.py' from the repo root to "
        "create backend/.env, then start the app again."
    )

TOKEN_MAX_AGE = 60 * 60 * 24  

DEMO_EMAIL = "demo@gellybank.com"
DEMO_PASSWORD = "demo12345"


app = Flask(__name__)
app.config["SECRET_KEY"] = SECRET_KEY
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

CORS(app)

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


@app.post("/api/transactions")
@authenticated_required
def create_transaction():
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

    if account.status != "ACTIVE":
        return error("This account is not active.", 400, "account_inactive")

    if kind == "withdraw":
        if amount > account.current_balance:
            return error("Insufficient funds.", 400, "insufficient_funds")
        account.current_balance -= amount
        tx_type = "WITHDRAWAL"
    else:
        account.current_balance += amount
        tx_type = "DEPOSIT"

    tx = Transaction(
        account_id=account.account_id,
        transaction_type=tx_type,
        amount=amount,
        balance_after=account.current_balance,
        reference_code=new_reference(),
        description=(data.get("note") or "").strip() or None,
        performed_by_user_id=user.user_id,
    )
    db.session.add(tx)
    db.session.commit()
    return jsonify(tx.to_dict()), 201


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
    if amount > source.current_balance:
        return error("Insufficient funds.", 400, "insufficient_funds")

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
        source.current_balance -= amount
        transfer = None

        if destination:
            destination.current_balance += amount
            transfer = Transfer(
                reference_code=reference,
                from_account_id=source.account_id,
                to_account_id=destination.account_id,
                amount=amount,
                status="COMPLETED",
                initiated_by_user_id=user.user_id,
                description=note,
                completed_at=utcnow(),
            )
            db.session.add(transfer)
            db.session.flush()  

            db.session.add(Transaction(
                account_id=destination.account_id,
                transfer_id=transfer.transfer_id,
                transaction_type="TRANSFER_IN",
                amount=amount,
                balance_after=destination.current_balance,
                reference_code=new_reference(),
                description=note,
                performed_by_user_id=user.user_id,
            ))

        tx = Transaction(
            account_id=source.account_id,
            transfer_id=transfer.transfer_id if transfer else None,
            transaction_type="TRANSFER_OUT",
            amount=amount,
            balance_after=source.current_balance,
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

    user = AppUser.query.filter_by(username=email).first()
    if not user or not user.is_active or not check_password(user.password_hash, password):
        now = utcnow()
        window_start = now - timedelta(minutes=5)
        failures = AuditLog.query.filter(
            AuditLog.action == "LOGIN_FAILED",
            AuditLog.created_at >= window_start,
        ).all()
        account_failures = 1
        ip_failures = 1
        ip_address = request.remote_addr
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
    db.session.commit()

    return jsonify({"user": user.to_dict(), "token": make_token(user)})


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


if os.environ.get("SKIP_DEMO_SEED") != "1":
    with app.app_context():
        add_demo_data()

if __name__ == "__main__":
    app.run(debug=True, port=5000)