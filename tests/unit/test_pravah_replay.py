"""
tests/unit/test_pravah_replay.py
Unit tests for Pravah Replay Ledger & Event Streaming.
Covers cryptographic hash chaining, audit verification, tampering detection, and async streaming.
"""

from __future__ import annotations

import asyncio
import pytest

from task_selector.review_orchestrator import PravahReplayLedger, PravahStreamEvent


@pytest.fixture
def ledger():
    return PravahReplayLedger()


def test_append_event_computes_cryptographic_hash_chain(ledger):
    stream_id = "test_stream_001"
    evt1 = ledger.append_event(stream_id, "TASK_INGESTED", {"task_id": "T1"})
    evt2 = ledger.append_event(stream_id, "TASK_REVIEWED", {"reviewer": "Aman", "score": 90.0})

    assert evt1.sequence == 1
    assert evt1.previous_hash == "0" * 64
    assert len(evt1.event_hash) == 64

    assert evt2.sequence == 2
    assert evt2.previous_hash == evt1.event_hash
    assert len(evt2.event_hash) == 64
    assert evt2.event_hash != evt1.event_hash


def test_verify_ledger_validates_unmodified_stream(ledger):
    stream_id = "clean_stream"
    for i in range(10):
        ledger.append_event(stream_id, f"EVENT_{i}", {"index": i, "val": f"payload_{i}"})

    assert ledger.verify_ledger(stream_id) is True
    assert len(ledger.get_events(stream_id)) == 10


def test_verify_ledger_detects_event_tampering(ledger):
    stream_id = "tamper_stream"
    ledger.append_event(stream_id, "EVT_1", {"data": "authentic_1"})
    ledger.append_event(stream_id, "EVT_2", {"data": "authentic_2"})
    ledger.append_event(stream_id, "EVT_3", {"data": "authentic_3"})

    assert ledger.verify_ledger(stream_id) is True

    # Tamper with an event in the stream
    stream = ledger._streams[stream_id]
    stream[1].payload["data"] = "TAMPERED_MALICIOUS_DATA"

    # Cryptographic verification MUST fail
    assert ledger.verify_ledger(stream_id) is False


@pytest.mark.asyncio
async def test_pravah_asynchronous_event_streaming(ledger):
    stream_id = "async_stream"
    ledger.append_event(stream_id, "INIT", {"status": "started"})

    received_events = []

    async def consume():
        count = 0
        async for event in ledger.stream_events(stream_id):
            received_events.append(event)
            count += 1
            if count == 3:
                break

    consumer_task = asyncio.create_task(consume())
    await asyncio.sleep(0.02)

    ledger.append_event(stream_id, "PROCESSING", {"step": 1})
    ledger.append_event(stream_id, "COMPLETED", {"step": 2})

    await asyncio.wait_for(consumer_task, timeout=2.0)

    assert len(received_events) == 3
    assert received_events[0].event_type == "INIT"
    assert received_events[1].event_type == "PROCESSING"
    assert received_events[2].event_type == "COMPLETED"

