"""
task_selector/review_orchestrator.py
Parikshak Task Selector & Review Orchestration Engine.

Implements strict concurrency control (optimistic locking), deterministic state machine transitions,
and asynchronous event-driven streaming with Pravah replay ledgers.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import threading
from datetime import datetime, timezone
from enum import Enum
from typing import Any, AsyncGenerator, Dict, List, Optional
from pydantic import BaseModel, Field


class TaskState(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    EVALUATED = "EVALUATED"
    PASSED = "PASSED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    COMMITTED = "COMMITTED"


class ConcurrencyConflictError(RuntimeError):
    """Raised when an optimistic lock version conflict occurs."""


class InvalidStateTransitionError(ValueError):
    """Raised when an illegal state machine transition is attempted."""


class PravahStreamEvent(BaseModel):
    event_id: str
    stream_id: str
    sequence: int
    event_type: str
    payload: Dict[str, Any]
    previous_hash: str
    event_hash: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TaskRecord(BaseModel):
    task_id: str
    tenant_id: str
    assignee: str
    state: TaskState = TaskState.DRAFT
    version: int = 1
    score: Optional[float] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    state_hash: str = ""
    history: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PravahReplayLedger:
    """
    Append-only Pravah replay ledger with deterministic SHA-256 hash chaining.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._streams: Dict[str, List[PravahStreamEvent]] = {}
        self._event_queues: Dict[str, List[asyncio.Queue]] = {}

    @staticmethod
    def canonical_json(data: Any) -> str:
        return json.dumps(data, sort_keys=True, separators=(",", ":"), default=str)

    def append_event(self, stream_id: str, event_type: str, payload: Dict[str, Any]) -> PravahStreamEvent:
        with self._lock:
            stream = self._streams.setdefault(stream_id, [])
            sequence = len(stream) + 1
            previous_hash = stream[-1].event_hash if stream else "0" * 64

            canonical_payload = self.canonical_json(payload)
            hash_input = f"{previous_hash}:{sequence}:{event_type}:{canonical_payload}"
            event_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

            event = PravahStreamEvent(
                event_id=f"evt_{stream_id}_{sequence}",
                stream_id=stream_id,
                sequence=sequence,
                event_type=event_type,
                payload=payload,
                previous_hash=previous_hash,
                event_hash=event_hash,
            )
            stream.append(event)

            # Notify any active async listeners
            queues = self._event_queues.get(stream_id, [])
            for q in queues:
                try:
                    q.put_nowait(event)
                except Exception:
                    pass

            return event

    def get_events(self, stream_id: str) -> List[PravahStreamEvent]:
        with self._lock:
            return list(self._streams.get(stream_id, []))

    def verify_ledger(self, stream_id: str) -> bool:
        """Verify entire cryptographic hash chain for a stream."""
        with self._lock:
            events = self._streams.get(stream_id, [])
            if not events:
                return True

            previous_hash = "0" * 64
            for evt in events:
                if evt.previous_hash != previous_hash:
                    return False
                canonical_payload = self.canonical_json(evt.payload)
                expected_input = f"{previous_hash}:{evt.sequence}:{evt.event_type}:{canonical_payload}"
                expected_hash = hashlib.sha256(expected_input.encode("utf-8")).hexdigest()
                if evt.event_hash != expected_hash:
                    return False
                previous_hash = evt.event_hash

            return True

    async def stream_events(self, stream_id: str) -> AsyncGenerator[PravahStreamEvent, None]:
        """Asynchronous event-driven generator streaming events in real time."""
        q = asyncio.Queue()
        with self._lock:
            existing = list(self._streams.get(stream_id, []))
            self._event_queues.setdefault(stream_id, []).append(q)

        for evt in existing:
            yield evt

        try:
            while True:
                evt = await q.get()
                yield evt
        finally:
            with self._lock:
                queues = self._event_queues.get(stream_id, [])
                if q in queues:
                    queues.remove(q)


