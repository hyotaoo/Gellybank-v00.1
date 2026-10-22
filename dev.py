#!/usr/bin/env python3
"""Gellybank developer tool - terminal only.

    python dev.py

Bootstraps the venv, installs dependencies, configures .env, creates the
MySQL database/user/schema, and starts/stops the backend and frontend.
Only requires Python to be pre-installed.
"""

from __future__ import annotations

import argparse
import getpass
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
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = BACKEND / "venv"
ENV_FILE = BACKEND / ".env"
FRONTEND_ENV_FILE = FRONTEND / ".env"
SCHEMA_FILE = BACKEND / "db" / "schema.sql"
BACKEND_REQUIREMENTS = BACKEND / "requirements.txt"

DB_NAME = os.environ.get("GELLYBANK_DB_NAME", "gellybank_db")
DB_USER = os.environ.get("GELLYBANK_DB_USER", "gellyca")
DB_HOST = os.environ.get("GELLYBANK_DB_HOST", "127.0.0.1")
DB_PORT = int(os.environ.get("GELLYBANK_DB_PORT", "3306"))
DB_ADMIN_USER = os.environ.get("GELLYBANK_DB_ADMIN_USER", "root")

BACKEND_PORT = int(os.environ.get("GELLYBANK_BACKEND_PORT", "5000"))
FRONTEND_PORT = int(os.environ.get("GELLYBANK_FRONTEND_PORT", "5173"))

REQUIRED_MODULES = ("flask", "flask_cors", "flask_sqlalchemy", "pymysql", "dotenv")
PASSWORD_PATTERN = re.compile(r"^[A-Za-z0-9._~!+=,-]{8,64}$")
PASSWORD_HINT = "Use letters, digits and . _ ~ ! + = , -"

# Exit codes used by the database helper that runs inside the virtual env.
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
    connection.close()
except Exception:
    sys.exit(4)
sys.exit(0 if {"app_users", "bank_accounts"}.issubset(tables) else 3)
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
        "password": parts["password"],
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
    url = read_env_file().get("DATABASE_URL")
    if not url or not venv_exists():
        return False
    try:
        parts = parse_db_url(url)
    except ValueError:
        return False
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
        return result.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def valid_app_password(password: str) -> bool:
    return bool(PASSWORD_PATTERN.match(password))


def generate_app_password() -> str:
    return secrets.token_urlsafe(15)


