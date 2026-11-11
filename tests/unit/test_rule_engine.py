"""
tests/unit/test_rule_engine.py
Unit tests for evaluation_engine/rule_engine.py.
Covers deterministic execution (50 runs), dependency pinning, pass rate gates, and evaluation.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import pytest

from evaluation_engine.rule_engine import (
    EvaluationContext,
    EvaluationResult,
    RuleCategory,
    RuleEngine,
    RuleResult,
)


@pytest.fixture
def rule_engine():
    return RuleEngine()


def test_pinned_dependencies_rule_passes_on_pinned_file(rule_engine):
    result = rule_engine.check_pinned_dependencies()
    assert result.passed is True
    assert result.score == 100.0
    assert result.is_gate is True
    assert "==" in result.findings


def test_test_pass_rate_gate_requires_100_percent(rule_engine):
    # 100% pass rate
    res_pass = rule_engine.check_test_pass_rate({"total_tests": 45, "passed_tests": 45, "failed_tests": 0})
    assert res_pass.passed is True
    assert res_pass.score == 100.0

    # Failing test
    res_fail = rule_engine.check_test_pass_rate({"total_tests": 45, "passed_tests": 44, "failed_tests": 1})
    assert res_fail.passed is False
    assert res_fail.score < 100.0


def test_deterministic_execution_50_consecutive_runs_produce_identical_hashes(rule_engine):
    """Strict acceptance gate: 50 consecutive runs must produce identical SHA-256 state hashes."""
    result = rule_engine.check_deterministic_execution(iterations=50)
    assert result.passed is True
    assert result.score == 100.0
    assert result.details["unique_hash_count"] == 1
    assert len(result.details["hash"]) == 64


def test_error_boundary_protection_gate(rule_engine):
    res_clean = rule_engine.check_error_boundary_protection({"unhandled_500_errors": 0})
    assert res_clean.passed is True

    res_dirty = rule_engine.check_error_boundary_protection({"unhandled_500_errors": 2})
    assert res_dirty.passed is False


def test_full_evaluation_flow_produces_deterministic_state_hash(rule_engine):
    context = EvaluationContext(
        task_id="T-GOV-002",
        tenant_id="tenant_bright_connection",
        candidate_id="Pritesh Patra",
        metrics={
            "total_tests": 50,
            "passed_tests": 50,
            "failed_tests": 0,
            "unhandled_500_errors": 0,
            "routes_with_pydantic": 10,
            "total_routes": 10,
        },
    )

    eval1 = rule_engine.evaluate(context)
    eval2 = rule_engine.evaluate(context)

    assert eval1.overall_score == 100.0
    assert eval1.passed is True
    assert eval1.is_gated_pass is True
    assert eval1.status == "PASSED"
    # State hash must be identical
    assert eval1.state_hash == eval2.state_hash
    assert len(eval1.state_hash) == 64

