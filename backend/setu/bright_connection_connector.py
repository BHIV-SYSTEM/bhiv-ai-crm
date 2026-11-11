"""
bright_connection_connector.py — Bright Connection API Connector Engine

Translates Bright Connection client payloads into Canonical Master Data Unit (MDU) schemas
for SETU & NIYANTRAN processing without code forks or mock fallbacks.

Pipeline:
Bright Connection API -> Connector -> Canonical MDU Data -> SETU Capability -> Result
"""

from datetime import datetime
import hashlib
import json
from typing import Any, Dict, List, Optional


class BrightConnectionConnector:
    """Canonical Connector for Bright Connection Tenant Data Pipeline"""

    TENANT_ID = "tenant_bright_connection"

    @classmethod
    def transform_product_catalog(cls, raw_items: List[Dict[str, Any]], tally_provenance: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Transforms Bright Connection raw catalog into Canonical MDU Product format"""
        canonical_products = []
        for item in raw_items:
            mdu_product = {
                "mdu_type": "product_catalog",
                "tenant_id": cls.TENANT_ID,
                "sku": item.get("sku") or item.get("product_id") or f"BC-{hashlib.md5(str(item).encode()).hexdigest()[:8]}",
                "name": item.get("name") or item.get("title") or "Unnamed Product",
                "category": item.get("category") or "General Hardware",
                "price": float(item.get("price") or item.get("unit_price") or 0.0),
                "stock_quantity": int(item.get("stock") or item.get("quantity") or 0),
                "schemes": item.get("schemes") or [],
                "canonical_version": "1.0",
                "transformed_at": datetime.utcnow().isoformat()
            }
            if tally_provenance:
                mdu_product["tally_provenance"] = tally_provenance
            canonical_products.append(mdu_product)
        return canonical_products

    @classmethod
    def transform_order_payload(cls, raw_order: Dict[str, Any], tally_provenance: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Transforms Bright Connection order payload into Canonical MDU Order format"""
        order_id = raw_order.get("order_id") or f"ORD-BC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        items = []
        total_amount = 0.0

        for item in raw_order.get("items", []):
            qty = int(item.get("quantity", 1))
            price = float(item.get("unit_price", 0.0))
            subtotal = qty * price
            total_amount += subtotal
            items.append({
                "product_id": item.get("product_id") or item.get("sku"),
                "name": item.get("name"),
                "quantity": qty,
                "unit_price": price,
                "subtotal": subtotal
            })

        return {
            "mdu_type": "order_record",
            "tenant_id": cls.TENANT_ID,
            "order_id": order_id,
            "dealer_id": raw_order.get("dealer_id") or raw_order.get("customer_id"),
            "dealer_name": raw_order.get("dealer_name") or raw_order.get("shop_name"),
            "items": items,
            "total_amount": float(raw_order.get("total_amount") or total_amount),
            "status": raw_order.get("status") or "Placed",
            "payment_receipt": raw_order.get("payment_receipt_url") or None,
            "canonical_version": "1.0",
            "transformed_at": datetime.utcnow().isoformat()
        }
        if tally_provenance:
            result["tally_provenance"] = tally_provenance
        return result

    @classmethod
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
            "payment_collected": float(raw_visit.get("payment_collected") or 0.0),
            "parikshak_reviewed": False,
            "canonical_version": "1.0",
            "transformed_at": datetime.utcnow().isoformat()
        }
        if tally_provenance:
            result["tally_provenance"] = tally_provenance
        return result
