#!/usr/bin/env python3
"""Gellybank developer tool - terminal only.

    python dev.py

Bootstraps the venv, installs dependencies, configures .env, creates the
MySQL database/user/schema, and starts/stops the backend and frontend.
Only requires Python to be pre-installed.
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import platform
import re
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
from urllib.parse import quote, unquote
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = BACKEND / "venv"
ENV_FILE = BACKEND / ".env"
FRONTEND_ENV_FILE = FRONTEND / ".env"
SCHEMA_FILE = BACKEND / "db" / "schema.sql"
ADMIN_MIGRATION_FILE = BACKEND / "db" / "migrations" / "001_admin_operations.sql"
BENEFICIARIES_MIGRATION_FILE = BACKEND / "db" / "migrations" / "002_beneficiaries.sql"
LEGACY_COLUMNS_MIGRATION_FILE = BACKEND / "db" / "migrations" / "003_legacy_model_columns.sql"
CONSENT_MIGRATION_FILE = BACKEND / "db" / "migrations" / "004_consent_columns.sql"
TX_REQUESTS_MIGRATION_FILE = BACKEND / "db" / "migrations" / "005_transaction_requests.sql"
CARD_NOTIFICATIONS_MIGRATION_FILE = BACKEND / "db" / "migrations" / "006_card_requests_and_notifications.sql"
EMAIL_VERIFICATION_MIGRATION_FILE = BACKEND / "db" / "migrations" / "007_email_verification.sql"
CONSENT_VERSIONS_MIGRATION_FILE = BACKEND / "db" / "migrations" / "008_consent_versions.sql"
DROP_AI_INSIGHTS_MIGRATION_FILE = BACKEND / "db" / "migrations" / "009_drop_ai_insights.sql"
CARD_LOST_MIGRATION_FILE = BACKEND / "db" / "migrations" / "010_card_lost_requests.sql"
CUSTOMER_AVATAR_MIGRATION_FILE = BACKEND / "db" / "migrations" / "011_customer_avatar.sql"
ADMIN_MANAGEMENT_MIGRATION_FILE = BACKEND / "db" / "migrations" / "012_admin_management.sql"
CUSTOMER_PROFILE_MIGRATION_FILE = BACKEND / "db" / "migrations" / "013_customer_profile_details.sql"
BACKEND_REQUIREMENTS = BACKEND / "requirements.txt"
BACKUP_SCRIPT = ROOT / "scripts" / "backup_db.sh"
RESTORE_SCRIPT = ROOT / "scripts" / "restore_db.sh"
BACKUP_DIR = ROOT / "backups"

DB_NAME = os.environ.get("GELLYBANK_DB_NAME", "gellybank_db")
DB_USER = os.environ.get("GELLYBANK_DB_USER", "root")
DB_HOST = os.environ.get("GELLYBANK_DB_HOST", "127.0.0.1")
DB_PORT = int(os.environ.get("GELLYBANK_DB_PORT", "3306"))
DB_ADMIN_USER = os.environ.get("GELLYBANK_DB_ADMIN_USER", "root")

BACKEND_PORT = int(os.environ.get("GELLYBANK_BACKEND_PORT", "5000"))
FRONTEND_PORT = int(os.environ.get("GELLYBANK_FRONTEND_PORT", "5173"))

REQUIRED_MODULES = ("flask", "flask_cors", "flask_sqlalchemy", "pymysql", "dotenv")
PASSWORD_PATTERN = re.compile(r"[^\r\n]{8,128}")
PASSWORD_HINT = "Use 8-128 characters on a single line"

DB_SETUP_OK = 0
DB_SETUP_FAILED = 1
DB_SETUP_NEEDS_ADMIN = 3
DB_SETUP_MISSING_PACKAGE = 4

# MySQL errors that mean "the database or the account has to be created".
ADMIN_ERROR_CODES = (1044, 1045, 1049, 1142, 1698)

PROCESSES: dict[str, subprocess.Popen] = {}
LOG_LOCK = threading.Lock()

DB_CHECK_CODE = """
import os, sys
try:
    import pymysql
except Exception:
    sys.exit(2)
try:
    connection = pymysql.connect(
        host=os.environ["GB_HOST"],
        port=int(os.environ["GB_PORT"]),
        user=os.environ["GB_USER"],
        password=os.environ["GB_PASSWORD"],
        database=os.environ["GB_DATABASE"],
        charset="utf8mb4",
        connect_timeout=5,
    )
    cursor = connection.cursor()
    cursor.execute("SHOW TABLES")
    tables = {row[0] for row in cursor.fetchall()}
except Exception:
    sys.exit(4)
if not {"app_users", "bank_accounts"}.issubset(tables):
    connection.close()
    sys.exit(3)
try:
    cursor.execute("SHOW COLUMNS FROM app_users")
    user_columns = {row[0] for row in cursor.fetchall()}
    cursor.execute("SHOW COLUMNS FROM audit_logs")
    audit_columns = {row[0] for row in cursor.fetchall()}
    cursor.execute("SHOW COLUMNS FROM transactions")
    transaction_columns = {row[0] for row in cursor.fetchall()}
    cursor.execute("SHOW COLUMNS FROM account_applications")
    application_columns = {row[0] for row in cursor.fetchall()}
    cursor.execute("SHOW COLUMNS FROM customers")
    customer_columns = {row[0] for row in cursor.fetchall()}
except Exception:
    connection.close()
    sys.exit(5)
