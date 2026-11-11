# HANDOVER.md
# Bright Connection Tally Provenance — Handover Document
# Author: Aman Pal | Date: 2026-08-21
# Task: Bright Connections Tally Context & Provenance Runtime Integration

---

## 1. What Existed Before This Task

### bhiv-setu / backend/setu/

The SETU module handled signal ingestion, lineage, telemetry, and routing for the
TANTRA ecosystem. It had:

- `bright_connection_connector.py` — translated Bright Connection payloads into MDU
  format, but records had NO source_context, NO store identity, NO provenance.
- `signal_ingestion.py` — validated and stored Sampada signals; `SampadaSignal` model
  had no `source_context` field; missing context was silently accepted.
- `failure_handler.py` — handled trace, contract, and tenant failures, but had no
  handler for records with missing source_context (Test E was unimplemented).

---

## 2. What Aman Changed

### File 1: bright_connection_connector.py

ADDED:
- `_build_source_context()` — a single helper that constructs the canonical
  `source_context` envelope from env vars and per-record fields.
- `source_context` block in all 3 transform methods:
  `transform_product_catalog`, `transform_order_payload`, `transform_field_visit_evidence`
- `source_payload` — preserves the original raw dict from Tally (safe; no secrets)
- `normalized_record` — the canonical fields that downstream systems consume
- `sync_id` parameter on all 3 methods so callers can tag records to a sync batch

UNCHANGED: all existing fields (mdu_type, tenant_id, sku, order_id, etc.)

### File 2: signal_ingestion.py

ADDED:
- `source_context: Optional[Dict[str, Any]] = None` to `SampadaSignal` Pydantic model
- `REQUIRED_SOURCE_CONTEXT_FIELDS` constant listing fields that must exist if
  source_context is provided
- Context validation in `ingest_sampada_signal()`:
  - `context_available` bool (True/False, never guessed)
  - `context_warnings` list (sub-fields missing = explicit warning, not silent drop)
- `source_context`, `source_context_available`, `source_context_warnings` in:
  - The MongoDB ingestion record
  - The API response
- `source_context_available` and `source_context_warnings` in the trace log

UNCHANGED: all existing validation logic for required signal fields

### File 3: failure_handler.py

ADDED:
- `handle_missing_source_context(trace_id, tenant_id, missing_fields, action)`:
  - `action="reject"` → HTTP 400, success=False
  - `action="quarantine"` → HTTP 202, success=True, source_context_available=False
  - `action="incomplete"` → HTTP 202, success=True, marked incomplete
  - Logs failure to MongoDB (append_trace_log)
  - Never invents or guesses missing values
- Test E added to `test_failure_scenarios()` (quarantine scenario)

UNCHANGED: all existing failure handlers

### File 4: setu/test_provenance_local.py (NEW)

8-test local test script. No server, no MongoDB required (uses mocks).

---

## 3. Files Changed

```
d:\Internship Task\bhiv-setu\
  backend\setu\
    bright_connection_connector.py   [MODIFIED]
    signal_ingestion.py              [MODIFIED]
    failure_handler.py               [MODIFIED]
    test_provenance_local.py         [NEW]
  CURRENT_RUNTIME_MAPPING.md        [NEW]
  SOURCE_TO_INSIGHT_FLOW.md         [NEW]
  HANDOVER.md                        [THIS FILE]
```

No files in bhiv-artha were modified.
No routes, database schemas, or unrelated modules were changed.

---

## 4. Current Runtime Flow (after changes)

```
Tally XML (192.168.0.72:9000)
    |
BrightConnectionConnector.transform_*()
    | -> MDU record WITH source_context, source_payload, normalized_record
    |
POST /setu/signals/ingest
    | -> validates source_context sub-fields
    | -> sets source_context_available
    | -> raises context_warnings if fields missing (does NOT invent values)
    |
MongoDB: setu_signal_ingestion
    | -> stored with full provenance envelope
    |
GET /setu/signals/{trace_id}
    | -> returns records with source_context visible
    |
Mitra (via ARTHA dealer summary)
    -> scoped to tenantId + company (no cross-context mixing)
```

---

## 5. Source-Context Contract

Every Bright Connection Tally record emitted by `BrightConnectionConnector` carries:

