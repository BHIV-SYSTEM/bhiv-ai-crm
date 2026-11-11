"""
bucket_client.py — BHIV SETU Outbound Client for External Bucket Service (FastAPI / Python)

Provides outward HTTP integration with the standalone bhiv-bucket service,
supporting governance-gated artifact submission, evidence storage, and provenance.
"""

import os
import uuid
import hashlib
import json
from datetime import datetime
from typing import Any, Dict, Optional
import httpx

BUCKET_BASE_URL = os.getenv("BUCKET_BASE_URL", "http://localhost:8002")
BUCKET_API_KEY = os.getenv("BUCKET_API_KEY", "")
BUCKET_TIMEOUT_SECONDS = float(os.getenv("BUCKET_TIMEOUT_SECONDS", "5.0"))
SETU_INTEGRATION_ID = "bhiv-setu-logistics"


class BucketClient:
    """Outbound HTTP client for external bhiv-bucket microservice."""

    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None):
        self.base_url = (base_url or BUCKET_BASE_URL).rstrip("/")
        self.api_key = api_key or BUCKET_API_KEY
        self.timeout = BUCKET_TIMEOUT_SECONDS

    def _headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "x-source": "setu",
        }
        if self.api_key:
            headers["x-api-key"] = self.api_key
        return headers

    async def check_health(self) -> Dict[str, Any]:
        """Check connection to external Bucket service."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.get(f"{self.base_url}/health", headers=self._headers())
                return {"ok": res.status_code == 200, "status_code": res.status_code}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def build_artifact_envelope(
        self,
        artifact_type: str,
        trace_id: str,
        execution_id: str,
        payload: Dict[str, Any],
        tenant_id: str = "tenant_bright_connection"
    ) -> Dict[str, Any]:
        """Construct canonical artifact envelope matching Bucket schema."""
        payload_str = json.dumps(payload, sort_keys=True)
        content_hash = hashlib.sha256(payload_str.encode("utf-8")).hexdigest()
        
        return {
            "envelope_version": "1.0.0",
            "artifact_id": f"art_{uuid.uuid4()}",
            "artifact_type": artifact_type or "evidence_records",
            "trace_id": trace_id,
            "execution_id": execution_id,
            "tenant_id": tenant_id,
            "source_system": "setu",
            "timestamp": datetime.utcnow().isoformat(),
            "content_hash": content_hash,
            "payload": payload,
        }

    async def store_evidence_record(
        self,
        trace_id: str,
        execution_id: str,
        entity_type: str,
        file_reference: str,
        ocr_data: Optional[Dict[str, Any]] = None,
        coordinates: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        tenant_id: str = "tenant_bright_connection"
    ) -> Dict[str, Any]:
        """Store evidence record in external Bucket with fallback."""
        envelope = self.build_artifact_envelope(
            artifact_type="evidence_records",
            trace_id=trace_id,
            execution_id=execution_id,
            payload={
                "entity_type": entity_type,
                "file_reference": file_reference,
                "ocr_data": ocr_data or {},
                "coordinates": coordinates or {},
                "metadata": metadata or {},
            },
            tenant_id=tenant_id
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(
                    f"{self.base_url}/bucket/artifacts/write",
                    headers=self._headers(),
                    json=envelope
                )
                if res.status_code in (200, 201):
                    return {"success": True, "artifact_id": envelope["artifact_id"], "response": res.json()}
                else:
                    return {"success": False, "artifact_id": envelope["artifact_id"], "status_code": res.status_code}
        except Exception as e:
            return {
                "success": False,
                "artifact_id": envelope["artifact_id"],
                "error": str(e),
                "envelope": envelope,
                "offline_queued": True
            }
