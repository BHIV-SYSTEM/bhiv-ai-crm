"""Phase 2 security primitives: RS256 keys, replay claims, and audit proofs."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


class SecurityConfigurationError(RuntimeError):
    """Raised when production security configuration is incomplete."""


def _generate_development_keys() -> tuple[str, str]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode("ascii")
    public_pem = private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("ascii")
    return private_pem, public_pem


_DEV_KEYS: tuple[str, str] | None = None


def load_jwt_keys() -> tuple[str, str]:
    """Load configured RSA keys, using cached ephemeral keys outside production."""
    global _DEV_KEYS
    private_key = os.getenv("JWT_PRIVATE_KEY")
    public_key = os.getenv("JWT_PUBLIC_KEY")
    if private_key and public_key:
        return private_key.replace("\\n", "\n"), public_key.replace("\\n", "\n")
    if os.getenv("ENVIRONMENT", "development").lower() == "production":
        raise SecurityConfigurationError("JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required in production")
    if _DEV_KEYS is None:
        _DEV_KEYS = _generate_development_keys()
    return _DEV_KEYS


class ReplayDetectedError(ValueError):
    """Raised when a request identifier is claimed twice for one token."""


class ReplayMitigationStore:
    """SQLite-backed replay claim table safe for concurrent requests."""

    def __init__(self, database_path: str | Path):
        self.database_path = str(database_path)
        Path(self.database_path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS replay_claims (
                    jti TEXT NOT NULL,
                    request_id TEXT NOT NULL,
                    expires_at REAL NOT NULL,
                    first_seen TEXT NOT NULL,
                    PRIMARY KEY (jti, request_id)
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_replay_claims_expiry ON replay_claims(expires_at)"
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=10)
        connection.row_factory = sqlite3.Row
        return connection

    def claim(self, jti: str, request_id: str, expires_at: float) -> None:
        if not jti or not request_id:
            raise ValueError("jti and request_id are required")
        with self._lock, self._connect() as connection:
            connection.execute("DELETE FROM replay_claims WHERE expires_at <= ?", (datetime.now().timestamp(),))
            try:
                connection.execute(
                    "INSERT INTO replay_claims(jti, request_id, expires_at, first_seen) VALUES (?, ?, ?, ?)",
                    (jti, request_id, expires_at, datetime.now(timezone.utc).isoformat()),
                )
            except sqlite3.IntegrityError as error:
                raise ReplayDetectedError("Duplicate request identifier for token") from error


class ImmutableAuditLog:
    """Append-only SHA-256 hash chain persisted in SQLite."""

    def __init__(self, database_path: str | Path):
        self.database_path = str(database_path)
        Path(self.database_path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_events (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT NOT NULL UNIQUE,
                    event_json TEXT NOT NULL,
                    previous_hash TEXT NOT NULL,
                    event_hash TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL
                )
                """
            )

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.database_path, timeout=10)

    @staticmethod
    def _canonical_event(event: dict[str, Any]) -> str:
        return json.dumps(event, sort_keys=True, separators=(",", ":"), default=str)

    def append(self, event: dict[str, Any]) -> dict[str, Any]:
        record = dict(event)
        record.setdefault("event_id", str(uuid.uuid4()))
        record.setdefault("created_at", datetime.now(timezone.utc).isoformat())
        event_json = self._canonical_event(record)
        with self._lock, self._connect() as connection:
            previous = connection.execute(
                "SELECT event_hash FROM audit_events ORDER BY sequence DESC LIMIT 1"
            ).fetchone()
            previous_hash = previous[0] if previous else "0" * 64
            event_hash = hashlib.sha256(f"{previous_hash}:{event_json}".encode("utf-8")).hexdigest()
            connection.execute(
                "INSERT INTO audit_events(event_id, event_json, previous_hash, event_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                (record["event_id"], event_json, previous_hash, event_hash, record["created_at"]),
            )
        return {**record, "previous_hash": previous_hash, "event_hash": event_hash}

    def verify(self) -> bool:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT event_json, previous_hash, event_hash FROM audit_events ORDER BY sequence"
            ).fetchall()
        previous_hash = "0" * 64
        for event_json, stored_previous, stored_hash in rows:
            expected_hash = hashlib.sha256(f"{previous_hash}:{event_json}".encode("utf-8")).hexdigest()
            if stored_previous != previous_hash or stored_hash != expected_hash:
                return False
            previous_hash = stored_hash
        return True


_DEFAULT_DATA_DIR = Path(os.getenv("SECURITY_DATA_DIR", Path(__file__).parent / "data"))
replay_store = ReplayMitigationStore(_DEFAULT_DATA_DIR / "replay_claims.db")
audit_log = ImmutableAuditLog(_DEFAULT_DATA_DIR / "security_audit.db")

__all__ = [
    "ImmutableAuditLog",
    "ReplayDetectedError",
    "ReplayMitigationStore",
    "SecurityConfigurationError",
    "audit_log",
    "load_jwt_keys",
    "replay_store",
]
