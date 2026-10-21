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
PASSWORD_PATTERN = re.compile(r"^[A-Za-z0-9._~!#%+=,-]{8,64}$")

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


def install_packages() -> bool:
    if not venv_exists():
        log_line("Create the virtual environment first.")
        return False
    log_line(f"Installing from {relative(BACKEND_REQUIREMENTS)} ...")
    ok = stream_command([str(venv_python()), "-m", "pip", "install", "--disable-pip-version-check", "-r", str(BACKEND_REQUIREMENTS)], "pip")
    if ok:
        log_line("Backend packages installed.")
    return ok


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


def _connect_app(app_password: str):
    import pymysql
    try:
        connection = pymysql.connect(
            host=DB_HOST, port=DB_PORT, user=DB_USER, password=app_password,
            database=DB_NAME, charset="utf8mb4", connect_timeout=8, autocommit=True,
        )
    except Exception as exc:
        return None, str(exc)
    return connection, ""


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


def _setup_database(admin_user: str, admin_password: str, app_password: str) -> bool:
    import pymysql
    log_line(f"Signing in to MySQL as '{admin_user}' ...")
    try:
        admin = pymysql.connect(host=DB_HOST, port=DB_PORT, user=admin_user, password=admin_password, charset="utf8mb4", connect_timeout=8, autocommit=True)
    except Exception as exc:
        log_line(f"Could not sign in to MySQL as '{admin_user}': {exc}")
        log_line("Create the database manually in MySQL Workbench and run backend/db/schema.sql.")
        return False
    try:
        with admin.cursor() as cursor:
            log_line(f"Creating database '{DB_NAME}' ...")
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            log_line(f"Creating MySQL user '{DB_USER}' ...")
            cursor.execute(f"CREATE USER IF NOT EXISTS '{DB_USER}'@'localhost' IDENTIFIED BY {quote_sql(app_password)}")
            cursor.execute(f"ALTER USER '{DB_USER}'@'localhost' IDENTIFIED BY {quote_sql(app_password)}")
            cursor.execute(f"GRANT ALL PRIVILEGES ON `{DB_NAME}`.* TO '{DB_USER}'@'localhost'")
            cursor.execute("FLUSH PRIVILEGES")
        log_line("MySQL account ready.")
        connection, error = _connect_app(app_password)
        if connection is None:
            log_line(f"Couldn't connect as '{DB_USER}'@'localhost': {error}")
            log_line(f"Adding '{DB_USER}'@'{DB_HOST}' ...")
            with admin.cursor() as cursor:
                cursor.execute(f"CREATE USER IF NOT EXISTS '{DB_USER}'@'{DB_HOST}' IDENTIFIED BY {quote_sql(app_password)}")
                cursor.execute(f"ALTER USER '{DB_USER}'@'{DB_HOST}' IDENTIFIED BY {quote_sql(app_password)}")
                cursor.execute(f"GRANT ALL PRIVILEGES ON `{DB_NAME}`.* TO '{DB_USER}'@'{DB_HOST}'")
                cursor.execute("FLUSH PRIVILEGES")
            connection, error = _connect_app(app_password)
            if connection is None:
                log_line(f"Still couldn't connect: {error}")
                return False
        try:
            return _run_schema(connection)
        finally:
            connection.close()
    except Exception as exc:
        log_line(f"MySQL setup failed: {exc}")
        return False
    finally:
        admin.close()


def setup_database() -> bool:
    if not env_written():
        print()
        while True:
            app_password = getpass.getpass(f"Password for MySQL user '{DB_USER}' (8-64 chars): ")
            if valid_app_password(app_password):
                break
            print("Invalid password. Use letters, digits and . _ ~ ! # % + = , -")
        if not write_env(app_password):
            return False
        write_frontend_env()
    else:
        env_data = read_env_file()
        try:
            app_password = parse_db_url(env_data["DATABASE_URL"])["password"]
        except Exception:
            app_password = ""
    print()
    print("MySQL admin credentials (used once, not saved):")
    admin_user = input(f"  Admin user [{DB_ADMIN_USER}]: ").strip() or DB_ADMIN_USER
    admin_password = getpass.getpass("  Admin password: ")
    return _setup_database(admin_user, admin_password, app_password)


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
            app_password = getpass.getpass(f"Password for MySQL user '{DB_USER}' (8-64 chars): ")
            if valid_app_password(app_password):
                break
            print("Invalid password. Use letters, digits and . _ ~ ! # % + = , -")
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
            return 1
        return 0 if _setup_database(payload.get("admin_user", DB_ADMIN_USER), payload.get("admin_password", ""), payload.get("app_password", "")) else 1

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