def write_env(app_password: str) -> bool:
    secret_key = secrets.token_urlsafe(48)
    url = f"mysql+pymysql://{DB_USER}:{app_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    content = (
        "# Written by dev.py.\n"
        f"# The MySQL account '{DB_USER}' only has access to the {DB_NAME} database.\n"
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
    content = f"VITE_API_BASE_URL=http://localhost:{BACKEND_PORT}/api\n"
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
    checks = [
        ("Python", f"{platform.python_version()} ({platform.system()})", "ok"),
        ("Node.js", node_version() or "not found", "ok" if node_version() else "missing"),
        ("npm", npm_version() or "not found", "ok" if npm_version() else "missing"),
        ("MySQL", f"{DB_HOST}:{DB_PORT}" if port_in_use(DB_PORT, DB_HOST) else "not running", "ok" if port_in_use(DB_PORT, DB_HOST) else "missing"),
        ("Virtual env", relative(VENV) if venv_exists() else "not created", "ok" if venv_exists() else "missing"),
        ("Python packages", "installed" if packages_installed() else "not installed", "ok" if packages_installed() else "missing"),
        ("backend/.env", "written" if env_written() else "not written", "ok" if env_written() else "missing"),
        ("MySQL database", f"{env_database_name()} ready" if database_ready() else f"{env_database_name()} not ready", "ok" if database_ready() else "missing"),
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


# ----------------------------------------------------------------------
# Schema helpers
#
# The functions below only read and parse files, so they work in any
# interpreter. The MySQL helpers further down are only ever called inside
# the backend virtual environment, because pymysql is installed there and
# nowhere else.
# ----------------------------------------------------------------------


def split_table_body(body: str) -> list[str]:
    """Split a CREATE TABLE body on the commas that separate its parts."""
    parts: list[str] = []
    buffer: list[str] = []
    depth = 0
    in_single = in_double = in_backtick = False
    for char in body:
        if char == "'" and not in_double and not in_backtick:
            in_single = not in_single
        elif char == '"' and not in_single and not in_backtick:
            in_double = not in_double
        elif char == "`" and not in_single and not in_double:
            in_backtick = not in_backtick
        if not in_single and not in_double and not in_backtick:
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
            elif char == "," and depth == 0:
                parts.append("".join(buffer))
                buffer = []
                continue
        buffer.append(char)
    parts.append("".join(buffer))
    return parts


def parse_index_definition(part: str) -> dict | None:
    """Read a KEY / UNIQUE / CONSTRAINT part of a table definition."""
    match = re.match(
        r"^(?:CONSTRAINT\s+`?([A-Za-z0-9_]+)`?\s+)?"
        r"(UNIQUE(?:\s+(?:KEY|INDEX))?|KEY|INDEX)\s*"
        r"(?:`?([A-Za-z0-9_]+)`?\s*)?\(([^)]*)\)",
        part,
        re.IGNORECASE,
    )
    if not match:
        return None
    constraint, kind, index_name, columns = match.groups()
    name = index_name or constraint
    if not name:
        return None
    unique = kind.upper().startswith("UNIQUE")
    column_list = " ".join(columns.split())
    keyword = "UNIQUE KEY" if unique else "KEY"
    return {
        "name": name,
        "unique": unique,
        "columns": [column.strip().strip("`") for column in column_list.split(",")],
        "ddl": f"{keyword} `{name}` ({column_list})",
    }


def schema_definitions() -> list[dict]:
    """Describe every table in backend/db/schema.sql.

    Each entry holds the table name, its columns (name plus the DDL that
    defines them) and its indexes, so a database can be brought in line with
    the file without dropping anything that already exists.
    """
    if not SCHEMA_FILE.exists():
        return []
    try:
        script = SCHEMA_FILE.read_text(encoding="utf-8")
    except OSError:
        return []
    definitions: list[dict] = []
    pattern = re.compile(
        r"^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?\s*\((.*)\)"
        r"\s*(?:ENGINE|DEFAULT|CHARSET|COLLATE|AUTO_INCREMENT|ROW_FORMAT|COMMENT|$)",
        re.IGNORECASE | re.DOTALL,
    )
    for statement in split_sql_statements(script):
        match = pattern.match(statement.strip())
        if not match:
            continue
        columns: list[tuple[str, str]] = []
        indexes: list[dict] = []
        for part in split_table_body(match.group(2)):
            part = " ".join(part.split())
            if not part:
                continue
            head = part.split(None, 1)[0].upper()
            if head in ("PRIMARY", "UNIQUE", "KEY", "INDEX", "CONSTRAINT", "FOREIGN", "CHECK"):
                index = parse_index_definition(part)
                if index:
                    indexes.append(index)
                continue
            name, _, ddl = part.partition(" ")
            columns.append((name.strip("`"), ddl.strip()))
            if re.search(r"\bUNIQUE\b", ddl, re.IGNORECASE) and "PRIMARY KEY" not in ddl.upper():
                columns_name = name.strip("`")
                indexes.append({
                    "name": columns_name,
                    "unique": True,
                    "columns": [columns_name],
                    "ddl": f"UNIQUE KEY `{columns_name}` (`{columns_name}`)",
                })
        definitions.append({"name": match.group(1), "columns": columns, "indexes": indexes})
    return definitions


def app_requirements() -> dict[str, set[str]]:
    """Tables and columns that backend/app.py expects the database to have."""
    app_file = BACKEND / "app.py"
    if not app_file.exists():
        return {}
    try:
        text = app_file.read_text(encoding="utf-8")
    except OSError:
        return {}
    requirements: dict[str, set[str]] = {}
    pattern = re.compile(r"^class\s+\w+\(db\.Model\):(.*?)(?=^class\s|\Z)", re.MULTILINE | re.DOTALL)
    for match in pattern.finditer(text):
        body = match.group(1)
        table = re.search(r"__tablename__\s*=\s*[\"']([A-Za-z0-9_]+)[\"']", body)
        if not table:
            continue
        columns = set(re.findall(r"^\s{4}([A-Za-z0-9_]+)\s*=\s*db\.Column", body, re.MULTILINE))
        requirements[table.group(1)] = columns
    return requirements


# ----------------------------------------------------------------------
# MySQL helpers
#
# pymysql only exists inside backend/venv, so every step that talks to
# MySQL runs in a child interpreter started from that virtual environment.
# ----------------------------------------------------------------------


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
        with admin.cursor() as cursor:
            log_line(f"Creating database '{database}' ...")
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{database}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
            for pattern in patterns:
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


def apply_schema(connection) -> bool:
    """Run backend/db/schema.sql. The file is written to be re-runnable."""
    if not SCHEMA_FILE.exists():
        log_line(f"{relative(SCHEMA_FILE)} is missing.")
        return False
    try:
        script = SCHEMA_FILE.read_text(encoding="utf-8")
    except OSError as exc:
        log_line(f"Could not read {relative(SCHEMA_FILE)}: {exc}")
        return False
    statements = [
        statement for statement in split_sql_statements(script)
        if not re.match(r"^\s*(CREATE\s+DATABASE|USE\s+)", statement, re.IGNORECASE)
    ]
    failures = 0
    with connection.cursor() as cursor:
        for number, statement in enumerate(statements, start=1):
            try:
                cursor.execute(statement)
            except Exception as exc:
                failures += 1
                log_line(f"Statement {number} failed: {exc}")
                log_line("  " + " ".join(statement.split())[:300])
    if failures:
        log_line(f"{failures} statement(s) in {relative(SCHEMA_FILE)} failed.")
        return False
    log_line(f"Applied {relative(SCHEMA_FILE)} ({len(statements)} statements).")
    return True


def reconcile_schema(connection) -> tuple[list[str], list[str]]:
    """Add the columns and indexes the schema declares but the database lacks.

    Nothing is dropped or changed, so this is safe to run at any time.
    """
    changes: list[str] = []
    problems: list[str] = []
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"
        )
        tables = {row[0] for row in cursor.fetchall()}
        for definition in schema_definitions():
            name = definition["name"]
            if name not in tables:
                problems.append(f"table '{name}' is missing")
                continue
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND table_name = %s",
                (name,),
            )
            columns = {row[0] for row in cursor.fetchall()}
            for column, ddl in definition["columns"]:
                if column in columns:
                    continue
                try:
                    cursor.execute(f"ALTER TABLE `{name}` ADD COLUMN `{column}` {ddl}")
                except Exception as exc:
                    problems.append(f"could not add column {name}.{column}: {exc}")
                    continue
                columns.add(column)
                changes.append(f"column {name}.{column}")
            cursor.execute(
                "SELECT index_name, column_name FROM information_schema.statistics "
                "WHERE table_schema = DATABASE() AND table_name = %s",
                (name,),
            )
            indexes: dict[str, list[str]] = {}
            for index_name, column_name in cursor.fetchall():
                indexes.setdefault(index_name, []).append(column_name)
            covered = {tuple(entry) for entry in indexes.values()}
            for index in definition["indexes"]:
                if index["name"] in indexes or tuple(index["columns"]) in covered:
                    continue
                try:
                    cursor.execute(f"ALTER TABLE `{name}` ADD {index['ddl']}")
                except Exception as exc:
                    problems.append(f"could not add index {index['name']} on {name}: {exc}")
                    continue
                changes.append(f"index {index['name']} on {name}")
    return changes, problems


