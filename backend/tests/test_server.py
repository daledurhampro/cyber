import asyncio
import os
from contextlib import asynccontextmanager, nullcontext
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server


# --- helpers -----------------------------------------------------------------


def fake_run_result(report):
    return SimpleNamespace(final_output_as=lambda cls: report)


@pytest.fixture
def mocked_pipeline(monkeypatch):
    """Replace the Semgrep MCP server, the agent runner and tracing with fakes.

    Returns a dict that records what the fake Runner was called with, and lets a
    test set the report it returns (or an exception it raises).
    """
    calls = {"report": None, "raise": None}

    @asynccontextmanager
    async def fake_semgrep_server():
        yield "fake-semgrep"

    async def fake_run(agent, input):
        calls["agent"] = agent
        calls["input"] = input
        # Capture the temp file while it still exists.
        path = input.split("PATH: ", 1)[1].splitlines()[0].strip()
        calls["temp_path"] = path
        calls["temp_exists_during_run"] = os.path.exists(path)
        with open(path) as f:
            calls["temp_contents"] = f.read()
        if calls["raise"]:
            raise calls["raise"]
        return fake_run_result(calls["report"])

    monkeypatch.setattr(server, "create_semgrep_server", fake_semgrep_server)
    monkeypatch.setattr(server.Runner, "run", fake_run)
    monkeypatch.setattr(server, "trace", lambda name: nullcontext())
    return calls


# --- validation ----------------------------------------------------------------


@pytest.mark.parametrize("code", ["", "   ", "\n\t  \n"])
def test_validate_request_rejects_blank_code(code):
    with pytest.raises(HTTPException) as exc:
        server.validate_request(server.AnalyzeRequest(code=code))

    assert exc.value.status_code == 400


def test_validate_request_accepts_code():
    server.validate_request(server.AnalyzeRequest(code="x = 1"))


def test_check_api_keys_missing(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with pytest.raises(HTTPException) as exc:
        server.check_api_keys()

    assert exc.value.status_code == 500
    assert "OpenAI API key" in exc.value.detail


def test_check_api_keys_present(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    server.check_api_keys()


# --- agent / formatting ------------------------------------------------------------


def test_create_security_agent_configuration():
    agent = server.create_security_agent("fake-semgrep")

    assert agent.name == "Security Researcher"
    assert agent.model == "gpt-4.1-mini"
    assert agent.mcp_servers == ["fake-semgrep"]
    assert agent.output_type is server.SecurityReport


def test_format_analysis_response_enhances_summary(make_issue):
    issues = [make_issue()]
    report = server.SecurityReport(summary="Found stuff.", issues=issues)

    result = server.format_analysis_response("abcde", report)

    assert result.summary == "Analyzed 5 characters of Python code. Found stuff."
    assert result.issues == issues


# --- run_security_analysis -------------------------------------------------------


def test_run_security_analysis_sorts_issues_by_cvss_desc(mocked_pipeline, make_issue):
    mocked_pipeline["report"] = server.SecurityReport(
        summary="s",
        issues=[
            make_issue("low", 2.1),
            make_issue("critical", 9.8),
            make_issue("medium", 5.0),
        ],
    )

    report = asyncio.run(server.run_security_analysis("eval(x)"))

    assert [i.cvss_score for i in report.issues] == [9.8, 5.0, 2.1]


def test_run_security_analysis_writes_code_to_temp_file_and_cleans_up(mocked_pipeline):
    mocked_pipeline["report"] = server.SecurityReport(summary="s", issues=[])

    asyncio.run(server.run_security_analysis("import os\nos.system(cmd)"))

    assert mocked_pipeline["temp_exists_during_run"]
    assert mocked_pipeline["temp_contents"] == "import os\nos.system(cmd)"
    assert mocked_pipeline["temp_path"].endswith(".py")
    assert not os.path.exists(mocked_pipeline["temp_path"])


def test_run_security_analysis_uses_semgrep_server_for_agent(mocked_pipeline):
    mocked_pipeline["report"] = server.SecurityReport(summary="s", issues=[])

    asyncio.run(server.run_security_analysis("x = 1"))

    assert mocked_pipeline["agent"].mcp_servers == ["fake-semgrep"]
    assert "x = 1" in mocked_pipeline["input"]


def test_run_security_analysis_cleans_up_temp_file_on_error(mocked_pipeline):
    mocked_pipeline["raise"] = RuntimeError("model exploded")

    with pytest.raises(RuntimeError, match="model exploded"):
        asyncio.run(server.run_security_analysis("x = 1"))

    assert not os.path.exists(mocked_pipeline["temp_path"])


# --- HTTP endpoints ------------------------------------------------------------------


def test_health(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"message": "Cybersecurity Analyzer API"}


def test_analyze_rejects_empty_code(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    response = client.post("/api/analyze", json={"code": "   "})

    assert response.status_code == 400
    assert response.json()["detail"] == "No code provided for analysis"


def test_analyze_rejects_missing_body_field(client):
    response = client.post("/api/analyze", json={})

    assert response.status_code == 422


def test_analyze_requires_openai_key(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.post("/api/analyze", json={"code": "x = 1"})

    assert response.status_code == 500
    assert response.json()["detail"] == "OpenAI API key not configured"


def test_analyze_success(client, monkeypatch, mocked_pipeline, make_issue):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    mocked_pipeline["report"] = server.SecurityReport(
        summary="Semgrep found 1 issues, and I identified 1 additional issues.",
        issues=[make_issue("Weak hash", 4.0, "medium"), make_issue("RCE", 9.8, "critical")],
    )

    response = client.post("/api/analyze", json={"code": "eval(input())"})

    assert response.status_code == 200
    body = response.json()
    assert body["summary"].startswith("Analyzed 13 characters of Python code. ")
    assert [i["title"] for i in body["issues"]] == ["RCE", "Weak hash"]
    assert set(body["issues"][0]) == {
        "title", "description", "code", "fix", "cvss_score", "severity",
    }


def test_analyze_wraps_pipeline_errors(client, monkeypatch, mocked_pipeline):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    mocked_pipeline["raise"] = RuntimeError("semgrep timed out")

    response = client.post("/api/analyze", json={"code": "x = 1"})

    assert response.status_code == 500
    assert response.json()["detail"] == "Analysis failed: semgrep timed out"
