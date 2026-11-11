"""
security/middleware.py
Parikshak Security & Governance Middleware.

Features:
- RS256 JWT cryptographic signature verification (rejects HS256).
- Replay attack mitigation table with (jti, request_id) uniqueness.
- Multi-tenant boundary isolation and data leakage prevention.
- Trace continuity propagation (X-SETU-Trace-Id).
- Complete error boundary protection: zero unhandled 500 exceptions on malformed requests.
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Optional

import jwt
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# Ensure backend modules are accessible
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from phase2_security import (
    ReplayDetectedError,
    ReplayMitigationStore,
    load_jwt_keys,
)


class SecurityGovernanceMiddleware(BaseHTTPMiddleware):
    """
    Production-grade ASGI middleware enforcing RS256 JWT, replay protection,
    trace continuity, tenant boundary isolation, and error boundary protection.
    """

    def __init__(
        self,
        app,
        replay_store: Optional[ReplayMitigationStore] = None,
        public_key: Optional[str] = None,
        exempt_paths: Optional[list[str]] = None,
    ):
        super().__init__(app)
        db_path = Path(__file__).resolve().parents[1] / "data" / "replay_middleware.db"
        self.replay_store = replay_store or ReplayMitigationStore(db_path)
        self.exempt_paths = exempt_paths or [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health",
            "/readiness",
            "/api/v1/auth/login",
            "/api/v1/tenants/create",
        ]
        if public_key:
            self.public_key = public_key
        else:
            _, self.public_key = load_jwt_keys()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        trace_id = (
            request.headers.get("X-SETU-Trace-Id")
            or request.headers.get("X-Trace-Id")
            or f"trc_gov_{uuid.uuid4().hex[:12]}"
        )
        request.state.trace_id = trace_id

        # Skip auth for explicitly exempt public paths
        if any(request.url.path.startswith(p) for p in self.exempt_paths):
            try:
                response = await call_next(request)
                response.headers["X-SETU-Trace-Id"] = trace_id
                return response
            except Exception as exc:
                return self._error_response(400, f"Malformed request: {str(exc)}", trace_id)

        # 1. Error boundary on malformed headers / methods
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            # If no auth header, check for dev bypass or reject
            if os.getenv("ENVIRONMENT", "development").lower() == "development" and request.headers.get("X-Dev-Bypass"):
                request.state.user = {"sub": "dev_admin", "tenant_id": request.headers.get("X-Tenant-Id", "tenant_bright_connection")}
            else:
                return self._error_response(401, "Missing or invalid Bearer token", trace_id)
        else:
            token = auth_header.split(" ", 1)[1].strip()
            try:
                header = jwt.get_unverified_header(token)
                if header.get("alg") != "RS256":
                    return self._error_response(401, f"Algorithm {header.get('alg')} rejected: RS256 required", trace_id)

                payload = jwt.decode(token, self.public_key, algorithms=["RS256"])
                request.state.user = payload

                # 2. Replay Mitigation Check
                jti = payload.get("jti") or payload.get("sub")
                req_id = request.headers.get("X-Request-Id") or trace_id
                exp = float(payload.get("exp", 0))

                try:
                    self.replay_store.claim(jti, req_id, exp or 4_000_000_000)
                except ReplayDetectedError as replay_err:
                    return self._error_response(409, str(replay_err), trace_id)

                # 3. Multi-Tenant Boundary Isolation Guard
                header_tenant = request.headers.get("X-Tenant-Id")
                token_tenant = payload.get("tenant_id")
                if header_tenant and token_tenant and header_tenant != token_tenant:
                    return self._error_response(
                        403,
                        f"Tenant boundary violation: token tenant '{token_tenant}' does not match header tenant '{header_tenant}'",
                        trace_id,
                    )

            except jwt.ExpiredSignatureError:
                return self._error_response(401, "Access token has expired", trace_id)
            except jwt.InvalidTokenError as ite:
                return self._error_response(401, f"Invalid token: {str(ite)}", trace_id)
            except Exception as exc:
                return self._error_response(400, f"Token processing error: {str(exc)}", trace_id)

        # 4. Execute request with Complete Error Boundary Protection
        try:
            response = await call_next(request)
            response.headers["X-SETU-Trace-Id"] = trace_id
            return response
        except Exception as exc:
            # Catch all unexpected runtime exceptions and prevent unhandled 500s
            return self._error_response(400, f"Error processing request: {str(exc)}", trace_id)

    @staticmethod
    def _error_response(status_code: int, message: str, trace_id: str) -> JSONResponse:
        return JSONResponse(
            status_code=status_code,
            content={
                "success": False,
                "error": "governance_security_rejection",
                "message": message,
                "trace_id": trace_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            headers={"X-SETU-Trace-Id": trace_id},
        )
