"""
test_provenance_local.py
Local test script for the Bright Connection provenance changes.
No running server required -- imports the modules directly.

Run from:  d:\Internship Task\bhiv-setu\backend\
Command:   python setu/test_provenance_local.py
"""

import sys
import os
import json

# Make sure we can import from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from setu.bright_connection_connector import BrightConnectionConnector

PASS = "[PASS]"
FAIL = "[FAIL]"


def sep(title=""):
    print("\n" + "-" * 60)
    if title:
        print("  " + title)
        print("-" * 60)


def check(label, condition, detail=""):
    status = PASS if condition else FAIL
    print("  {}  {}".format(status, label))
    if not condition and detail:
        print("         => " + detail)
    return condition


# TEST 1: Product Catalog
def test_product_catalog():
    sep("TEST 1 -- Product Catalog provenance")

    raw = [
        {
            "sku": "HW-001",
            "name": "Anchor Casing 1M",
            "category": "Wiring",
            "price": 45.0,
            "stock": 200,
            "store_id": "store_mumbai_01",
            "store_name": "Mumbai Central Store",
            "location": "Mumbai, Maharashtra",
            "created_at": "2026-08-20T10:00:00Z",
        }
    ]

    result = BrightConnectionConnector.transform_product_catalog(raw, sync_id="sync_test_001")
    rec = result[0]

    print("\n  source_context fields:")
    ctx = rec.get("source_context", {})
    for k, v in ctx.items():
        print("    {}: {}".format(k, v))

    all_passed = all([
        check("source_context present",                    bool(ctx)),
        check("source_system = tally",                     ctx.get("source_system") == "tally"),
        check("connected_company_name not None/empty",     bool(ctx.get("connected_company_name"))),
        check("connected_company_id present",              bool(ctx.get("connected_company_id"))),
        check("store_id = store_mumbai_01",                ctx.get("store_id") == "store_mumbai_01"),
        check("store_name = Mumbai Central Store",         ctx.get("store_name") == "Mumbai Central Store"),
        check("store_context_available = True",            ctx.get("store_context_available") is True),
        check("source_entity = product_catalog",           ctx.get("source_entity") == "product_catalog"),
        check("source_record_id = HW-001",                 ctx.get("source_record_id") == "HW-001"),
        check("source_timestamp captured",                 ctx.get("source_timestamp") == "2026-08-20T10:00:00Z"),
        check("received_at is set",                        bool(ctx.get("received_at"))),
        check("sync_id = sync_test_001",                   ctx.get("sync_id") == "sync_test_001"),
        check("source_payload preserved",                  rec.get("source_payload") == raw[0]),
        check("normalized_record present",                 bool(rec.get("normalized_record"))),
    ])
    return all_passed


# TEST 2: Product with no store info
def test_product_no_store():
    sep("TEST 2 -- Product with NO store info (must be None, not invented)")

    raw = [{"sku": "HW-002", "name": "MCB Switch", "price": 120.0}]
    result = BrightConnectionConnector.transform_product_catalog(raw)
    ctx = result[0].get("source_context", {})

    print("\n  store_id                 = {}".format(repr(ctx.get("store_id"))))
    print("  store_name               = {}".format(repr(ctx.get("store_name"))))
    print("  store_context_available  = {}".format(repr(ctx.get("store_context_available"))))

    return all([
        check("store_id is None (not empty string)",   ctx.get("store_id") is None),
        check("store_name is None (not empty string)", ctx.get("store_name") is None),
        check("store_context_available is False",      ctx.get("store_context_available") is False),
        check("connected_company_name still set",      bool(ctx.get("connected_company_name"))),
    ])


