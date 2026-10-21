"""Create the Gellybank database and tables from schema.sql.

Usage (with the virtualenv active):
    python init_db.py

It reads DATABASE_URL from backend/.env, creates the database if missing,
then applies every statement in schema.sql. Safe to run more than once.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url

BASE_DIR = Path(__file__).resolve().parent
SCHEMA_FILE = BASE_DIR / "schema.sql"


def main():
    load_dotenv(BASE_DIR / ".env")

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit(
            "DATABASE_URL is not set.\n"
            "Copy backend/.env.example to backend/.env and fill in your MySQL details."
        )

    url = make_url(database_url)
    db_name = url.database
    if not db_name:
        sys.exit("DATABASE_URL must include a database name, e.g. .../gellybank")

    server_engine = create_engine(url.set(database=None))
    try:
        with server_engine.connect() as conn:
            conn.execute(
                text(
                    f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
            )
            conn.commit()
        print(f"Database `{db_name}` is ready.")
    except Exception as exc:  # noqa: BLE001 - depends on the hosting provider's permissions
        print(f"Note: could not create the database automatically ({exc}).")
        print(f"Assuming `{db_name}` already exists.")

    engine = create_engine(database_url)
    statements = [
        part.strip()
        for part in SCHEMA_FILE.read_text().split(";")
        if part.strip() and not all(
            line.strip().startswith("--") for line in part.strip().splitlines()
        )
    ]
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
    print(f"Applied {len(statements)} statements from {SCHEMA_FILE.name}.")

    print("Done. You can now run:  python app.py")


if __name__ == "__main__":
    main()
