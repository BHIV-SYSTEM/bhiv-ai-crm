from __future__ import annotations

import sqlite3

import jwt
import pytest

from auth_system import ALGORITHM, JWT_PUBLIC_KEY, auth_system
from phase2_security import (
    ImmutableAuditLog,
    ReplayDetectedError,
    ReplayMitigationStore,
)


def test_access_tokens_are_rs256_and_verify_with_public_key():
    token = auth_system.create_access_token(auth_system.users["admin"]["user"])

    header = jwt.get_unverified_header(token)
    payload = jwt.decode(token, JWT_PUBLIC_KEY, algorithms=[ALGORITHM])

    assert header["alg"] == "RS256"
    assert payload["type"] == "access"
    assert payload["jti"]


def test_hs256_token_is_rejected():
    token = jwt.encode({"sub": "admin", "type": "access"}, "not-an-rsa-key", algorithm="HS256")

    with pytest.raises(Exception):
        auth_system.verify_token(token)


def test_replay_claims_reject_duplicate_request(tmp_path):
    store = ReplayMitigationStore(tmp_path / "replay.db")

    store.claim("token-1", "request-1", 4_000_000_000)
    with pytest.raises(ReplayDetectedError):
        store.claim("token-1", "request-1", 4_000_000_000)

    store.claim("token-1", "request-2", 4_000_000_000)


def test_audit_log_detects_database_tampering(tmp_path):
    database_path = tmp_path / "audit.db"
    audit_log = ImmutableAuditLog(database_path)
    audit_log.append({"event_type": "login_succeeded", "subject": "admin"})
    audit_log.append({"event_type": "token_verified", "subject": "admin"})

    assert audit_log.verify() is True
    with sqlite3.connect(database_path) as connection:
        connection.execute("UPDATE audit_events SET event_json = '{}' WHERE sequence = 1")

    assert audit_log.verify() is False