# TEST 3: Order Payload
def test_order_payload():
    sep("TEST 3 -- Order Payload provenance")

    raw_order = {
        "order_id":    "ORD-BC-12345",
        "dealer_name": "Sharma Electricals",
        "dealer_id":   "dealer_001",
        "order_date":  "2026-08-21T08:00:00Z",
        "store_id":    "store_delhi_02",
        "store_name":  "Delhi South Store",
        "items": [
            {"product_id": "HW-001", "name": "Anchor Casing", "quantity": 5, "unit_price": 45.0}
        ],
        "status": "Placed",
    }

    result = BrightConnectionConnector.transform_order_payload(raw_order, sync_id="sync_test_002")
    ctx = result.get("source_context", {})

    print("\n  source_entity    = {}".format(repr(ctx.get("source_entity"))))
    print("  source_record_id = {}".format(repr(ctx.get("source_record_id"))))
    print("  store_id         = {}".format(repr(ctx.get("store_id"))))
    print("  source_timestamp = {}".format(repr(ctx.get("source_timestamp"))))

    return all([
        check("source_entity = order_record",      ctx.get("source_entity") == "order_record"),
        check("source_record_id = ORD-BC-12345",   ctx.get("source_record_id") == "ORD-BC-12345"),
        check("store_id = store_delhi_02",          ctx.get("store_id") == "store_delhi_02"),
        check("source_timestamp captured",          ctx.get("source_timestamp") == "2026-08-21T08:00:00Z"),
        check("normalized_record present",          bool(result.get("normalized_record"))),
        check("source_payload preserved",           result.get("source_payload") == raw_order),
    ])


# TEST 4: Field Visit Evidence
def test_field_visit():
    sep("TEST 4 -- Field Visit Evidence provenance")

    raw_visit = {
        "visit_id":          "VIS-001",
        "dealer_id":         "dealer_001",
        "agent_id":          "agent_raj",
        "submitted_at":      "2026-08-21T09:30:00Z",
        "beat_name":         "Mumbai West Beat",
        "payment_collected": 5000.0,
    }

    result = BrightConnectionConnector.transform_field_visit_evidence(raw_visit)
    ctx = result.get("source_context", {})

    return all([
        check("source_entity = field_visit_evidence",  ctx.get("source_entity") == "field_visit_evidence"),
        check("source_record_id = VIS-001",            ctx.get("source_record_id") == "VIS-001"),
        check("source_timestamp captured",             ctx.get("source_timestamp") == "2026-08-21T09:30:00Z"),
        check("location_identifier from beat_name",    ctx.get("location_identifier") == "Mumbai West Beat"),
    ])


# TEST 5: Company separation
def test_company_separation():
    sep("TEST 5 -- Company separation (Test A in task spec)")

    raw_a = [{"sku": "A-001", "name": "Product A"}]
    raw_b = [{"sku": "B-001", "name": "Product B"}]

    result_a = BrightConnectionConnector.transform_product_catalog(raw_a)
    result_b = BrightConnectionConnector.transform_product_catalog(raw_b)

    ctx_a = result_a[0]["source_context"]
    ctx_b = result_b[0]["source_context"]

    return all([
        check("Both records from same connector company",
              ctx_a["connected_company_id"] == ctx_b["connected_company_id"]),
        check("tenant_id is consistent across records",
              result_a[0]["tenant_id"] == result_b[0]["tenant_id"]),
        check("source_record_id A != B (records distinct)",
              ctx_a["source_record_id"] != ctx_b["source_record_id"]),
    ])


