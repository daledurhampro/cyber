from agents.mcp import MCPServerStdio

import mcp_servers


def test_server_params_run_semgrep_mcp(monkeypatch):
    monkeypatch.setenv("SEMGREP_APP_TOKEN", "tok-123")

    params = mcp_servers.get_semgrep_server_params()

    assert params["command"] == "semgrep"
    assert params["args"] == ["mcp"]
    assert params["env"]["SEMGREP_APP_TOKEN"] == "tok-123"
    assert params["env"]["PYTHONUNBUFFERED"] == "1"


def test_server_params_token_is_none_when_unset(monkeypatch):
    monkeypatch.delenv("SEMGREP_APP_TOKEN", raising=False)

    params = mcp_servers.get_semgrep_server_params()

    assert params["env"]["SEMGREP_APP_TOKEN"] is None


def test_create_semgrep_server_config(monkeypatch):
    monkeypatch.setenv("SEMGREP_APP_TOKEN", "tok-123")

    server = mcp_servers.create_semgrep_server()

    assert isinstance(server, MCPServerStdio)
    assert server.client_session_timeout_seconds == 240
    # Only the semgrep_scan tool should be exposed to the agent.
    assert server.tool_filter == {"allowed_tool_names": ["semgrep_scan"]}
