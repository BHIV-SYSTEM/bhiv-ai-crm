# CURRENT_RUNTIME_MAPPING.md
# Bright Connection Tally Context & Provenance — Runtime Mapping
# Author: Aman Pal | Date: 2026-08-21

---

## 1. What This Document Is

This is the Phase 1 deliverable for the Bright Connection Tally Provenance task.
It records the exact state of the SETU codebase BEFORE and AFTER Aman's changes.

---

## 2. Current Ingestion Path (before changes)

```
Bright Connection Tally (at 192.168.0.72:9000)
    |
    | [XML fetch — read-only Export Data envelopes]
    v
BrightConnectionConnector  (backend/setu/bright_connection_connector.py)
    | transform_product_catalog()
    | transform_order_payload()
    | transform_field_visit_evidence()
    v
Canonical MDU record  (dict with mdu_type, tenant_id, sku/order_id etc.)
    |
    v
POST /setu/signals/ingest  (routes.py -> signal_ingestion.py)
    | SampadaSignal validated (trace_id, entity_id, event_type, signal_type,
    |                          severity, timestamp, tenant_id, payload)
    v
MongoDB: setu_signal_ingestion collection
    |
    v
GET /setu/signals/{trace_id}  -- caller retrieves ingested signals
```

---

## 3. Existing Context Fields (before changes)

### In BrightConnectionConnector output

| Field          | Present? | Notes                           |
|----------------|----------|---------------------------------|
| mdu_type       | YES      | "product_catalog", "order_record", "field_visit_evidence" |
| tenant_id      | YES      | "tenant_bright_connection" (hardcoded) |
| sku / order_id | YES      | Source record identifier        |
| transformed_at | YES      | Timestamp of transformation     |
| source_system  | NO       | NOT present                     |
| source_context | NO       | NOT present                     |
| store_id       | NO       | NOT present                     |
| source_payload | NO       | NOT present                     |
| normalized_record | NO    | NOT present                     |

### In SampadaSignal (signal_ingestion.py)

| Field          | Present? | Notes                           |
|----------------|----------|---------------------------------|
| trace_id       | YES      | Required                        |
| entity_id      | YES      | Required                        |
| event_type     | YES      | Required                        |
| signal_type    | YES      | Required                        |
| severity       | YES      | Required                        |
| timestamp      | YES      | Required                        |
| tenant_id      | YES      | Required                        |
| payload        | YES      | Optional dict                   |
| source_context | NO       | NOT a field — was only in payload dict if caller included it |

---

## 4. Missing Provenance Fields (before changes)

The following fields from the task's required contract were ABSENT:

```
source_context
    source_system               -- MISSING
    connected_company_id        -- MISSING
    connected_company_name      -- MISSING
    store_id                    -- MISSING
    store_name                  -- MISSING
    location_identifier         -- MISSING
    store_context_available     -- MISSING
    source_entity               -- MISSING
    source_record_id            -- MISSING
    source_timestamp            -- MISSING
    received_at                 -- MISSING
    sync_id                     -- MISSING

source_payload                  -- MISSING
normalized_record               -- MISSING
```

When source_context was absent, no warning was raised — the signal was accepted silently
with no indication that provenance was missing.

---

## 5. Existing Account/Store Isolation Behaviour (before changes)

- Tenant isolation: enforced via `tenant_id` field in MongoDB queries.
- Company isolation: NOT explicitly enforced — the `company` field existed in ARTHA
  (bhiv-artha) but NOT in the SETU connector output or signal ingestion.
- Store isolation: NOT enforced — no store_id or store_name in any record.
- Cross-tenant bleed: the `SovereignRoutingAdapter` rejects unknown tenants at the
  routing layer, but ingested signals had no per-company/per-store scoping.

---

## 6. Files Changed (by Aman)

| File | Change |
|------|--------|
| `backend/setu/bright_connection_connector.py` | Added `_build_source_context()` helper. Added `source_context`, `source_payload`, `normalized_record` to all 3 `transform_*` methods. Added `sync_id` parameter. |
| `backend/setu/signal_ingestion.py` | Added `source_context: Optional[Dict]` to `SampadaSignal` model. Added `REQUIRED_SOURCE_CONTEXT_FIELDS` constant. Added context validation, `context_available` flag, `context_warnings` in ingestion record and API response. |
| `backend/setu/failure_handler.py` | Added `handle_missing_source_context()` method supporting reject/quarantine/incomplete actions. Added Test E to `test_failure_scenarios()`. |
| `backend/setu/test_provenance_local.py` | NEW — local test script (8 tests, no server required). |

Files NOT changed:
- `routes.py` — no change needed; signal ingest route passes data through correctly
- `mongo_store.py` — no change needed; already stores arbitrary dicts
- `sovereign_routing_adapter.py` — no change
- `contract_validation.py` — no change
- Any ARTHA files (bhiv-artha) — no change

---

## 7. Known Limitations

1. **Port 9000 at 192.168.0.72 is blocked by Windows Firewall** — the live Tally gateway
   was discovered but not reachable from the dev machine at time of development.
   Action required: Raj must open inbound TCP 9000 on the Tally machine Windows Firewall.
   Verify with: `node scripts/verify-tally-gateway.js` (from bhiv-artha connector/).

2. **TALLY_STORE_ID and TALLY_STORE_NAME are not yet configured** — the env vars exist
   in `.env.example` but have no values. When blank, `store_context_available` will be
   `false`. This is correct behaviour (explicit, not invented), but store context will
   only appear once Raj provides the actual values.

3. **GST/TDS datasets are stubbed** — the connector cannot yet fetch GST or TDS report
   data from Tally. Do not demonstrate these in the demo.

4. **Mitra integration is presentational** — ARTHA computes dealer summaries; Mitra only
   presents `mitraReadable` text. Mitra does not independently query Tally.