class ReviewOrchestrator:
    """
    Deterministic task state machine with strict concurrency control (optimistic locking)
    and Pravah replay ledger audit trail.
    """

    ALLOWED_TRANSITIONS = {
        TaskState.DRAFT: {TaskState.SUBMITTED},
        TaskState.SUBMITTED: {TaskState.UNDER_REVIEW},
        TaskState.UNDER_REVIEW: {TaskState.EVALUATED},
        TaskState.EVALUATED: {TaskState.PASSED, TaskState.PARTIAL, TaskState.FAILED},
        TaskState.PASSED: {TaskState.COMMITTED},
        TaskState.PARTIAL: {TaskState.DRAFT},
        TaskState.FAILED: {TaskState.DRAFT},
        TaskState.COMMITTED: set(),  # Terminal state
    }

    def __init__(self, ledger: Optional[PravahReplayLedger] = None):
        self._tasks: Dict[str, TaskRecord] = {}
        self._lock = threading.Lock()
        self.ledger = ledger or PravahReplayLedger()

    def register_task(
        self,
        task_id: str,
        tenant_id: str = "tenant_bright_connection",
        assignee: str = "Pritesh Patra",
        initial_payload: Optional[Dict[str, Any]] = None,
    ) -> TaskRecord:
        with self._lock:
            if task_id in self._tasks:
                return self._tasks[task_id]

            payload = initial_payload or {}
            canonical = PravahReplayLedger.canonical_json(payload)
            state_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

            record = TaskRecord(
                task_id=task_id,
                tenant_id=tenant_id,
                assignee=assignee,
                state=TaskState.DRAFT,
                version=1,
                payload=payload,
                state_hash=state_hash,
                history=[{
                    "from_state": None,
                    "to_state": TaskState.DRAFT.value,
                    "version": 1,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }],
            )
            self._tasks[task_id] = record

            self.ledger.append_event(
                stream_id=f"task_{task_id}",
                event_type="TASK_REGISTERED",
                payload={"task_id": task_id, "state": TaskState.DRAFT.value, "version": 1},
            )
            return record

    def get_task(self, task_id: str) -> Optional[TaskRecord]:
        with self._lock:
            return self._tasks.get(task_id)

    def transition_state(
        self,
        task_id: str,
        target_state: TaskState,
        expected_version: int,
        details: Optional[Dict[str, Any]] = None,
        score: Optional[float] = None,
    ) -> TaskRecord:
        """
        Transition task to a target state using optimistic concurrency control.
        Raises:
            ConcurrencyConflictError if expected_version != current version.
            InvalidStateTransitionError if transition is not permitted.
        """
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                raise KeyError(f"Task '{task_id}' not found")

            # 1. Optimistic Concurrency Control Check
            if task.version != expected_version:
                raise ConcurrencyConflictError(
                    f"Concurrency conflict on task '{task_id}': expected version {expected_version}, but found {task.version}"
                )

            # 2. Deterministic State Machine Transition Guard
            allowed = self.ALLOWED_TRANSITIONS.get(task.state, set())
            if target_state not in allowed:
                raise InvalidStateTransitionError(
                    f"Illegal state transition for task '{task_id}': cannot transition from {task.state.value} to {target_state.value}"
                )

            prev_state = task.state
            task.state = target_state
            task.version += 1
            if score is not None:
                task.score = score
            task.updated_at = datetime.now(timezone.utc).isoformat()

            if details:
                task.payload.update(details)

            canonical = PravahReplayLedger.canonical_json(task.payload)
            task.state_hash = hashlib.sha256(
                f"{task.state.value}:{task.version}:{canonical}".encode("utf-8")
            ).hexdigest()

            task.history.append({
                "from_state": prev_state.value,
                "to_state": target_state.value,
                "version": task.version,
                "score": task.score,
                "state_hash": task.state_hash,
                "timestamp": task.updated_at,
            })

            # 3. Emit immutable Pravah Replay Ledger event
            self.ledger.append_event(
                stream_id=f"task_{task_id}",
                event_type=f"STATE_TRANSITION_{target_state.value}",
                payload={
                    "task_id": task_id,
                    "from_state": prev_state.value,
                    "to_state": target_state.value,
                    "version": task.version,
                    "score": task.score,
                    "state_hash": task.state_hash,
                    "details": details or {},
                },
            )

            return task
