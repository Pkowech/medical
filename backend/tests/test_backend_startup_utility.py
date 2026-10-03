"""Opt-in backend startup check migrated from run_dist.js."""

import os
import shutil
import subprocess

import pytest


@pytest.mark.integration
def test_configured_backend_dist_entrypoint_starts():
    if os.getenv("RUN_BACKEND_STARTUP_CHECK") != "1":
        pytest.skip("Set RUN_BACKEND_STARTUP_CHECK=1 to run the compiled-backend startup check")
    if not os.getenv("DATABASE_URL"):
        pytest.skip("DATABASE_URL is required for the backend startup check")

    entrypoint = os.getenv("BACKEND_STARTUP_ENTRYPOINT")
    if not entrypoint:
        pytest.skip("Set BACKEND_STARTUP_ENTRYPOINT to the compiled backend entrypoint")
    node = shutil.which("node")
    if not node:
        pytest.skip("Node.js is required for the compiled-backend startup check")

    try:
        subprocess.run(
            [node, entrypoint],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except subprocess.TimeoutExpired as error:
        # A listening backend is expected to remain alive past the startup window.
        stdout = error.stdout or b""
        stderr = error.stderr or b""
        if isinstance(stdout, str):
            stdout = stdout.encode()
        if isinstance(stderr, str):
            stderr = stderr.encode()
        output = stdout + stderr
        assert b"Synchronous require error" not in output, output.decode(errors="replace")