# TEST 6: SampadaSignal model
def test_signal_ingestion_model():
    sep("TEST 6 -- SampadaSignal model accepts source_context")

    from setu.signal_ingestion import SampadaSignal

    signal_data = {
        "trace_id":    "trace-bright-001",
        "entity_id":   "entity-HW-001",
        "event_type":  "product_synced",
        "signal_type": "execution",
        "severity":    "low",
        "timestamp":   "2026-08-21T09:00:00Z",
        "tenant_id":   "tenant_bright_connection",
        "source_context": {
            "source_system":          "tally",
            "connected_company_id":   "bc_bright_connection_001",
            "connected_company_name": "Bright Connection",
            "store_id":               "store_mumbai_01",
            "store_name":             "Mumbai Central Store",
            "source_entity":          "product_catalog",
            "source_record_id":       "HW-001",
            "received_at":            "2026-08-21T09:00:00Z",
        }
    }

    try:
        s = SampadaSignal(**signal_data)
        # Also test without source_context
        data_no_ctx = {k: v for k, v in signal_data.items() if k != "source_context"}
        s2 = SampadaSignal(**data_no_ctx)
        return all([
            check("source_context parsed correctly",    s.source_context is not None),
            check("connected_company_name correct",
                  s.source_context["connected_company_name"] == "Bright Connection"),
            check("signal without source_context valid", s2.source_context is None),
        ])
    except Exception as e:
        check("SampadaSignal model validation", False, str(e))
        return False


# TEST 7: Missing source_context -> quarantine
def test_failure_handler_quarantine():
    sep("TEST 7 -- Missing source_context handler: quarantine (Test E)")

    import asyncio
    from unittest.mock import AsyncMock, MagicMock
    from setu.failure_handler import FailureHandler

    mock_store = MagicMock()
    mock_store.append_trace_log = AsyncMock(return_value={})
    handler = FailureHandler(store=mock_store)

    result = asyncio.run(handler.handle_missing_source_context(
        trace_id="trace-001",
        tenant_id="tenant_bright_connection",
        missing_fields=["connected_company_id", "connected_company_name"],
        action="quarantine",
    ))

    print("\n  Response:")
    for k, v in result.items():
        print("    {}: {}".format(k, v))

    return all([
        check("source_context_available = False",        result["source_context_available"] is False),
        check("action = quarantine",                     result["action"] == "quarantine"),
        check("success = True (quarantine, not reject)", result["success"] is True),
        check("missing_context_fields has 2 entries",    len(result["missing_context_fields"]) == 2),
        check("store.append_trace_log was called",       mock_store.append_trace_log.called),
    ])


# TEST 8: Missing source_context -> reject
def test_failure_handler_reject():
    sep("TEST 8 -- Missing source_context handler: reject (Test E, hard reject)")

    import asyncio
    from unittest.mock import AsyncMock, MagicMock
    from setu.failure_handler import FailureHandler

    mock_store = MagicMock()
    mock_store.append_trace_log = AsyncMock(return_value={})
    handler = FailureHandler(store=mock_store)

    result = asyncio.run(handler.handle_missing_source_context(
        trace_id="trace-002",
        tenant_id="tenant_bright_connection",
        missing_fields=["connected_company_id"],
        action="reject",
    ))

    return all([
        check("status_code = 400 on reject",      result["status_code"] == 400),
        check("success = False on reject",         result["success"] is False),
        check("source_context_available = False",  result["source_context_available"] is False),
    ])


# MAIN
def main():
    print("")
    print("=" * 60)
    print("  BHIV SETU -- Bright Connection Provenance Test Suite")
    print("=" * 60)

    tests = [
        ("Product Catalog provenance",             test_product_catalog),
        ("Product with no store (explicit null)",  test_product_no_store),
        ("Order Payload provenance",               test_order_payload),
        ("Field Visit Evidence provenance",        test_field_visit),
        ("Company separation (Test A)",            test_company_separation),
        ("SampadaSignal model + source_context",   test_signal_ingestion_model),
        ("Missing context -> quarantine (Test E)", test_failure_handler_quarantine),
        ("Missing context -> reject (Test E)",     test_failure_handler_reject),
    ]

    results = []
    for name, fn in tests:
        try:
            passed = fn()
        except Exception as e:
            print("\n  [EXCEPTION] in {}: {}".format(name, e))
            passed = False
        results.append((name, passed))

    sep("SUMMARY")
    total  = len(results)
    passed = sum(1 for _, p in results if p)
    for name, p in results:
        print("  {}  {}".format(PASS if p else FAIL, name))

    print("\n  {}/{} tests passed".format(passed, total))
    print("=" * 60)
    print("")

    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