def verify_requirements(connection) -> tuple[list[str], list[str]]:
    """Check the database against what backend/app.py needs."""
    requirements = app_requirements()
    missing_tables: list[str] = []
    missing_columns: list[str] = []
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
        )
        tables = {row[0] for row in cursor.fetchall()}
        for table, columns in requirements.items():
            if table not in tables:
                missing_tables.append(table)
                continue
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND table_name = %s",
                (table,),
            )
            live = {row[0] for row in cursor.fetchall()}
            for column in sorted(columns):
                if column not in live:
                    missing_columns.append(f"{table}.{column}")
    return missing_tables, missing_columns


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
        if code in ADMIN_ERROR_CODES:
            log_line("The account or the database does not exist yet.")
            return DB_SETUP_NEEDS_ADMIN
        log_line("Check that MySQL is running and that backend/.env holds the right details.")
        return DB_SETUP_FAILED

    try:
        if not apply_schema(connection):
            return DB_SETUP_FAILED
        changes, problems = reconcile_schema(connection)
        for change in changes:
            log_line(f"Added missing {change}.")
        for problem in problems:
            log_line(f"Warning: {problem}.")
        missing_tables, missing_columns = verify_requirements(connection)
        for table in missing_tables:
            log_line(f"Warning: table '{table}' required by backend/app.py is missing.")
        for column in missing_columns:
            log_line(f"Warning: column '{column}' required by backend/app.py is missing.")
        if missing_tables or missing_columns:
            return DB_SETUP_FAILED
        requirements = app_requirements()
        column_count = sum(len(columns) for columns in requirements.values())
        log_line(
            f"Checked {len(requirements)} tables and {column_count} columns "
            "from backend/app.py: all present."
        )
        log_line(f"Database '{database}' is ready.")
        return DB_SETUP_OK
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
    """Ask for a password without echoing it.

    Falls back to reading a plain line when stdin is not a terminal: on
    Windows getpass reads straight from the console, so it would wait
    forever when the tool is driven from a pipe.
    """
    try:
        interactive = sys.stdin is not None and sys.stdin.isatty()
    except Exception:
        interactive = False
    if interactive:
        return getpass.getpass(prompt)
    sys.stdout.write(prompt)
    sys.stdout.flush()
    try:
        return sys.stdin.readline().rstrip("\r\n")
    except Exception:
        return ""


