# SOURCE_TO_INSIGHT_FLOW.md
# Bright Connection Tally — Source to Insight Flow
# Author: Aman Pal | Date: 2026-08-21

---

## Overview

This document traces the complete runtime path for one Tally-derived record —
from the moment it leaves Tally, through SETU normalization, to a Mitra-readable
insight — with every provenance field visible at each stage.

---

## Complete Chain

```
[1] Tally Source (192.168.0.72:9000)
        |
        |  Read-only XML Export Data envelope
        |  Entity: order_record / party / voucher / product_catalog / field_visit
        v

[2] BrightConnectionConnector  (bright_connection_connector.py)
        |
        |  transform_order_payload(raw, sync_id)
        |  transform_product_catalog(raw, sync_id)
        |  transform_field_visit_evidence(raw, sync_id)
        |
        |  Adds:
        |    source_context.source_system          = "tally"
        |    source_context.connected_company_id   = "bc_bright_connection_001"
        |    source_context.connected_company_name = "Bright Connection"
        |    source_context.store_id               = from payload or env
        |    source_context.store_name             = from payload or env
        |    source_context.store_context_available= True/False (never invented)
        |    source_context.source_entity          = "order_record" etc.
        |    source_context.source_record_id       = order_id / sku / visit_id
        |    source_context.source_timestamp       = Tally record date
        |    source_context.received_at            = UTC now (when SETU received it)
        |    source_context.sync_id                = caller-provided batch ID
        |    source_payload                        = original raw dict from Tally
        |    normalized_record                     = canonical fields only
        v

[3] POST /setu/signals/ingest  (routes.py -> signal_ingestion.py)
        |
        |  Validates: trace_id, entity_id, event_type, signal_type,
        |             severity, timestamp, tenant_id
        |  Validates source_context sub-fields if present
        |  Sets: source_context_available = True/False
        |  Sets: source_context_warnings  = [] or [{warning, action}]
        |
        |  On missing context: marks record, does NOT invent values
        |  On invalid fields: SignalIngestionError -> FailureHandler
        v

[4] MongoDB: setu_signal_ingestion  (mongo_store.py)
        |
        |  Stored fields:
        |    ingestion_id, trace_id, entity_id, event_type, signal_type,
        |    severity, timestamp, tenant_id, payload,
        |    ingested_at, status,
        |    source_context (full envelope or null),
        |    source_context_available (bool),
        |    source_context_warnings (list or null)
        v

[5] GET /setu/signals/{trace_id}  (routes.py)
        |
        |  Returns all ingested signals for a trace, including source_context
        v

[6] Mitra (via ARTHA dealer summary or direct signal)
        |
        |  ARTHA computes: outstanding, last billing, last payment, account status
        |  ARTHA builds:   setuInsight + mitraReadable string
        |  Mitra presents: mitraReadable — it does NOT recompute
        |
        |  All Mitra context is scoped to:
        |    tenantId = "tenant_bright_connection_001"
        |    company  = "Bright Connection"
        |  Cross-tenant mixing is prevented by query filters (not just conventions)
        v

[7] Visible output at demo
        |
        |  One API response contains:
        |    source_context.connected_company_name = "Bright Connection"
        |    source_context.store_name             = "Mumbai Central Store"
        |    source_context.source_entity          = "order_record"
        |    source_context.source_record_id       = "ORD-BC-0821"
        |    source_context.source_timestamp       = "2026-08-21T08:00:00Z"
        |    source_context.received_at            = "2026-08-21T08:30:00Z"
        |    normalized_record                     = {order_id, dealer, items, total}
        |    setuInsight                           = {summary, keySignals, metrics}
        |    mitraReadable                         = "DEALER: Sharma Electricals\n..."
        v

Representatives see: what was received -> where it came from ->
which company/store -> when it arrived -> what SETU understood ->
what Mitra presented.
```

---

## Demo API Call (single endpoint)

### Option A — If Tally is reachable (live data)
```
GET /api/v1/tally-connect/dealer/Sharma Electricals
```
Response includes full chain from Step 2 to Step 7.

### Option B — If Tally is NOT reachable (mock signal)
```
POST /setu/signals/ingest

{
  "trace_id":    "trace-bright-demo-001",
  "entity_id":   "entity-ORD-BC-0821",
  "event_type":  "order_synced",
  "signal_type": "execution",
  "severity":    "low",
  "timestamp":   "2026-08-21T08:30:00Z",
  "tenant_id":   "tenant_bright_connection",
  "source_context": {
    "source_system":          "tally",
    "connected_company_id":   "bc_bright_connection_001",
    "connected_company_name": "Bright Connection",
    "store_id":               "store_mumbai_01",
    "store_name":             "Mumbai Central Store",
    "location_identifier":    "Mumbai, Maharashtra",
    "source_entity":          "order_record",
    "source_record_id":       "ORD-BC-0821",
    "source_timestamp":       "2026-08-21T08:00:00Z",
    "received_at":            "2026-08-21T08:30:00Z",
    "sync_id":                "sync_demo_001"
  },
  "payload": {
    "order_id":    "ORD-BC-0821",
    "dealer_name": "Sharma Electricals",
    "total":       225.0
  }
}
```

Then retrieve:
```
GET /setu/signals/trace-bright-demo-001
```

---

## What Each Field Proves in the Demo

| Field | What it proves |
|---|---|
| `connected_company_name` | Which Tally company this data belongs to |
| `store_name` | Which location/godown the record is from |
| `source_entity` | What type of record arrived (order, voucher, party) |
| `source_record_id` | The exact record in Tally that produced this |
| `source_timestamp` | When the event happened in Tally |
| `received_at` | When SETU received it |
| `sync_id` | Which batch sync run produced this |
| `source_payload` | The original data as received (safe, no secrets) |
| `normalized_record` | What SETU/Mitra actually consumed |
| `source_context_available: false` | Explicit acknowledgment that context is missing — never invented |

---

## Supported Datasets for Demo

| Dataset | Connector Method | Notes |
|---|---|---|
| Orders | `transform_order_payload` | Full provenance |
| Product Catalog | `transform_product_catalog` | Full provenance |
| Field Visits | `transform_field_visit_evidence` | Full provenance |
| Parties / Vouchers | Via ARTHA tallyConnector | Full provenance (in ARTHA) |
| GST / TDS | NOT supported | Stubbed — do not demo |