```json
{
  "source_context": {
    "source_system":           "tally",
    "connected_company_id":    "bc_bright_connection_001",
    "connected_company_name":  "Bright Connection",
    "store_id":                "<from payload or TALLY_STORE_ID env, or null>",
    "store_name":              "<from payload or TALLY_STORE_NAME env, or null>",
    "location_identifier":     "<from payload or TALLY_LOCATION_IDENTIFIER env, or null>",
    "store_context_available": true,
    "source_entity":           "order_record | product_catalog | field_visit_evidence",
    "source_record_id":        "<order_id | sku | visit_id>",
    "source_timestamp":        "<Tally record date, ISO8601, or null>",
    "received_at":             "<UTC timestamp when SETU received the record>",
    "sync_id":                 "<caller-provided batch sync ID, or null>"
  },
  "source_payload":    { "<original raw Tally dict>" },
  "normalized_record": { "<canonical fields only>" }
}
```

Rule: if any of `store_id`, `store_name`, `location_identifier` are unavailable,
they are set to `null` — never to an empty string or invented value.
`store_context_available` is `false` when all three are null.

---

## 6. Known Limitations

| Limitation | Impact | Resolution |
|---|---|---|
| Port 9000 at 192.168.0.72 is blocked by Windows Firewall | Live Tally data cannot be fetched | Raj must open inbound TCP 9000 on Tally machine; verify with `node scripts/verify-tally-gateway.js` |
| TALLY_STORE_ID / TALLY_STORE_NAME not configured | store_context_available = false in all records | Set in `.env` once Raj confirms store details |
| GST / TDS datasets are stubbed | Cannot demo these report types | Pending Raj confirmation of available Tally report envelopes |
| TALLY_COMPANY env var must match exact TallyPrime company name | Mismatch = empty company name in source_context | Auto-detect via `List of Companies` once gateway is reachable |

---

## 7. How to Run the Test / Demo Path

### Local tests (no server needed)
```powershell
cd "d:\Internship Task\bhiv-setu\backend"
python setu/test_provenance_local.py
# Expected: 8/8 tests passed
```

### Start the SETU backend
```powershell
cd "d:\Internship Task\bhiv-setu\backend"
pip install -r requirements.txt
uvicorn api_app:app --host 0.0.0.0 --port 8000 --reload
```

### Demo API call (mock data, no Tally needed)
```
POST http://localhost:8000/setu/signals/ingest
{
  "trace_id": "trace-bright-demo-001",
  "entity_id": "entity-ORD-BC-0821",
  "event_type": "order_synced",
  "signal_type": "execution",
  "severity": "low",
  "timestamp": "2026-08-21T08:30:00Z",
  "tenant_id": "tenant_bright_connection",
  "source_context": {
    "source_system": "tally",
    "connected_company_id": "bc_bright_connection_001",
    "connected_company_name": "Bright Connection",
    "store_id": "store_mumbai_01",
    "store_name": "Mumbai Central Store",
    "source_entity": "order_record",
    "source_record_id": "ORD-BC-0821",
    "source_timestamp": "2026-08-21T08:00:00Z",
    "received_at": "2026-08-21T08:30:00Z",
    "sync_id": "sync_demo_001"
  }
}

GET http://localhost:8000/setu/signals/trace-bright-demo-001
```

### Test failure handler (Test E — missing context)
```
POST http://localhost:8000/setu/test/failures
```
Look for the `missing_source_context` scenario in the response.

---

## 8. What an Incoming Developer Must Know

1. **Three files changed, all in `backend/setu/`** — no routes, no DB schema, no ARTHA.

2. **`_build_source_context()` is the single source of truth** for how provenance is
   constructed. To add a new field to the context envelope, add it there only.

3. **Store context comes from two places** in priority order:
   - The incoming payload (e.g. `raw_order.get("store_id")`)
   - The env var (`TALLY_STORE_ID`)
   - If both are absent: `None` (never invented)

4. **`source_context` in `SampadaSignal` is optional** — signals without it are accepted
   but flagged with `source_context_available: false` and a warning. This is correct
   behaviour per the task spec.

5. **The test script is self-contained** — it mocks MongoDB so you can run it anywhere
   without a database. Run it after any code change to verify nothing broke.

6. **The blocker is the firewall** — all code is ready. The only thing preventing live
   Tally data is port 9000 not being open on the Tally machine at 192.168.0.72.