def setup_database() -> bool:
    if not env_written():
        print()
        while True:
            app_password = prompt_password(f"Password for MySQL user '{DB_USER}' (8-64 chars): ")
            if valid_app_password(app_password):
                break
            print(f"Invalid password. {PASSWORD_HINT}")
        if not write_env(app_password):
            return False
        write_frontend_env()

    values = read_env_file()
    try:
        parts = parse_db_url(values["DATABASE_URL"])
    except Exception:
        parts = {
            "user": DB_USER, "password": "", "host": DB_HOST,
            "port": DB_PORT, "database": DB_NAME,
        }

    payload = {
        "mode": "app",
        "user": parts["user"],
        "password": parts["password"],
        "host": parts["host"],
        "port": parts["port"],
        "database": parts["database"],
    }
    print()
    code = run_db_helper(payload)
    if code == DB_SETUP_OK:
        return True
    if code != DB_SETUP_NEEDS_ADMIN:
        print("Database setup failed. See the messages above.")
        return False

    print()
    print("MySQL admin credentials are only needed when the database or the account")
    print(f"'{parts['user']}' does not exist yet. They are used once and never saved.")
    print("Press Enter to skip this step and set the database up by hand.")
    admin_user = input(f"  Admin user [{DB_ADMIN_USER}]: ").strip() or DB_ADMIN_USER
    admin_password = prompt_password("  Admin password: ")
    if not admin_password:
        print()
        print("Skipping the admin step. To finish by hand:")
        print("  1. Create the database and the account in MySQL Workbench:")
        print(f"       CREATE DATABASE {parts['database']} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        print(f"       CREATE USER '{parts['user']}'@'localhost' IDENTIFIED BY '<the password in backend/.env>';")
        print(f"       GRANT ALL PRIVILEGES ON {parts['database']}.* TO '{parts['user']}'@'localhost';")
        print("       FLUSH PRIVILEGES;")
        print(f"  2. Run {relative(SCHEMA_FILE)} (it is safe to run more than once).")
        print("  3. Run this tool again.")
        return False
    payload.update({"mode": "admin", "admin_user": admin_user, "admin_password": admin_password})
    return run_db_helper(payload) == DB_SETUP_OK


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
        log_line(f"Port {FRONTEND_PORT} is in use by another process.")
        return None
    if not shutil.which("npm"):
        log_line("npm not found. Install Node.js first.")
        return None
    if not node_modules_ready():
        log_line("Frontend packages not installed. Use option 5.")
        return None
    env = dict(os.environ)
    env["VITE_API_BASE_URL"] = f"http://localhost:{BACKEND_PORT}/api"
    log_line(f"Starting frontend on http://localhost:{FRONTEND_PORT} ...")
    try:
        process = subprocess.Popen(
            npm_command("run", "dev", "--", "--port", str(FRONTEND_PORT), "--strictPort"),
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


def wait_for(url: str, timeout: float = 30.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        status, _ = http_get(url, 1.0)
        if status is not None and status < 500:
            return True
        time.sleep(0.3)
    return False


def start_all() -> None:
    if PROCESSES.get("backend") is None or PROCESSES["backend"].poll() is not None:
        proc = start_backend()
        if proc is not None:
            PROCESSES["backend"] = proc
    if PROCESSES.get("frontend") is None or PROCESSES["frontend"].poll() is not None:
        proc = start_frontend()
        if proc is not None:
            PROCESSES["frontend"] = proc
    if PROCESSES.get("backend"):
        wait_for(f"http://127.0.0.1:{BACKEND_PORT}/api/health")
    if PROCESSES.get("frontend"):
        wait_for(f"http://localhost:{FRONTEND_PORT}/")
    if PROCESSES.get("backend"):
        print(f"  Backend:  http://localhost:{BACKEND_PORT}")
    if PROCESSES.get("frontend"):
        print(f"  Frontend: http://localhost:{FRONTEND_PORT}")
    print("")


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
            app_password = prompt_password(f"Password for MySQL user '{DB_USER}' (8-64 chars): ")
            if valid_app_password(app_password):
                break
            print(f"Invalid password. {PASSWORD_HINT}")
        if not write_env(app_password):
            return False
        write_frontend_env()
    if not database_ready():
        if not setup_database():
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
        print("  8) Refresh status")
        print("  9) Quit")
        print("")
        try:
            choice = input("  > ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("")
            stop_all()
            return 0
        if choice in ("q", "9", "quit", "exit"):
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
        elif choice in ("8", "status", "refresh"):
            pass
        else:
            print("  Unknown option.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="dev.py", description="Set up and run Gellybank locally.")
    parser.add_argument("--setup", action="store_true", help="set up everything and exit")
    parser.add_argument("--start", action="store_true", help="set up if needed, start servers, then exit")
    parser.add_argument("--version", action="version", version="Gellybank dev tool 1.1.0")
    parser.add_argument("--internal-db-setup", action="store_true", help=argparse.SUPPRESS)
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

    if args.setup:
        return 0 if do_setup() else 1

    if args.start:
        if not (venv_exists() and packages_installed() and env_written() and database_ready() and node_modules_ready()):
            if not do_setup():
                return 1
        start_all()
        print("Press Ctrl+C to stop.")
        try:
            while True:
                time.sleep(1)
                for name in list(PROCESSES.keys()):
                    proc = PROCESSES[name]
                    if proc.poll() is not None:
                        log_line(f"[{name}] exited")
                        PROCESSES.pop(name, None)
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
