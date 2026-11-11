# Bright Connection Integration Surface Mapping for MITRA Attachment

**Author/Target:** Ashwini (Blackhole) / Rudra (Mapping Lead)  
**Tenant ID:** `tenant_bright_connection`  
**Connected Company ID:** `bc_bright_connection_001`  
**Date:** August 25, 2026  
**Objective:** Map Bright Connection’s existing integration surface to attach MITRA through the SETU canonical boundary, maintaining Bright Connection as an independent domain authority without direct point-to-point backend binding or code merging.

---

## 1. Existing Capabilities & Services Invokable via MITRA

Bright Connection integrates with the TANTRA runtime via the `BrightConnectionConnector` ([`bright_connection_connector.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/bright_connection_connector.py)). It fetches read-only XML export envelopes from the Tally gateway and transforms them into Canonical Master Data Units (MDUs):

* **Catalog Synchronization (`transform_product_catalog`)**: Transforms Tally hardware product items into Canonical MDU Catalog format (`mdu_type: "product_catalog"`).
* **Order Processing (`transform_order_payload`)**: Transforms Tally order records into Canonical MDU Order format (`mdu_type: "order_record"`).
* **Field Visit Tracking (`transform_field_visit_evidence`)**: Transforms field visit evidence into Canonical MDU Visit format (`mdu_type: "field_visit_evidence"`).
* **Signal Ingestion Ingress**: Ingests Tally operational events (stock breaches, order sync, billing receipts) into SETU via `SampadaSignal` objects.
* **ARTHA Dealer Summary Integration**: ARTHA reads normalized Bright Connection MDUs, computes outstanding balances, billing history, and payment status, and generates a formatted `mitraReadable` text snippet for MITRA display.

---

## 2. Deployed API & Contract Documentation

* **Core Connector Engine**: [`bright_connection_connector.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/bright_connection_connector.py)
* **Signal Ingestion Module**: [`signal_ingestion.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/signal_ingestion.py)
* **Runtime Mapping Spec**: [`CURRENT_RUNTIME_MAPPING.md`](file:///d:/Internship%20Task/bhiv-setu/CURRENT_RUNTIME_MAPPING.md)
* **Source-to-Insight Data Flow**: [`SOURCE_TO_INSIGHT_FLOW.md`](file:///d:/Internship%20Task/bhiv-setu/SOURCE_TO_INSIGHT_FLOW.md)
* **Provenance Test Suite**: [`test_provenance_local.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/test_provenance_local.py)

---

## 3. Request & Response Schemas

### A. Signal Ingestion Ingress (`POST /setu/signals/ingest`)

**Request Payload**:
```json
{
  "trace_id": "trace-bright-demo-001",
  "entity_id": "entity-ORD-BC-0821",
  "event_type": "order_synced",
  "signal_type": "execution",
  "severity": "low",
  "timestamp": "2026-08-25T08:30:00Z",
  "tenant_id": "tenant_bright_connection",
  "source_context": {
    "source_system": "tally",
    "connected_company_id": "bc_bright_connection_001",
    "connected_company_name": "Bright Connection",
    "store_id": "store_mumbai_01",
    "store_name": "Mumbai Central Store",
    "location_identifier": "Mumbai, Maharashtra",
    "source_entity": "order_record",
    "source_record_id": "ORD-BC-0821",
    "source_timestamp": "2026-08-25T08:00:00Z",
    "received_at": "2026-08-25T08:30:00Z",
    "sync_id": "sync_demo_001"
  },
  "payload": {
    "order_id": "ORD-BC-0821",
    "dealer_name": "Sharma Electricals",
    "total_amount": 225.0,
    "status": "Placed"
  }
}
```

### B. Canonical MDU Record Schema (Connector Output)

```json
{
  "mdu_type": "order_record",
  "tenant_id": "tenant_bright_connection",
  "order_id": "ORD-BC-0821",
  "dealer_id": "dealer_102",
  "dealer_name": "Sharma Electricals",
  "items": [
    {
      "product_id": "TEA-001",
      "name": "Tea Leaves",
      "quantity": 5,
      "unit_price": 45.0,
      "subtotal": 225.0
    }
  ],
  "total_amount": 225.0,
  "status": "Placed",
  "canonical_version": "1.0",
  "transformed_at": "2026-08-25T08:30:00Z",
  "source_context": {
    "source_system": "tally",
    "connected_company_id": "bc_bright_connection_001",
    "connected_company_name": "Bright Connection",
    "store_id": "store_mumbai_01",
    "store_name": "Mumbai Central Store",
    "location_identifier": "Mumbai, Maharashtra",
    "store_context_available": true,
    "source_entity": "order_record",
    "source_record_id": "ORD-BC-0821",
    "source_timestamp": "2026-08-25T08:00:00Z",
    "received_at": "2026-08-25T08:30:00Z",
    "sync_id": "sync_demo_001"
  },
  "source_payload": { ... },
  "normalized_record": {
    "order_id": "ORD-BC-0821",
    "dealer_id": "dealer_102",
    "dealer_name": "Sharma Electricals",
    "total_amount": 225.0,
    "status": "Placed"
  }
}
```

---

## 4. Authentication & Security Boundary

* **Enterprise Tenant ID**: `tenant_bright_connection`
* **Company Identifier**: `bc_bright_connection_001`
* **API Level Authentication**: JWT Bearer Token (`Authorization: Bearer <token>`) validated via [`auth_system.py`](file:///d:/Internship%20Task/bhiv-setu/backend/auth_system.py).
* **Isolation Guarantee**: Strict tenant-scoped query filtering in MongoDB (`tenant_id: "tenant_bright_connection"`). Cross-tenant data bleed between Bright Connection and other tenants is rejected at the middleware level ([`trace_continuity_middleware.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/trace_continuity_middleware.py)).

---

## 5. Health & Failure Behavior

* **Gateway Connection**: Fetches data from Tally Gateway running at `192.168.0.72:9000` via XML HTTP queries.
* **Missing Context Protocol**: When `source_context` is missing or incomplete:
  * Data is **never dropped silently** nor are dummy values invented.
  * SETU records `context_available: false` and flags the record with explicit warnings (`source_context_absent` or `source_context_incomplete`).
* **Validation Errors**: Payload missing required envelope fields triggers HTTP 400 with a structured error payload:
  ```json
  {
    "success": false,
    "error": "missing_required_fields",
    "message": "Signal payload missing required fields",
    "details": { "missing_fields": ["tenant_id"] }
  }
  ```

---

## 6. Runtime, Event & TANTRA Participation

Bright Connection participates natively as a **Data Emitter** in the TANTRA canonical runtime:
1. XML export envelopes are pulled from Tally by `BrightConnectionConnector`.
2. Normalized MDU signals are ingested via `POST /setu/signals/ingest` and saved to `setu_signal_ingestion`.
3. ARTHA queries the ingested MDUs, aggregates dealer analytics, and constructs both structured metrics (`setuInsight`) and text (`mitraReadable`).
4. MITRA queries the canonical boundary to present `mitraReadable` insights directly without performing direct calculation or accessing raw Tally databases.

---

## 7. Trace, Provenance & Replay Expectations

* **Trace Immutability**: `trace_id` is assigned at ingestion and passed unmodified through all downstream processing stages.
* **Audit Provenance**: Every record carries an explicit `source_context` envelope detailing system, company, store, entity, record ID, and timestamps.
* **Replay Safety**: Original Tally payloads are stored under `source_payload` alongside `normalized_record`, allowing deterministic state replay without re-querying the live Tally server.

---

## 8. Technical Ownership & References

* **Technical Lead / Author**: Aman Pal (Bright Connection Tally Provenance Lead)
* **Repository**: [`bhiv-setu`](file:///d:/Internship%20Task/bhiv-setu)
* **Key References**:
  * Connector implementation: [`backend/setu/bright_connection_connector.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/bright_connection_connector.py)
  * Ingestion logic: [`backend/setu/signal_ingestion.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/signal_ingestion.py)
  * Failure handling: [`backend/setu/failure_handler.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/failure_handler.py)
  * Provenance verification suite: [`backend/setu/test_provenance_local.py`](file:///d:/Internship%20Task/bhiv-setu/backend/setu/test_provenance_local.py)
