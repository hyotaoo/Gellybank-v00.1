

import os
import random
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from uuid import uuid4

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash


load_dotenv()

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit(
        "No DATABASE_URL found. Copy backend/.env.example to backend/.env, "
        "fill in your MySQL user and password, then start the app again."
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
    return serializer.dumps({"user_id": user.user_id}, salt="auth")


def current_user():
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])
        try:
            data = serializer.loads(header[7:], salt="auth", max_age=TOKEN_MAX_AGE)
            user = db.session.get(AppUser, data.get("user_id"))
            if user:
                return user
        except (BadSignature, SignatureExpired):
            pass  
    return AppUser.query.filter_by(username=DEMO_EMAIL).first()



class Customer(db.Model):
    __tablename__ = "customers"

    customer_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
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

    user_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    customer_id = db.Column(db.BigInteger, db.ForeignKey("customers.customer_id"))
    username = db.Column(db.String(50), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="CUSTOMER")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
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
            "role": "admin" if self.role in ("ADMIN", "TELLER") else "customer",
        }


class AccountType(db.Model):
    __tablename__ = "account_types"

    account_type_id = db.Column(db.SmallInteger, primary_key=True, autoincrement=True)
    type_name = db.Column(db.String(30), nullable=False, unique=True)  
    description = db.Column(db.String(255))
    minimum_balance = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    default_interest_rate = db.Column(db.Numeric(5, 2), nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=utcnow)


class BankAccount(db.Model):
    __tablename__ = "bank_accounts"

    account_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
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

    transfer_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
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

    transaction_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
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

    card_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
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

    beneficiary_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
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
def create_account():
    user = current_user()
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

    account = BankAccount(
        customer_id=user.customer_id,
        account_type_id=account_type.account_type_id,
        account_number=new_account_number(),
        current_balance=initial,
        interest_rate=account_type.default_interest_rate,
    )
    db.session.add(account)
    db.session.commit()

    primary = primary_account_id(user.customer_id)
    return jsonify(account.to_dict(is_primary=(account.account_id == primary))), 201


@app.get("/api/accounts/<account_id>")
def get_account(account_id):
    user = current_user()
    account = my_account(account_id, user)
    if not account:
        return error("Account not found.", 404, "not_found")

    primary = primary_account_id(user.customer_id)
    return jsonify(account.to_dict(is_primary=(account.account_id == primary)))


@app.patch("/api/accounts/<account_id>")
def update_account(account_id):
    user = current_user()
    account = my_account(account_id, user)
    if not account:
        return error("Account not found.", 404, "not_found")

    primary = primary_account_id(user.customer_id)
    return jsonify(account.to_dict(is_primary=(account.account_id == primary)))


@app.delete("/api/accounts/<account_id>")
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


@app.get("/api/transactions")
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
def create_transaction():
    user = current_user()
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
def create_transfer():
    user = current_user()
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
def update_note(tx_id):
    tx = my_transaction(tx_id, current_user())
    if not tx:
        return error("Transaction not found.", 404, "not_found")

    tx.description = (body().get("note") or "").strip() or None
    db.session.commit()
    return jsonify(tx.to_dict())


@app.delete("/api/transactions/<tx_id>")
def void_transaction(tx_id):
    tx = my_transaction(tx_id, current_user())
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
def delete_beneficiary(ben_id):
    item = my_beneficiary(ben_id, current_user())
    if not item:
        return error("Beneficiary not found.", 404, "not_found")

    db.session.delete(item)
    db.session.commit()
    return "", 204



@app.post("/api/cards/request")
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
        return error("Invalid email or password.", 401, "invalid_credentials")

    user.last_login_at = utcnow()
    db.session.commit()

    return jsonify({"user": user.to_dict(), "token": make_token(user)})



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


with app.app_context():
    add_demo_data()  

if __name__ == "__main__":
    app.run(debug=True, port=5000)