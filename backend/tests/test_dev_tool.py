import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from sqlalchemy.engine import make_url

import dev


class DevToolTests(unittest.TestCase):
    def setUp(self):
        dev.PROCESSES.clear()

    def tearDown(self):
        dev.PROCESSES.clear()

    def test_database_password_is_encoded_and_round_trips(self):
        password = "local%40password"
        with tempfile.TemporaryDirectory() as temporary_directory:
            env_file = Path(temporary_directory) / ".env"
            with patch.object(dev, "ENV_FILE", env_file):
                self.assertTrue(dev.write_env(password))
                database_url = dev.read_env_file()["DATABASE_URL"]

        self.assertIn("local%2540password", database_url)
        self.assertEqual(dev.parse_db_url(database_url)["password"], password)
        self.assertEqual(make_url(database_url).password, password)

    def test_wait_for_requires_success_status_and_detects_exited_process(self):
        with patch.object(dev.time, "monotonic", side_effect=[0.0, 0.1, 0.2]), patch.object(
            dev.time, "sleep"
        ), patch.object(dev, "http_get", side_effect=[(404, ""), (200, "")]):
            self.assertTrue(dev.wait_for("http://localhost/", timeout=1.0))

        process = Mock()
        process.poll.return_value = 1
        with patch.object(dev, "http_get") as http_get:
            self.assertFalse(dev.wait_for("http://localhost/", process=process))
            http_get.assert_not_called()

    def test_frontend_uses_runner_backend_port_and_localhost_address(self):
        process = Mock()
        with patch.object(dev, "port_in_use", return_value=False), patch.object(
            dev.shutil, "which", return_value="/usr/bin/npm"
        ), patch.object(dev, "node_modules_ready", return_value=True), patch.object(
            dev, "npm_command", side_effect=lambda *args: ["npm", *args]
        ), patch.object(dev, "BACKEND_PORT", 5401), patch.object(
            dev.subprocess, "Popen", return_value=process
        ) as popen, patch.object(dev, "pump_output"):
            self.assertIs(dev.start_frontend(), process)

        self.assertEqual(
            popen.call_args.kwargs["env"]["VITE_API_BASE_URL"],
            "http://127.0.0.1:5401/api",
        )
        self.assertIn("--host", popen.call_args.args[0])
        self.assertIn("127.0.0.1", popen.call_args.args[0])

    def test_backend_uses_runner_port(self):
        process = Mock()
        with patch.object(dev, "port_in_use", return_value=False), patch.object(
            dev, "venv_exists", return_value=True
        ), patch.object(dev, "ensure_packages", return_value=True), patch.object(
            dev, "venv_python", return_value=Path("/tmp/venv/python")
        ), patch.object(dev, "BACKEND_PORT", 5402
        ), patch.object(dev.subprocess, "Popen", return_value=process) as popen, patch.object(
            dev, "pump_output"
        ):
            self.assertIs(dev.start_backend(), process)

        self.assertEqual(popen.call_args.kwargs["env"]["GELLYBANK_BACKEND_PORT"], "5402")

    def test_startup_keeps_healthy_server_when_peer_fails(self):
        backend_process = Mock()
        backend_process.poll.return_value = None
        frontend_process = Mock()
        frontend_process.poll.return_value = None
        with patch.object(dev, "start_backend", return_value=backend_process), patch.object(
            dev, "start_frontend", return_value=frontend_process
        ), patch.object(dev, "wait_for", side_effect=[True, False]), patch.object(
            dev, "stop_process"
        ) as stop_process:
            self.assertFalse(dev.start_all())

        self.assertIs(dev.PROCESSES["backend"], backend_process)
        self.assertNotIn("frontend", dev.PROCESSES)
        stop_process.assert_called_once_with(frontend_process)

    def test_migration_skips_existing_database_objects(self):
        cursor = Mock()
        cursor.fetchone.return_value = (1,)

        self.assertTrue(
            dev._migration_statement_exists(
                cursor,
                "ALTER TABLE app_users ADD COLUMN auth_token_version INT NOT NULL",
            )
        )
        cursor.execute.assert_called_once_with(
            "SELECT 1 FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s",
            ("app_users", "auth_token_version"),
        )

    def test_card_lost_migration_supports_card_lost_requests(self):
        schema = dev.SCHEMA_FILE.read_text(encoding="utf-8")
        migration = dev.CARD_LOST_MIGRATION_FILE.read_text(encoding="utf-8")

        self.assertIn("'CARD_LOST'", schema)
        self.assertIn("'CARD_LOST'", migration)

    def test_migration_skips_existing_foreign_key_constraints(self):
        cursor = Mock()
        cursor.fetchone.return_value = (1,)

        self.assertTrue(
            dev._migration_statement_exists(
                cursor,
                "ALTER TABLE account_applications "
                "ADD CONSTRAINT fk_application_created_account "
                "FOREIGN KEY (created_account_id) REFERENCES bank_accounts(account_id)",
            )
        )
        cursor.execute.assert_called_once_with(
            "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND CONSTRAINT_NAME = %s",
            ("account_applications", "fk_application_created_account"),
        )

    def test_migration_uses_project_virtualenv_from_system_python(self):
        completed = Mock(returncode=0, stdout="migration done", stderr="")
        with patch.object(dev, "venv_exists", return_value=True), patch.object(
            dev, "venv_python", return_value=Path("/project/backend/venv/bin/python")
        ), patch.object(dev.sys, "executable", "/usr/bin/python3"), patch.object(
            dev.subprocess, "run", return_value=completed
        ) as run:
            self.assertTrue(dev.apply_schema_migrations())

        self.assertEqual(run.call_args.args[0][-1], "--internal-schema-migration")

    def test_wait_for_falls_back_to_localhost_for_ipv4_url(self):
        with patch.object(dev.time, "monotonic", side_effect=[0.0, 0.1]), patch.object(
            dev, "http_get", side_effect=[(None, "unreachable"), (200, "")]
        ) as get:
            self.assertTrue(
                dev.wait_for("http://127.0.0.1:5173/", timeout=1.0)
            )
        self.assertEqual(
            [call.args[0] for call in get.call_args_list],
            ["http://127.0.0.1:5173/", "http://localhost:5173/"],
        )

    def test_backup_database_runs_backup_script(self):
        with patch.object(dev, "run_project_script", return_value=True) as run:
            self.assertTrue(dev.backup_database())

        run.assert_called_once_with(dev.BACKUP_SCRIPT)

    def test_backup_database_reports_script_failure(self):
        with patch.object(dev, "run_project_script", return_value=False):
            self.assertFalse(dev.backup_database())

    def test_restore_database_defaults_to_latest_backup(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            backup_dir = Path(temporary_directory)
            older = backup_dir / "gellybank_db_20260101_000000.sql"
            newer = backup_dir / "gellybank_db_20260102_000000.sql"
            older.write_text("SELECT 1;\n")
            newer.write_text("SELECT 2;\n")
            os.utime(older, (1000, 1000))
            os.utime(newer, (2000, 2000))
            with patch.object(dev, "BACKUP_DIR", backup_dir), patch.object(
                dev, "run_project_script", return_value=True
            ) as run, patch("builtins.input", return_value=""):
                self.assertTrue(dev.restore_database())

        run.assert_called_once_with(dev.RESTORE_SCRIPT, str(newer))

    def test_restore_database_rejects_unknown_file(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            backup_dir = Path(temporary_directory)
            (backup_dir / "gellybank_db_20260101_000000.sql").write_text("SELECT 1;\n")
            with patch.object(dev, "BACKUP_DIR", backup_dir), patch.object(
                dev, "run_project_script"
            ) as run:
                self.assertFalse(dev.restore_database("missing.sql"))

        run.assert_not_called()

    def test_run_project_script_requires_bash(self):
        with patch.object(dev, "find_bash", return_value=None), patch.object(
            dev.subprocess, "run"
        ) as run:
            self.assertFalse(dev.run_project_script(dev.BACKUP_SCRIPT))

        run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
