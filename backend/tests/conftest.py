"""Shared test setup.

server.py calls load_dotenv(override=True) at import time, which would pull real
API keys from the project's .env. Tests never talk to OpenAI or Semgrep: every
external call is mocked, tracing is disabled, and each test sets the env vars it
needs explicitly.
"""

import os

os.environ["OPENAI_AGENTS_DISABLE_TRACING"] = "1"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402


@pytest.fixture
def client():
    return TestClient(server.app)


@pytest.fixture
def make_issue():
    def _make(title="Issue", cvss=5.0, severity="medium"):
        return server.SecurityIssue(
            title=title,
            description=f"{title} description",
            code="eval(user_input)",
            fix="Do not use eval",
            cvss_score=cvss,
            severity=severity,
        )

    return _make
