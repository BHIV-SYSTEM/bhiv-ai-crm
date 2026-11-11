"""
bright_connection_connector.py — Bright Connection API Connector Engine

Translates Bright Connection client payloads into Canonical Master Data Unit (MDU) schemas
for SETU & NIYANTRAN processing without code forks or mock fallbacks.

Pipeline:
Bright Connection API -> Connector -> Canonical MDU Data -> SETU Capability -> Result

Provenance:
Every MDU record carries a source_context envelope so any downstream system
(SETU, Mitra, Niyantran) can answer:
  - Which Tally company/account produced this?
  - Which store/location does it belong to?
  - When was the data received?
  - What source entity produced the record?
"""

import os
from datetime import datetime
import hashlib
import json
from typing import Any, Dict, List, Optional


# ── Connector-level constants ────────────────────────────────────────────────

CONNECTED_COMPANY_ID   = os.getenv("TALLY_BRIGHT_CONNECTION_ID", "bc_bright_connection_001")
CONNECTED_COMPANY_NAME = os.getenv("TALLY_COMPANY", "Bright Connection")
DEFAULT_STORE_ID       = os.getenv("TALLY_STORE_ID", "") or None
DEFAULT_STORE_NAME     = os.getenv("TALLY_STORE_NAME", "") or None
DEFAULT_LOCATION       = os.getenv("TALLY_LOCATION_IDENTIFIER", "") or None