connection.close()
required_tables = {
    "account_applications",
    "password_reset_tokens",
    "beneficiaries",
    "email_verification_tokens",
}
admin_schema_ready = (
    required_tables.issubset(tables)
    and "bank_settings" in tables
    and "auth_token_version" in user_columns
    and "display_name" in user_columns
    and "email_verified_at" in user_columns
    and "severity" in audit_columns
    and "status" in transaction_columns
    and "created_account_id" in application_columns
    and "city" in customer_columns
    and "annual_gross_income" in customer_columns
    and "account_ownership_type" in customer_columns
)
sys.exit(0 if admin_schema_ready else 5)
"""


def log_line(message: str = "") -> None:
    with LOG_LOCK:
        print(message, flush=True)


def module_available(name: str) -> bool:
    try:
        importlib.import_module(name)
        return True
    except Exception:
        return False


def venv_python() -> Path:
    if os.name == "nt":
        return VENV / "Scripts" / "python.exe"
    return VENV / "bin" / "python"


def venv_exists() -> bool:
    return venv_python().exists()


def packages_installed() -> bool:
    if not venv_exists():
        return False
    try:
        result = subprocess.run(
            [str(venv_python()), "-c", f"import {', '.join(REQUIRED_MODULES)}"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        return result.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def node_modules_ready() -> bool:
    return (FRONTEND / "node_modules").is_dir()


def port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    hosts = [host, "::1", "localhost"]
    for candidate in hosts:
        family = socket.AF_INET6 if ":" in candidate else socket.AF_INET
        try:
            with socket.socket(family, socket.SOCK_STREAM) as probe:
                probe.settimeout(0.4)
                if probe.connect_ex((candidate, port)) == 0:
                    return True
        except OSError:
            continue
    return False


def http_get(url: str, timeout: float = 2.0):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        return exc.code, ""
    except Exception as exc:
        return None, str(exc)


def relative(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def read_env_file() -> dict[str, str]:
    values: dict[str, str] = {}
    if not ENV_FILE.exists():
        return values
    try:
        text = ENV_FILE.read_text(encoding="utf-8")
    except OSError:
        return values
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip()
    return values


def parse_db_url(url: str) -> dict:
    match = re.match(
        r"^(?P<driver>[A-Za-z0-9+]+)://"
        r"(?P<user>[^:@/]+):(?P<password>[^@/]*)@"
        r"(?P<host>[^:/]+)(?::(?P<port>\d+))?"
        r"/(?P<database>[^?]+)$",
        url.strip(),
    )
    if not match:
        raise ValueError(f"Unrecognised DATABASE_URL: {url}")
    parts = match.groupdict()
    return {
        "user": parts["user"],
        "password": unquote(parts["password"]),
        "host": parts["host"],
        "port": int(parts["port"] or 3306),
        "database": parts["database"],
    }


def env_database_name() -> str:
    url = read_env_file().get("DATABASE_URL")
    if url:
        try:
            return parse_db_url(url)["database"]
        except ValueError:
            pass
    return DB_NAME


def env_written() -> bool:
    values = read_env_file()
    url = values.get("DATABASE_URL", "")
    secret = values.get("SECRET_KEY", "")
    if not url or not secret:
        return False
    return "PASSWORD" not in url and "change-this" not in secret


def database_ready() -> bool:
    return database_check_code() == 0


def database_check_code() -> int:
    url = read_env_file().get("DATABASE_URL")
    if not url or not venv_exists():
        return 4
    try:
        parts = parse_db_url(url)
    except ValueError:
        return 4
    environment = dict(os.environ)
    environment.update(
        {
            "GB_HOST": parts["host"],
            "GB_PORT": str(parts["port"]),
            "GB_USER": parts["user"],
            "GB_PASSWORD": parts["password"],
            "GB_DATABASE": parts["database"],
        }
    )
    try:
        result = subprocess.run(
            [str(venv_python()), "-c", DB_CHECK_CODE],
            env=environment,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.returncode
    except (OSError, subprocess.SubprocessError):
        return 4


def valid_app_password(password: str) -> bool:
    return bool(PASSWORD_PATTERN.fullmatch(password))


def generate_app_password() -> str:
    return secrets.token_urlsafe(15)


def write_env(app_password: str, user: str | None = None) -> bool:
    account = user or DB_USER
    existing = read_env_file()
    secret_key = existing.get("SECRET_KEY", "")
    if not secret_key or "change-this" in secret_key:
        secret_key = secrets.token_urlsafe(48)
    encoded_password = quote(app_password, safe="")
    url = f"mysql+pymysql://{account}:{encoded_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    content = (
        "# Written by dev.py.\n"
        f"# The app connects to MySQL as '{account}' ({DB_NAME} database).\n"
        "# SECRET_KEY signs the login tokens. Keep this file private.\n"
        f"DATABASE_URL={url}\n"
        f"SECRET_KEY={secret_key}\n"
    )
    try:
        ENV_FILE.write_text(content, encoding="utf-8")
        log_line(f"Wrote {relative(ENV_FILE)}")
        return True
    except OSError as exc:
        log_line(f"Could not write {relative(ENV_FILE)}: {exc}")
        return False


def write_frontend_env() -> bool:
    if FRONTEND_ENV_FILE.exists():
        return False
    content = f"VITE_API_BASE_URL=http://127.0.0.1:{BACKEND_PORT}/api\n"
    try:
        FRONTEND_ENV_FILE.write_text(content, encoding="utf-8")
        log_line(f"Wrote {relative(FRONTEND_ENV_FILE)}")
        return True
    except OSError as exc:
        log_line(f"Could not write {relative(FRONTEND_ENV_FILE)}: {exc}")
        return False


def node_version() -> str | None:
    node = shutil.which("node")
    if not node:
        return None
    try:
        result = subprocess.run([node, "--version"], capture_output=True, text=True, timeout=10)
        return result.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None


def npm_version() -> str | None:
    npm = shutil.which("npm")
    if not npm:
        return None
    try:
        if os.name == "nt":
            result = subprocess.run(["cmd", "/c", npm, "--version"], capture_output=True, text=True, timeout=20)
        else:
            result = subprocess.run([npm, "--version"], capture_output=True, text=True, timeout=20)
        return result.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None


def show_status() -> None:
    print("")
    print("  Status")
    database_check = database_check_code()
    if database_check == 0:
        database_detail, database_state = f"{env_database_name()} ready", "ok"
    elif database_check == 5:
        database_detail, database_state = f"{env_database_name()} needs schema migration", "missing"
    else:
        database_detail, database_state = f"{env_database_name()} not ready", "missing"
    checks = [
        ("Python", f"{platform.python_version()} ({platform.system()})", "ok"),
        ("Node.js", node_version() or "not found", "ok" if node_version() else "missing"),
        ("npm", npm_version() or "not found", "ok" if npm_version() else "missing"),
        ("MySQL", f"{DB_HOST}:{DB_PORT}" if port_in_use(DB_PORT, DB_HOST) else "not running", "ok" if port_in_use(DB_PORT, DB_HOST) else "missing"),
        ("Virtual env", relative(VENV) if venv_exists() else "not created", "ok" if venv_exists() else "missing"),
        ("Python packages", "installed" if packages_installed() else "not installed", "ok" if packages_installed() else "missing"),
        ("backend/.env", "written" if env_written() else "not written", "ok" if env_written() else "missing"),
        ("MySQL database", database_detail, database_state),
        ("Frontend packages", "installed" if node_modules_ready() else "not installed", "ok" if node_modules_ready() else "missing"),
    ]
    for name, detail, state in checks:
        mark = "ok" if state == "ok" else "missing"
        print(f"    {name:<22} {detail:<38} {mark}")
    print("")


def stream_command(command: list[str], prefix: str = "", cwd: Path | None = None, env: dict | None = None) -> bool:
    try:
        process = subprocess.Popen(
            command,
            cwd=str(cwd) if cwd else None,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
    except OSError as exc:
        log_line(f"{prefix} could not start: {exc}")
        return False
    try:
        for line in process.stdout:
            line = line.rstrip()
            log_line(f"{prefix} {line}" if prefix else line)
    finally:
        try:
            process.stdout.close()
        except Exception:
            pass
    return process.wait() == 0


def create_venv() -> bool:
    log_line(f"Creating virtual environment at {relative(VENV)} ...")
    result = subprocess.run([sys.executable, "-m", "venv", str(VENV)], capture_output=True, text=True)
    if result.returncode != 0:
        log_line(result.stdout.strip())
        log_line(result.stderr.strip())
        log_line("Failed to create virtual environment.")
        return False
    log_line("Virtual environment created.")
    return True


def npm_command(*arguments: str) -> list[str]:
    npm = shutil.which("npm")
    if npm is None:
        raise FileNotFoundError("npm not found")
    if os.name == "nt":
        return ["cmd", "/c", npm, *arguments]
    return [npm, *arguments]


def install_packages(force: bool = False) -> bool:
    if not venv_exists():
        log_line("Create the virtual environment first.")
        return False
    arguments = ["-m", "pip", "install", "--disable-pip-version-check"]
    if force:
        arguments.append("--force-reinstall")
    arguments += ["-r", str(BACKEND_REQUIREMENTS)]
    log_line(f"Installing from {relative(BACKEND_REQUIREMENTS)} ...")
    ok = stream_command([str(venv_python()), *arguments], "pip")
    if ok:
        log_line("Backend packages installed.")
    return ok


def ensure_packages() -> bool:
    """Make sure backend/venv holds everything the backend needs.

    pymysql lives only in there, so a virtual environment that is missing it
    breaks the database setup and the backend. A half-installed environment
    is repaired too: pip trusts the leftover metadata and would otherwise
    report every requirement as already satisfied.
    """
    if not venv_exists():
        log_line("No virtual environment. Run option 2 first.")
        return False
    if packages_installed():
        return True
    if not install_packages():
        return False
    if packages_installed():
        return True
    log_line("Some packages are still missing. Reinstalling them ...")
    if not install_packages(force=True):
        return False
    return packages_installed()


def npm_install() -> bool:
    if not shutil.which("npm"):
        log_line("npm not found on PATH. Install Node.js first.")
        return False
    log_line("Installing frontend packages ...")
    ok = stream_command(npm_command("install"), "npm", cwd=FRONTEND)
    if ok:
        log_line("Frontend packages installed.")
    return ok


def run_role_script(script: str, verb: str, label: str) -> bool:
    if not venv_exists() or not packages_installed():
        log_line("Set up the virtual environment and packages first.")
        return False
    if not env_written() or not database_ready():
        log_line("Set up the database first (option 4).")
        return False
    log_line(f"{verb.capitalize()} {label} account ...")
    try:
        result = subprocess.run([str(venv_python()), script], cwd=str(BACKEND))
    except OSError as exc:
        log_line(f"Could not start {label} {verb}: {exc}")
        return False
    if result.returncode != 0:
        log_line(f"Could not {verb} the {label} account.")
        return False
    return True


def create_teller_account() -> bool:
    return run_role_script("create_teller.py", "create", "teller")


def remove_teller_account() -> bool:
    return run_role_script("delete_teller.py", "remove", "teller")


def create_admin_account() -> bool:
    return run_role_script("create_admin.py", "create", "admin")


def remove_admin_account() -> bool:
    return run_role_script("delete_admin.py", "remove", "admin")


def run_project_script(script: Path, *arguments: str) -> bool:
    if not script.exists():
        log_line(f"{relative(script)} is missing.")
        return False
    if not shutil.which("bash"):
        log_line("bash not found. Database backup and restore require bash.")
        return False
    try:
        result = subprocess.run(["bash", str(script), *arguments], cwd=str(ROOT))
    except OSError as exc:
        log_line(f"Could not run {relative(script)}: {exc}")
        return False
    if result.returncode != 0:
        log_line(f"{relative(script)} exited with code {result.returncode}.")
        return False
    return True


def backup_files() -> list[Path]:
    if not BACKUP_DIR.is_dir():
        return []
    return sorted(
        BACKUP_DIR.glob("*.sql"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )


def backup_database() -> bool:
    log_line("Backing up the database ...")
    return run_project_script(BACKUP_SCRIPT)


def restore_database(filename: str | None = None) -> bool:
    backups = backup_files()
    if not backups:
        log_line(f"No backups found in {relative(BACKUP_DIR)}. Run a backup first.")
        return False
    if filename is None:
        print("  Available backups:")
        for path in backups[:10]:
            print(f"    {relative(path)}")
        try:
            answer = input(f"  Backup to restore [{backups[0].name}]: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("")
            return False
        filename = answer or backups[0].name
    path = Path(filename)
    if not path.is_absolute() and not path.exists():
        path = BACKUP_DIR / path
    if not path.is_file():
        log_line(f"Backup file not found: {filename}")
        return False
    log_line(f"Restoring {relative(path)} ...")
    return run_project_script(RESTORE_SCRIPT, str(path))


def split_sql_statements(script: str) -> list[str]:
    statements: list[str] = []
    buffer: list[str] = []
    in_single = in_double = in_backtick = False
    in_line_comment = in_block_comment = False
    index = 0
    length = len(script)
    while index < length:
        char = script[index]
        following = script[index + 1] if index + 1 < length else ""
        if in_line_comment:
            if char == "\n":
                in_line_comment = False
            index += 1
            continue
        if in_block_comment:
            if char == "*" and following == "/":
                in_block_comment = False
                index += 2
                continue
            index += 1
            continue
        if not in_single and not in_double and not in_backtick:
            if char == "-" and following == "-":
                in_line_comment = True
                index += 2
                continue
            if char == "/" and following == "*":
                in_block_comment = True
                index += 2
                continue
        if char == "'" and not in_double and not in_backtick:
            in_single = not in_single
        elif char == '"' and not in_single and not in_backtick:
            in_double = not in_double
        elif char == "`" and not in_single and not in_double:
            in_backtick = not in_backtick
        if char == ";" and not in_single and not in_double and not in_backtick:
            statement = "".join(buffer).strip()
            if statement:
                statements.append(statement)
            buffer = []
            index += 1
            continue
        buffer.append(char)
        index += 1
    tail = "".join(buffer).strip()
    if tail:
        statements.append(tail)
    return statements


def quote_sql(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"


def db_connect(host: str, port: int, user: str, password: str, database: str | None = None):
    """Open a MySQL connection. Returns (connection, error code, message)."""
    import pymysql

    try:
        connection = pymysql.connect(
            host=host, port=port, user=user, password=password, database=database,
            charset="utf8mb4", connect_timeout=8, autocommit=True,
        )
    except Exception as exc:
        code = exc.args[0] if exc.args and isinstance(exc.args[0], int) else 0
        return None, code, str(exc)
    return connection, 0, ""


def _run_schema(connection) -> bool:
    if not SCHEMA_FILE.exists():
        log_line(f"{relative(SCHEMA_FILE)} is missing.")
        return False
    try:
        script = SCHEMA_FILE.read_text(encoding="utf-8")
    except OSError as exc:
        log_line(f"Could not read {relative(SCHEMA_FILE)}: {exc}")
        return False
    applied = []
    for statement in split_sql_statements(script):
        if re.match(r"^\s*CREATE\s+DATABASE", statement, re.IGNORECASE):
            continue
        if re.match(r"^\s*USE\s+", statement, re.IGNORECASE):
            continue
        applied.append(statement)
    log_line(f"Applying {relative(SCHEMA_FILE)} ({len(applied)} statements) ...")
    try:
        with connection.cursor() as cursor:
            for number, statement in enumerate(applied, start=1):
                try:
                    cursor.execute(statement)
                except Exception as exc:
                    log_line(f"Statement {number} failed: {exc}")
                    log_line("  " + " ".join(statement.split())[:300])
                    return False
    except Exception as exc:
        log_line(f"Could not apply the schema: {exc}")
        return False
    log_line("Schema applied.")
    return True


def _migration_statement_exists(cursor, statement: str) -> bool:
    alter = re.match(
        r"^\s*ALTER\s+TABLE\s+`?(\w+)`?\s+ADD\s+COLUMN\s+`?(\w+)`?",
        statement,
        re.IGNORECASE,
    )
    if alter:
        cursor.execute(
            "SELECT 1 FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s",
            (alter.group(1), alter.group(2)),
        )
        return cursor.fetchone() is not None

    drop_column = re.match(
        r"^\s*ALTER\s+TABLE\s+`?(\w+)`?\s+DROP\s+COLUMN\s+`?(\w+)`?",
        statement,
        re.IGNORECASE,
    )
    if drop_column:
        cursor.execute(
            "SELECT 1 FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s",
            (drop_column.group(1), drop_column.group(2)),
        )
        return cursor.fetchone() is None

    constraint = re.match(
        r"^\s*ALTER\s+TABLE\s+`?(\w+)`?\s+ADD\s+CONSTRAINT\s+`?(\w+)`?",
        statement,
        re.IGNORECASE,
    )
    if constraint:
        cursor.execute(
            "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND CONSTRAINT_NAME = %s",
            (constraint.group(1), constraint.group(2)),
        )
        return cursor.fetchone() is not None

    create_table = re.match(
        r"^\s*CREATE\s+TABLE\s+`?(\w+)`?",
        statement,
        re.IGNORECASE,
    )
    if create_table:
        cursor.execute(
            "SELECT 1 FROM information_schema.TABLES "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s",
            (create_table.group(1),),
        )
        return cursor.fetchone() is not None

    create_index = re.match(
        r"^\s*CREATE\s+INDEX\s+`?(\w+)`?\s+ON\s+`?(\w+)`?",
        statement,
        re.IGNORECASE,
    )
    if create_index:
        cursor.execute(
            "SELECT 1 FROM information_schema.STATISTICS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND INDEX_NAME = %s",
            (create_index.group(2), create_index.group(1)),
        )
        return cursor.fetchone() is not None

    # ENUM changes are only needed when the current type is missing a value.
    # Skipping supersets keeps re-runs from narrowing an enum (006 would drop
    # CARD_LOST) or failing on rows that already use the newer value.
    modify_enum = re.match(
        r"^\s*ALTER\s+TABLE\s+`?(\w+)`?\s+MODIFY\s+(?:COLUMN\s+)?`?(\w+)`?\s+"
        r"ENUM\s*\((.*?)\)",
        statement,
        re.IGNORECASE | re.DOTALL,
    )
    if modify_enum:
        table, column, values = modify_enum.groups()
        wanted = {
            value.strip().strip("'\"").upper() for value in values.split(",")
        }
        cursor.execute(
            "SELECT COLUMN_TYPE FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s",
            (table, column),
        )
        row = cursor.fetchone()
        if row is None:
            return False
        current = {value.upper() for value in re.findall(r"'([^']*)'", row[0])}
        return wanted.issubset(current)
    return False


def _ensure_migration_ledger(cursor) -> None:
    cursor.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations ("
        "filename VARCHAR(255) NOT NULL, "
        "statement_index INT NOT NULL, "
        "applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "
        "PRIMARY KEY (filename, statement_index)"
        ") ENGINE=InnoDB"
    )


def _run_schema_migrations(connection) -> bool:
    applied = 0
    with connection.cursor() as cursor:
        _ensure_migration_ledger(cursor)
        cursor.execute("SELECT filename, statement_index FROM schema_migrations")
        recorded = set(cursor.fetchall())
        for migration_file in (
            ADMIN_MIGRATION_FILE,
            BENEFICIARIES_MIGRATION_FILE,
            LEGACY_COLUMNS_MIGRATION_FILE,
            CONSENT_MIGRATION_FILE,
            TX_REQUESTS_MIGRATION_FILE,
            CARD_NOTIFICATIONS_MIGRATION_FILE,
            EMAIL_VERIFICATION_MIGRATION_FILE,
            CONSENT_VERSIONS_MIGRATION_FILE,
            DROP_AI_INSIGHTS_MIGRATION_FILE,
            CARD_LOST_MIGRATION_FILE,
            CUSTOMER_AVATAR_MIGRATION_FILE,
            ADMIN_MANAGEMENT_MIGRATION_FILE,
            CUSTOMER_PROFILE_MIGRATION_FILE,
        ):
            if not migration_file.exists():
                log_line(f"{relative(migration_file)} is missing.")
                return False
            try:
                script = migration_file.read_text(encoding="utf-8")
            except OSError as exc:
                log_line(f"Could not read {relative(migration_file)}: {exc}")
                return False
            statements = [
                statement
                for statement in split_sql_statements(script)
                if not re.match(r"^\s*USE\s+", statement, re.IGNORECASE)
            ]
            log_line(f"Checking {relative(migration_file)} ...")
            for number, statement in enumerate(statements, start=1):
                key = (migration_file.name, number)
                if key in recorded:
                    continue
                # Statements applied before the ledger existed are detected from the
                # schema and recorded without being executed again.
                if not _migration_statement_exists(cursor, statement):
                    try:
                        cursor.execute(statement)
                        applied += 1
                    except Exception as exc:
                        log_line(f"Migration statement {number} failed: {exc}")
                        log_line("  " + " ".join(statement.split())[:300])
                        return False
                cursor.execute(
                    "INSERT IGNORE INTO schema_migrations (filename, statement_index) VALUES (%s, %s)",
                    key,
                )
    log_line(f"Schema migrations checked ({applied} statements applied).")
    return True


def _apply_schema_migrations() -> bool:
    url = read_env_file().get("DATABASE_URL")
    if not url:
        log_line("No DATABASE_URL found; configure backend/.env first.")
        return False
    try:
        parts = parse_db_url(url)
    except ValueError as exc:
        log_line(f"Could not read database configuration: {exc}")
        return False
    try:
        import pymysql
        connection = pymysql.connect(
            host=parts["host"],
            port=parts["port"],
            user=parts["user"],
            password=parts["password"],
            database=parts["database"],
            charset="utf8mb4",
            connect_timeout=8,
            autocommit=True,
        )
    except Exception as exc:
        log_line(f"Could not connect to the configured database user: {exc}")
        log_line("Apply backend/db/migrations/001_admin_operations.sql manually.")
        return False
    try:
        return _run_schema_migrations(connection)
    finally:
        connection.close()


def apply_schema_migrations() -> bool:
    if not venv_exists():
        log_line("Create and install the project virtual environment first.")
        return False
    if Path(sys.executable).resolve() == venv_python().resolve():
        return _apply_schema_migrations()

    command = [
        str(venv_python()),
        str(ROOT / "dev.py"),
        "--internal-schema-migration",
    ]
    try:
        result = subprocess.run(
            command,
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=120,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        log_line(f"Could not run schema migrations: {exc}")
        return False
    if result.stdout.strip():
        log_line(result.stdout.strip())
    if result.stderr.strip():
        log_line(result.stderr.strip())
    return result.returncode == 0


def create_database_and_user(payload: dict) -> bool:
    """Create the database and the app account. Needs admin rights."""
    admin_user = payload.get("admin_user", DB_ADMIN_USER)
    admin_password = payload.get("admin_password", "")
    host = payload.get("host", DB_HOST)
    port = int(payload.get("port", DB_PORT))
    database = payload.get("database", DB_NAME)
    user = payload.get("user", DB_USER)
    password = payload.get("password", "")

    log_line(f"Signing in to MySQL as '{admin_user}' ...")
    admin, _, message = db_connect(host, port, admin_user, admin_password)
    if admin is None:
        log_line(f"Could not sign in to MySQL as '{admin_user}': {message}")
        return False
    try:
        patterns = ["localhost"] if host == "localhost" else ["localhost", host]
        is_root = user.lower() == "root"
        with admin.cursor() as cursor:
            log_line(f"Creating database '{database}' ...")
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{database}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
            for pattern in patterns:
                if is_root:
                    log_line(f"Ensuring privileges for '{user}'@'{pattern}' ...")
                else:
                    log_line(f"Creating MySQL user '{user}'@'{pattern}' ...")
                    cursor.execute(
                        f"CREATE USER IF NOT EXISTS '{user}'@'{pattern}' IDENTIFIED BY {quote_sql(password)}"
                    )
                    cursor.execute(f"ALTER USER '{user}'@'{pattern}' IDENTIFIED BY {quote_sql(password)}")
                cursor.execute(f"GRANT ALL PRIVILEGES ON `{database}`.* TO '{user}'@'{pattern}'")
            cursor.execute("FLUSH PRIVILEGES")
        log_line("MySQL account ready.")
        return True
    except Exception as exc:
        log_line(f"MySQL setup failed: {exc}")
        return False
    finally:
        admin.close()


def setup_database_child(payload: dict) -> int:
    """Create the database if needed and apply the schema.

    Runs inside the backend virtual environment.
    """
    try:
        import pymysql  # noqa: F401
    except ImportError:
        log_line("pymysql is not installed in the backend virtual environment.")
        return DB_SETUP_MISSING_PACKAGE

    host = payload.get("host", DB_HOST)
    port = int(payload.get("port", DB_PORT))
    database = payload.get("database", DB_NAME)
    user = payload.get("user", DB_USER)
    password = payload.get("password", "")

    if payload.get("mode") == "admin":
        if not create_database_and_user(payload):
            return DB_SETUP_FAILED

    connection, code, message = db_connect(host, port, user, password, database)
    if connection is None:
        log_line(f"Could not connect to MySQL as '{user}': {message}")
        if user.lower() == "root" and code in (1045, 1698):
            log_line(
                "The root password in backend/.env does not match this MySQL server."
            )
            log_line(
                "Edit backend/.env (or delete it and run setup again) with the real root password."
            )
            return DB_SETUP_FAILED
        if code in ADMIN_ERROR_CODES:
            log_line("The account or the database does not exist yet.")
            return DB_SETUP_NEEDS_ADMIN
        log_line("Check that MySQL is running and that backend/.env holds the right details.")
        return DB_SETUP_FAILED

    try:
        return DB_SETUP_OK if _run_schema(connection) else DB_SETUP_FAILED
    finally:
        connection.close()


def run_db_helper(payload: dict) -> int:
    """Run the database helper under the backend virtual environment.

    pymysql is only installed in backend/venv, so the work has to happen
    there. The payload goes over stdin, which keeps the passwords out of
    the process list.
    """
    if not venv_exists():
        log_line("No virtual environment. Run option 2 first.")
        return DB_SETUP_FAILED
    if not ensure_packages():
        log_line("Could not install the backend packages.")
        return DB_SETUP_FAILED
    command = [str(venv_python()), str(ROOT / "dev.py"), "--internal-db-setup"]
    try:
        result = subprocess.run(
            command,
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=300,
        )
    except subprocess.TimeoutExpired:
        log_line("The database helper took too long and was stopped.")
        return DB_SETUP_FAILED
    except (OSError, subprocess.SubprocessError) as exc:
        log_line(f"Could not run the database helper: {exc}")
        return DB_SETUP_FAILED
    output = (result.stdout or "") + (result.stderr or "")
    for line in output.splitlines():
        if line.strip():
            log_line(line)
    if result.returncode == DB_SETUP_MISSING_PACKAGE:
        log_line("pymysql is missing from backend/venv. Recreate the virtual environment (option 2).")
        return DB_SETUP_FAILED
    return result.returncode


def prompt_password(prompt: str) -> str:
    """Ask for a password, echoing one '*' per character.

    Falls back to a plain line when stdin is not a terminal (a pipe cannot
    be masked).
    """
    try:
        interactive = sys.stdin is not None and sys.stdin.isatty()
    except Exception:
        interactive = False
    if not interactive:
        sys.stdout.write(prompt)
        sys.stdout.flush()
        try:
            line = sys.stdin.readline()  # noqa
            return line.rstrip("\r\n") if line else ""
        except Exception:
            return ""

    sys.stdout.write(prompt)
    sys.stdout.flush()
    characters: list[str] = []

    def erase_last() -> None:
        if characters:
            characters.pop()
            sys.stdout.write("\b \b")
            sys.stdout.flush()

    try:
        if os.name == "nt":
            import msvcrt

            while True:
                character = msvcrt.getwch()
                if character in ("\r", "\n"):
                    break
                if character == "\x03":
                    raise KeyboardInterrupt
                if character == "\x08":
                    erase_last()
                elif character in ("\x00", "\xe0"):
                    msvcrt.getwch()
                else:
                    characters.append(character)
                    sys.stdout.write("*")
                    sys.stdout.flush()
        else:
            import termios
            import tty

            descriptor = sys.stdin.fileno()
            previous = termios.tcgetattr(descriptor)
            try:
                tty.setraw(descriptor)
                while True:
                    character = sys.stdin.read(1)
                    if character in ("\r", "\n"):
                        break
                    if character == "\x03":
                        raise KeyboardInterrupt
                    if character in ("\x7f", "\x08"):
                        erase_last()
                    else:
                        characters.append(character)
                        sys.stdout.write("*")
                        sys.stdout.flush()
            finally:
                termios.tcsetattr(descriptor, termios.TCSADRAIN, previous)
    finally:
        sys.stdout.write("\n")
        sys.stdout.flush()
    return "".join(characters)


def prompt_credentials(default_user: str, current_password: str = "") -> tuple[str, str]:
    """Ask for a MySQL user and a masked password."""
    user = input(f"  MySQL user [{default_user}]: ").strip() or default_user
    while True:
        prompt = f"  Password for '{user}'"
        if current_password and user == default_user:
            prompt += " (Enter keeps current)"
        password = prompt_password(prompt + ": ")
        if not password and current_password and user == default_user:
            return user, current_password
        if valid_app_password(password):
            return user, password
        print(f"Invalid password. {PASSWORD_HINT}")


def setup_database(update_credentials: bool = True) -> bool:
    """Configure backend/.env and make sure the MySQL schema is ready."""
    existing_values = read_env_file()
    existing_parts = None
    if existing_values.get("DATABASE_URL"):
        try:
            existing_parts = parse_db_url(existing_values["DATABASE_URL"])
        except ValueError:
            existing_parts = None

    if existing_parts is not None:
        user = existing_parts["user"]
        app_password = existing_parts.get("password", "")
        if update_credentials:
            print()
            print(f"backend/.env already has MySQL user '{user}'.")
            try:
                answer = input("Update MySQL user/password? [y/n]: ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                print("")
                return False
            if answer in ("y", "yes"):
                user, app_password = prompt_credentials(user, app_password)
                if not write_env(app_password, user=user):
                    return False
    else:
        print()
        user, app_password = prompt_credentials(DB_USER, "")
        if not write_env(app_password, user=user):
            return False
    write_frontend_env()

    parts = dict(existing_parts) if existing_parts else {
        "user": DB_USER, "password": "", "host": DB_HOST,
        "port": DB_PORT, "database": DB_NAME,
    }
    parts["user"] = user
    parts["password"] = app_password
    account = parts["user"]
    database = parts["database"]

    print()
    if database_check_code() == 5:
        apply_schema_migrations()
    if database_ready():
        if not apply_schema_migrations():
            print("Database is ready, but the schema could not be reconciled.")
            return False
        print("Database is ready.")
        return True

    payload = {
        "mode": "app",
        "user": account,
        "password": parts["password"],
        "host": parts["host"],
        "port": parts["port"],
        "database": database,
    }
    print()
    code = run_db_helper(payload)
    if code == DB_SETUP_NEEDS_ADMIN:
        print()
        print("MySQL admin credentials are only needed when the database or the account")
        print(f"'{account}' does not exist yet. They are used once and never saved.")
        print("Press Enter to skip this step and set the database up by hand.")
        admin_user = input(f"  Admin user [{DB_ADMIN_USER}]: ").strip() or DB_ADMIN_USER
        admin_password = prompt_password("  Admin password: ")
        if not admin_password:
            print()
            print("Skipping the admin step. To finish by hand:")
            print("  1. Create the database and the account in MySQL Workbench:")
            print(f"       CREATE DATABASE {database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
            print(f"       CREATE USER '{account}'@'localhost' IDENTIFIED BY '<the password in backend/.env>';")
            print(f"       GRANT ALL PRIVILEGES ON {database}.* TO '{account}'@'localhost';")
            print("       FLUSH PRIVILEGES;")
            print(f"  2. Run {relative(SCHEMA_FILE)} on the new database.")
            print("  3. Run this tool again.")
            return False
        payload.update({"mode": "admin", "admin_user": admin_user, "admin_password": admin_password})
        code = run_db_helper(payload)

    if code != DB_SETUP_OK:
        print("Database setup failed. See the messages above.")
        return False
    if not apply_schema_migrations():
        print("Database setup finished, but the schema could not be reconciled.")
        return False
    return database_ready()


def spawn_options() -> dict:
    if os.name == "nt":
        return {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    return {"start_new_session": True}


def pump_output(process: subprocess.Popen, name: str) -> None:
    def reader():
        try:
            for line in process.stdout:
                log_line(f"[{name}] {line.rstrip()}")
        except Exception:
            pass
        finally:
            try:
                process.stdout.close()
            except Exception:
                pass
    threading.Thread(target=reader, daemon=True).start()


def start_backend() -> subprocess.Popen | None:
    if port_in_use(BACKEND_PORT):
        status, _ = http_get(f"http://127.0.0.1:{BACKEND_PORT}/api/health", 1.5)
        if status == 200:
            log_line(f"Backend already running on http://localhost:{BACKEND_PORT}")
            return None
        log_line(f"Port {BACKEND_PORT} is in use by another process.")
        return None
    if not venv_exists():
        log_line("No virtual environment. Run setup first.")
        return None
    if not ensure_packages():
        log_line("Could not install the backend packages.")
        return None
    env = dict(os.environ)
    env["PYTHONUNBUFFERED"] = "1"
    env["GELLYBANK_BACKEND_PORT"] = str(BACKEND_PORT)
    env.setdefault("SEED_DEMO", "1")
    log_line(f"Starting backend on http://localhost:{BACKEND_PORT} ...")
    try:
        process = subprocess.Popen(
            [str(venv_python()), "app.py"], cwd=str(BACKEND), env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
            encoding="utf-8", errors="replace", bufsize=1, **spawn_options(),
        )
    except OSError as exc:
        log_line(f"Failed to start backend: {exc}")
        return None
    pump_output(process, "backend")
    return process


def start_frontend() -> subprocess.Popen | None:
    if port_in_use(FRONTEND_PORT):
        status, _ = http_get(f"http://localhost:{FRONTEND_PORT}/", 1.5)
        if status == 200:
            log_line(f"Frontend already running on http://localhost:{FRONTEND_PORT}")
            return None
        log_line(f"Port {FRONTEND_PORT} is in use by another process.")
        return None
    if not shutil.which("npm"):
        log_line("npm not found. Install Node.js first.")
        return None
    if not node_modules_ready():
        log_line("Frontend packages not installed. Use option 5.")
        return None
    env = dict(os.environ)
    env["VITE_API_BASE_URL"] = f"http://127.0.0.1:{BACKEND_PORT}/api"
    log_line(f"Starting frontend on http://localhost:{FRONTEND_PORT} ...")
    try:
        process = subprocess.Popen(
            npm_command(
                "run", "dev", "--", "--host", "127.0.0.1",
                "--port", str(FRONTEND_PORT), "--strictPort",
            ),
            cwd=str(FRONTEND), env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace", bufsize=1, **spawn_options(),
        )
    except OSError as exc:
        log_line(f"Failed to start frontend: {exc}")
        return None
    pump_output(process, "frontend")
    return process


def stop_process(process: subprocess.Popen | None) -> None:
    if process is None or process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True)
    else:
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        except Exception:
            try:
                process.terminate()
            except Exception:
                pass
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True)
        else:
            try:
                os.killpg(os.getpgid(process.pid), signal.SIGKILL)
            except Exception:
                pass
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass


def stop_all() -> None:
    for name in ("frontend", "backend"):
        proc = PROCESSES.pop(name, None)
        if proc is not None:
            log_line(f"Stopping {name} ...")
            stop_process(proc)


def wait_for(
    url: str,
    timeout: float = 30.0,
    process: subprocess.Popen | None = None,
) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process is not None and process.poll() is not None:
            return False
        status, _ = http_get(url, 1.0)
        if status != 200 and "127.0.0.1" in url:
            status, _ = http_get(url.replace("127.0.0.1", "localhost"), 1.0)
        if status == 200:
            return True
        time.sleep(0.3)
    return False


def start_all() -> bool:
    if database_ready() and not apply_schema_migrations():
        log_line("Could not reconcile the database schema; not starting.")
        return False
    if PROCESSES.get("backend") is None or PROCESSES["backend"].poll() is not None:
        proc = start_backend()
        if proc is not None:
            PROCESSES["backend"] = proc
    if PROCESSES.get("frontend") is None or PROCESSES["frontend"].poll() is not None:
        proc = start_frontend()
        if proc is not None:
            PROCESSES["frontend"] = proc

    backend_process = PROCESSES.get("backend")
    backend_ready = wait_for(
        f"http://127.0.0.1:{BACKEND_PORT}/api/health",
        timeout=30.0 if backend_process else 1.0,
        process=backend_process,
    )
    frontend_process = PROCESSES.get("frontend")
    frontend_ready = wait_for(
        f"http://127.0.0.1:{FRONTEND_PORT}/",
        timeout=30.0 if frontend_process else 1.0,
        process=frontend_process,
    )

    if backend_ready:
        print(f"  Backend:  http://localhost:{BACKEND_PORT}")
    else:
        log_line("Backend did not become healthy.")
        if backend_process is not None:
            PROCESSES.pop("backend", None)
            stop_process(backend_process)
    if frontend_ready:
        print(f"  Frontend: http://localhost:{FRONTEND_PORT}")
    else:
        log_line("Frontend did not become healthy.")
        if frontend_process is not None:
            PROCESSES.pop("frontend", None)
            stop_process(frontend_process)
    if not (backend_ready and frontend_ready):
        log_line("Startup incomplete; any healthy server remains running.")
    print("")
    return backend_ready and frontend_ready


def do_setup() -> bool:
    print()
    print("Setting up...")
    if not venv_exists():
        if not create_venv():
            return False
    if not packages_installed():
        if not install_packages():
            return False
    if not env_written():
        print()
        while True:
            app_password = prompt_password(f"Password for MySQL user '{DB_USER}' (8-128 chars): ")
            if valid_app_password(app_password):
                break
            print(f"Invalid password. {PASSWORD_HINT}")
        if not write_env(app_password):
            return False
        write_frontend_env()
    database_check = database_check_code()
    if database_check not in (0, 5):
        if not setup_database(update_credentials=False):
            return False
    elif not apply_schema_migrations():
        return False
    if not database_ready():
        log_line("Database setup finished, but the required schema is still not ready.")
        return False
    if not node_modules_ready():
        if not npm_install():
            return False
    print()
    print("Setup complete.")
    return True


def menu() -> int:
    banner = """
