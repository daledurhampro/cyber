from context import (
    SECURITY_RESEARCHER_INSTRUCTIONS,
    enhance_summary,
    get_analysis_prompt,
)


def test_analysis_prompt_includes_path_and_code():
    prompt = get_analysis_prompt("print('hi')", "/tmp/abc123.py")

    assert "PATH: /tmp/abc123.py" in prompt
    assert "print('hi')" in prompt


def test_analysis_prompt_tells_agent_to_use_path_for_semgrep():
    prompt = get_analysis_prompt("x = 1", "/tmp/f.py")

    assert "semgrep_scan" in prompt


def test_enhance_summary_prefixes_character_count():
    assert (
        enhance_summary(42, "Semgrep found 1 issue.")
        == "Analyzed 42 characters of Python code. Semgrep found 1 issue."
    )


def test_enhance_summary_handles_empty_summary():
    assert enhance_summary(0, "") == "Analyzed 0 characters of Python code. "


def test_instructions_pin_semgrep_config_to_auto_and_single_call():
    assert '"auto"' in SECURITY_RESEARCHER_INSTRUCTIONS
    assert "ONLY ONCE" in SECURITY_RESEARCHER_INSTRUCTIONS
