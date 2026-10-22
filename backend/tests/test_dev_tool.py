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
            dev, "npm_command", return_value=["npm", "run", "dev"]
        ), patch.object(dev, "BACKEND_PORT", 5401), patch.object(
            dev.subprocess, "Popen", return_value=process
        ) as popen, patch.object(dev, "pump_output"):
            self.assertIs(dev.start_frontend(), process)

        self.assertEqual(
            popen.call_args.kwargs["env"]["VITE_API_BASE_URL"],
            "http://127.0.0.1:5401/api",
        )

    def test_backend_uses_runner_port(self):
        process = Mock()
        with patch.object(dev, "port_in_use", return_value=False), patch.object(
            dev, "venv_exists", return_value=True
        ), patch.object(dev, "venv_python", return_value=Path("/tmp/venv/python")), patch.object(
            dev, "BACKEND_PORT", 5402
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


if __name__ == "__main__":
    unittest.main()