def _build_source_context(
    source_entity: str,
    source_record_id: Optional[str],
    source_timestamp: Optional[str] = None,
    sync_id: Optional[str] = None,
    store_id: Optional[str] = None,
    store_name: Optional[str] = None,
    location_identifier: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build a canonical source_context envelope.

    Rules (per task spec §4):
    - Never invent values. If a field is unavailable use None — NOT an empty string.
    - store_id / store_name may be None when Tally has no godown configured;
      that is explicitly represented, not guessed.
    """
    resolved_store_id   = store_id   or DEFAULT_STORE_ID
    resolved_store_name = store_name or DEFAULT_STORE_NAME
    resolved_location   = location_identifier or DEFAULT_LOCATION

    return {
        "source_system":          "tally",
        "connected_company_id":   CONNECTED_COMPANY_ID,
        "connected_company_name": CONNECTED_COMPANY_NAME if CONNECTED_COMPANY_NAME else None,
        "store_id":               resolved_store_id,
        "store_name":             resolved_store_name,
        "location_identifier":    resolved_location,
        "store_context_available": bool(resolved_store_id or resolved_store_name),
        "source_entity":          source_entity,
        "source_record_id":       source_record_id,
        "source_timestamp":       source_timestamp,
        "received_at":            datetime.utcnow().isoformat() + "Z",
        "sync_id":                sync_id,
    }


class BrightConnectionConnector:
    """Canonical Connector for Bright Connection Tenant Data Pipeline"""

    TENANT_ID = "tenant_bright_connection"

    @classmethod
<<<<<<< HEAD
    def transform_product_catalog(cls, raw_items: List[Dict[str, Any]], tally_provenance: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Transforms Bright Connection raw catalog into Canonical MDU Product format"""
=======
    def transform_product_catalog(
        cls,
        raw_items: List[Dict[str, Any]],
        sync_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Transforms Bright Connection raw catalog into Canonical MDU Product format.
        Each record carries a source_context envelope with full provenance.
        """
>>>>>>> 2055cff64d67f00e72de903fea2f88da12d6b36a
        canonical_products = []
        for item in raw_items:
            sku = (
                item.get("sku")
                or item.get("product_id")
                or f"BC-{hashlib.md5(str(item).encode()).hexdigest()[:8]}"
            )

            source_context = _build_source_context(
                source_entity="product_catalog",
                source_record_id=sku,
                source_timestamp=item.get("created_at") or item.get("updated_at"),
                sync_id=sync_id,
                store_id=item.get("store_id"),
                store_name=item.get("store_name"),
                location_identifier=item.get("location"),
            )

            mdu_product = {
                "mdu_type":         "product_catalog",
                "tenant_id":        cls.TENANT_ID,
                "sku":              sku,
                "name":             item.get("name") or item.get("title") or "Unnamed Product",
                "category":         item.get("category") or "General Hardware",
                "price":            float(item.get("price") or item.get("unit_price") or 0.0),
                "stock_quantity":   int(item.get("stock") or item.get("quantity") or 0),
                "schemes":          item.get("schemes") or [],
                "canonical_version": "1.0",
                "transformed_at":   datetime.utcnow().isoformat() + "Z",
                # ── Provenance ────────────────────────────────────────────
                "source_context":   source_context,
                "source_payload":   item,          # safe: caller-supplied dict, no secrets
                "normalized_record": {             # what SETU / Mitra will consume
                    "sku":          sku,
                    "name":         item.get("name") or item.get("title") or "Unnamed Product",
                    "category":     item.get("category") or "General Hardware",
                    "price":        float(item.get("price") or item.get("unit_price") or 0.0),
                    "stock_quantity": int(item.get("stock") or item.get("quantity") or 0),
                },
            }
            if tally_provenance:
                mdu_product["tally_provenance"] = tally_provenance
            canonical_products.append(mdu_product)
        return canonical_products

    @classmethod
<<<<<<< HEAD
    def transform_order_payload(cls, raw_order: Dict[str, Any], tally_provenance: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Transforms Bright Connection order payload into Canonical MDU Order format"""
        order_id = raw_order.get("order_id") or f"ORD-BC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
=======
    def transform_order_payload(
        cls,
        raw_order: Dict[str, Any],
        sync_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Transforms Bright Connection order payload into Canonical MDU Order format.
        Carries source_context with company, store, entity, and timestamp provenance.
        """
        order_id = (
            raw_order.get("order_id")
            or f"ORD-BC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        )
>>>>>>> 2055cff64d67f00e72de903fea2f88da12d6b36a
        items = []
        total_amount = 0.0

        for item in raw_order.get("items", []):
            qty      = int(item.get("quantity", 1))
            price    = float(item.get("unit_price", 0.0))
            subtotal = qty * price
            total_amount += subtotal
            items.append({
                "product_id": item.get("product_id") or item.get("sku"),
                "name":       item.get("name"),
                "quantity":   qty,
                "unit_price": price,
                "subtotal":   subtotal,
            })

        source_context = _build_source_context(
            source_entity="order_record",
            source_record_id=order_id,
            source_timestamp=raw_order.get("order_date") or raw_order.get("created_at"),
            sync_id=sync_id,
            store_id=raw_order.get("store_id"),
            store_name=raw_order.get("store_name"),
            location_identifier=raw_order.get("location"),
        )

        normalized = {
            "order_id":     order_id,
            "dealer_id":    raw_order.get("dealer_id") or raw_order.get("customer_id"),
            "dealer_name":  raw_order.get("dealer_name") or raw_order.get("shop_name"),
            "items":        items,
            "total_amount": float(raw_order.get("total_amount") or total_amount),
            "status":       raw_order.get("status") or "Placed",
        }

        return {
            "mdu_type":          "order_record",
            "tenant_id":         cls.TENANT_ID,
            "order_id":          order_id,
            "dealer_id":         raw_order.get("dealer_id") or raw_order.get("customer_id"),
            "dealer_name":       raw_order.get("dealer_name") or raw_order.get("shop_name"),
            "items":             items,
            "total_amount":      float(raw_order.get("total_amount") or total_amount),
            "status":            raw_order.get("status") or "Placed",
            "payment_receipt":   raw_order.get("payment_receipt_url") or None,
            "canonical_version": "1.0",
            "transformed_at":    datetime.utcnow().isoformat() + "Z",
            # ── Provenance ────────────────────────────────────────────────
            "source_context":    source_context,
            "source_payload":    raw_order,
            "normalized_record": normalized,
        }
        if tally_provenance:
            result["tally_provenance"] = tally_provenance
        return result

    @classmethod
<<<<<<< HEAD
    def transform_field_visit_evidence(cls, raw_visit: Dict[str, Any], tally_provenance: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Transforms Bright Connection field visit evidence into Canonical MDU Evidence format"""
        result = {
            "mdu_type": "field_visit_evidence",
            "tenant_id": cls.TENANT_ID,
            "account_id": raw_visit.get("account_id") or raw_visit.get("tally_account_id"),
            "store_id": raw_visit.get("store_id") or raw_visit.get("tally_store_id"),
            "visit_id": raw_visit.get("visit_id") or f"VIS-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "route_id": raw_visit.get("route_id") or raw_visit.get("beat_id"),
            "dealer_id": raw_visit.get("dealer_id"),
            "agent_id": raw_visit.get("agent_id") or raw_visit.get("submitted_by"),
            "location_proof": {
                "lat": float(raw_visit.get("lat") or raw_visit.get("latitude") or 0.0),
                "lng": float(raw_visit.get("lng") or raw_visit.get("longitude") or 0.0),
                "verified": raw_visit.get("location_verified", True)
            },
            "display_photo_url": raw_visit.get("display_photo_url") or raw_visit.get("shelf_image"),
            "damaged_goods_report": raw_visit.get("damaged_goods") or [],
            "invoice_capture_url": raw_visit.get("invoice_url") or raw_visit.get("receipt_url"),
=======
    def transform_field_visit_evidence(
        cls,
        raw_visit: Dict[str, Any],
        sync_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Transforms Bright Connection field visit evidence into Canonical MDU Evidence format.
        Carries source_context with location, agent, and timestamp provenance.
        """
        visit_id = (
            raw_visit.get("visit_id")
            or f"VIS-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        )

        source_context = _build_source_context(
            source_entity="field_visit_evidence",
            source_record_id=visit_id,
            source_timestamp=raw_visit.get("visit_date") or raw_visit.get("submitted_at"),
            sync_id=sync_id,
            store_id=raw_visit.get("store_id"),
            store_name=raw_visit.get("store_name"),
            location_identifier=raw_visit.get("location") or raw_visit.get("beat_name"),
        )

        normalized = {
            "visit_id":         visit_id,
            "route_id":         raw_visit.get("route_id") or raw_visit.get("beat_id"),
            "dealer_id":        raw_visit.get("dealer_id"),
            "agent_id":         raw_visit.get("agent_id") or raw_visit.get("submitted_by"),
>>>>>>> 2055cff64d67f00e72de903fea2f88da12d6b36a
            "payment_collected": float(raw_visit.get("payment_collected") or 0.0),
            "parikshak_reviewed": False,
        }

        return {
            "mdu_type":           "field_visit_evidence",
            "tenant_id":          cls.TENANT_ID,
            "visit_id":           visit_id,
            "route_id":           raw_visit.get("route_id") or raw_visit.get("beat_id"),
            "dealer_id":          raw_visit.get("dealer_id"),
            "agent_id":           raw_visit.get("agent_id") or raw_visit.get("submitted_by"),
            "location_proof": {
                "lat":      float(raw_visit.get("lat") or raw_visit.get("latitude") or 0.0),
                "lng":      float(raw_visit.get("lng") or raw_visit.get("longitude") or 0.0),
                "verified": raw_visit.get("location_verified", True),
            },
            "display_photo_url":    raw_visit.get("display_photo_url") or raw_visit.get("shelf_image"),
            "damaged_goods_report": raw_visit.get("damaged_goods") or [],
            "invoice_capture_url":  raw_visit.get("invoice_url") or raw_visit.get("receipt_url"),
            "payment_collected":    float(raw_visit.get("payment_collected") or 0.0),
            "parikshak_reviewed":   False,
            "canonical_version":    "1.0",
            "transformed_at":       datetime.utcnow().isoformat() + "Z",
            # ── Provenance ────────────────────────────────────────────────
            "source_context":       source_context,
            "source_payload":       raw_visit,
            "normalized_record":    normalized,
        }
        if tally_provenance:
            result["tally_provenance"] = tally_provenance
        return result
