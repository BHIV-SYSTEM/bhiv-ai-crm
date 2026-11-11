"""
tests/unit/test_review_orchestrator.py
Unit tests for task_selector/review_orchestrator.py.
Covers deterministic state machine transitions, concurrency control (optimistic locking),
and race-condition conflict resolution.
"""

from __future__ import annotations

import concurrent.futures
import pytest

from task_selector.review_orchestrator import (
    ConcurrencyConflictError,
    InvalidStateTransitionError,
    PravahReplayLedger,
    ReviewOrchestrator,
    TaskRecord,
    TaskState,
)


@pytest.fixture
def orchestrator():
    return ReviewOrchestrator(ledger=PravahReplayLedger())


def test_task_registration_starts_in_draft(orchestrator):
    task = orchestrator.register_task("task_001", tenant_id="tenant_bright_connection")
    assert task.task_id == "task_001"
    assert task.state == TaskState.DRAFT
    assert task.version == 1
    assert task.state_hash != ""


def test_valid_deterministic_state_machine_lifecycle(orchestrator):
    task = orchestrator.register_task("task_lifecycle_001")

    # DRAFT -> SUBMITTED
    t1 = orchestrator.transition_state("task_lifecycle_001", TaskState.SUBMITTED, expected_version=1)
    assert t1.state == TaskState.SUBMITTED
    assert t1.version == 2

    # SUBMITTED -> UNDER_REVIEW
    t2 = orchestrator.transition_state("task_lifecycle_001", TaskState.UNDER_REVIEW, expected_version=2)
    assert t2.state == TaskState.UNDER_REVIEW
    assert t2.version == 3

    # UNDER_REVIEW -> EVALUATED
    t3 = orchestrator.transition_state("task_lifecycle_001", TaskState.EVALUATED, expected_version=3, score=95.0)
    assert t3.state == TaskState.EVALUATED
    assert t3.version == 4
    assert t3.score == 95.0

    # EVALUATED -> PASSED
    t4 = orchestrator.transition_state("task_lifecycle_001", TaskState.PASSED, expected_version=4)
    assert t4.state == TaskState.PASSED
    assert t4.version == 5

    # PASSED -> COMMITTED
    t5 = orchestrator.transition_state("task_lifecycle_001", TaskState.COMMITTED, expected_version=5)
    assert t5.state == TaskState.COMMITTED
    assert t5.version == 6
    assert len(t5.history) == 6


def test_illegal_state_transition_is_rejected(orchestrator):
    orchestrator.register_task("task_illegal_001")

    # DRAFT directly to COMMITTED is forbidden
    with pytest.raises(InvalidStateTransitionError):
        orchestrator.transition_state("task_illegal_001", TaskState.COMMITTED, expected_version=1)

    # DRAFT directly to EVALUATED is forbidden
    with pytest.raises(InvalidStateTransitionError):
        orchestrator.transition_state("task_illegal_001", TaskState.EVALUATED, expected_version=1)


def test_terminal_state_cannot_transition_further(orchestrator):
    orchestrator.register_task("task_term_001")
    orchestrator.transition_state("task_term_001", TaskState.SUBMITTED, expected_version=1)
    orchestrator.transition_state("task_term_001", TaskState.UNDER_REVIEW, expected_version=2)
    orchestrator.transition_state("task_term_001", TaskState.EVALUATED, expected_version=3)
    orchestrator.transition_state("task_term_001", TaskState.PASSED, expected_version=4)
    orchestrator.transition_state("task_term_001", TaskState.COMMITTED, expected_version=5)

    with pytest.raises(InvalidStateTransitionError):
        orchestrator.transition_state("task_term_001", TaskState.DRAFT, expected_version=6)


def test_optimistic_locking_concurrency_conflict(orchestrator):
    """Verify that a stale expected_version triggers ConcurrencyConflictError."""
    orchestrator.register_task("task_concurrency_001")

    # Worker 1 transitions from v1 -> v2
    orchestrator.transition_state("task_concurrency_001", TaskState.SUBMITTED, expected_version=1)

    # Worker 2 also attempts to transition with stale expected_version=1
    with pytest.raises(ConcurrencyConflictError) as exc_info:
        orchestrator.transition_state("task_concurrency_001", TaskState.SUBMITTED, expected_version=1)

    assert "Concurrency conflict" in str(exc_info.value)


def test_concurrent_multi_thread_state_transitions(orchestrator):
    """Simulate 10 concurrent threads attempting to update the same task."""
    orchestrator.register_task("task_threaded_001")

    results = {"successes": 0, "conflicts": 0}

    def worker():
        try:
            orchestrator.transition_state(
                "task_threaded_001", TaskState.SUBMITTED, expected_version=1
            )
            results["successes"] += 1
        except ConcurrencyConflictError:
            results["conflicts"] += 1

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(worker) for _ in range(10)]
        concurrent.futures.wait(futures)

    # Exactly 1 thread must succeed; 9 must be rejected due to optimistic lock
    assert results["successes"] == 1
    assert results["conflicts"] == 9

