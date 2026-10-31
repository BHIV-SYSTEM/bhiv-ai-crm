"""
chatbot_agent.py - Conversational support assistant with human review escalation.
"""

from __future__ import annotations

import re
from typing import Optional
import pandas as pd
from human_review import HumanReviewSystem

review_system = HumanReviewSystem()

orders_df = pd.DataFrame(columns=["OrderID", "Status"])
restocks_df = pd.DataFrame(columns=["ProductID", "RestockQuantity"])


def extract_order_id(message: str) -> Optional[int]:
    """Extract numeric order ID from message."""
    if not message:
        return None
    match = re.search(r"(?:order\s*#?|#)\s*(\d+)", message, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def extract_product_id(message: str) -> Optional[str]:
    """Extract product ID from message. Supports explicit 'product X' or alphanumeric codes like A101, E505."""
    if not message:
        return None

    # Check for direct alphanumeric code (letter followed by digits, e.g. A101, B202, C303, E505, X999)
    direct_match = re.search(r"\b([A-Za-z]\d{2,4})\b", message)
    if direct_match:
        return direct_match.group(1).upper()

    # Check for "product <id>"
    match = re.search(r"\bproduct\s+([A-Za-z0-9]+)\b", message, re.IGNORECASE)
    if match:
        candidate = match.group(1).upper()
        if candidate not in ("HERE", "THERE", "STATUS", "INFO", "UPDATE", "DETAILS"):
            return candidate

    return None


def chatbot_response(query: str) -> str:
    """Generate response for customer queries or escalate to human review."""
    if not query:
        return "I can help with order tracking and restock inquiries."

    # Check for human review escalation
    if review_system.requires_human_review(query):
        review_id = review_system.submit_for_review(query, reason="complex_query")
        return f"Your request has been forwarded to our support team for review. Reference ID: {review_id}"

    # Check for order queries
    order_id = extract_order_id(query)
    if order_id is not None:
        if orders_df is not None and not orders_df.empty and "OrderID" in orders_df.columns:
            matched = orders_df[orders_df["OrderID"] == order_id]
            if not matched.empty:
                status = matched.iloc[0].get("Status", "Processing")
                return f"Order #{order_id} status is {status}."
        return f"Sorry, we couldn't find order #{order_id} in our records."

    # Check for restock queries
    product_id = extract_product_id(query)
    if product_id is not None:
        if restocks_df is not None and not restocks_df.empty and "ProductID" in restocks_df.columns:
            matched = restocks_df[restocks_df["ProductID"].astype(str).str.upper() == product_id.upper()]
            if not matched.empty:
                qty = matched.iloc[0].get("RestockQuantity", 0)
                return f"Product {product_id} scheduled for restock: {qty} units arriving soon."
        return f"No restock schedule found for product {product_id}."

    # Default greeting / general inquiry
    return "Hello! I can help with order status inquiries and product restock schedules."