============================================================
  Gellybank - developer tool (terminal)
============================================================
"""
    print(banner)
    while True:
        show_status()
        print("  1) Set up everything (venv, packages, .env, database, npm)")
        print("  2) Create virtual environment")
        print("  3) Install Python packages")
        print("  4) Configure backend/.env + create MySQL database")
        print("  5) Install frontend packages")
        print("  6) Start servers")
        print("  7) Stop servers")
        print("  8) Create teller account")
        print("  9) Remove teller account")
        print(" 10) Create admin account")
        print(" 11) Remove admin account")
        print(" 12) Refresh status")
        print(" 13) Quit")
        print(" 14) Back up database")
        print(" 15) Restore database")
        print("")
        try:
            choice = input("  > ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("")
            stop_all()
            return 0
        if choice in ("q", "13", "quit", "exit"):
            stop_all()
            return 0
        elif choice in ("1", "setup", "all"):
            do_setup()
        elif choice in ("2", "venv"):
            create_venv()
        elif choice in ("3", "pip", "packages"):
            install_packages()
        elif choice in ("4", "env", "db", "database"):
            setup_database()
        elif choice in ("5", "npm"):
            npm_install()
        elif choice in ("6", "start"):
            start_all()
        elif choice in ("7", "stop"):
            stop_all()
        elif choice in ("8", "teller"):
            create_teller_account()
        elif choice in ("9", "remove-teller"):
            remove_teller_account()
        elif choice in ("10", "admin"):
            create_admin_account()
        elif choice in ("11", "remove-admin"):
            remove_admin_account()
        elif choice in ("12", "status", "refresh"):
            pass
        elif choice in ("14", "backup"):
            backup_database()
        elif choice in ("15", "restore"):
            restore_database()
        else:
            print("  Unknown option.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="dev.py", description="Set up and run Gellybank locally.")
    parser.add_argument("--setup", action="store_true", help="set up everything and exit")
    parser.add_argument("--start", action="store_true", help="set up if needed, start servers, then exit")
    parser.add_argument("--version", action="version", version="Gellybank dev tool 1.1.0")
    parser.add_argument("--internal-db-setup", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--internal-schema-migration", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args(argv)

    if args.internal_db_setup:
        try:
            payload = json.loads(sys.stdin.read() or "{}")
        except json.JSONDecodeError:
            log_line("Bad payload")
            return DB_SETUP_FAILED
        try:
            return setup_database_child(payload)
        except Exception as exc:
            log_line(f"The database helper failed: {exc}")
            return DB_SETUP_FAILED

    if args.internal_schema_migration:
        return 0 if _apply_schema_migrations() else 1

    if args.setup:
        return 0 if do_setup() else 1

    if args.start:
        if not (venv_exists() and packages_installed() and env_written() and database_ready() and node_modules_ready()):
            if not do_setup():
                return 1
        startup_ok = start_all()
        if not PROCESSES:
            return 0 if startup_ok else 1
        print("Press Ctrl+C to stop.")
        runtime_ok = True
        try:
            while PROCESSES:
                time.sleep(1)
                for name in list(PROCESSES.keys()):
                    proc = PROCESSES[name]
                    if proc.poll() is not None:
                        log_line(f"[{name}] exited")
                        PROCESSES.pop(name, None)
                        runtime_ok = False
            return 1 if not startup_ok or not runtime_ok else 0
        except KeyboardInterrupt:
            print("")
            stop_all()
            return 0

    # Default: open the menu
    return menu()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        stop_all()
        sys.exit(0)
