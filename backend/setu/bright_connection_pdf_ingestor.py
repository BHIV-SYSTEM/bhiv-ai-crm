"""
bright_connection_pdf_ingestor.py — Bright Connection Receivable PDF Parser & SETU Ingestor

Parses Tally / BizAnalyst "List of outstanding due" PDFs (e.g., Receivable-22 Sept 26.pdf),
validates customer-level and grand-total arithmetic integrity, transforms records into
Canonical MDU format via BrightConnectionConnector, and persists them for SETU & Mitra.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pdfplumber

if __package__:
    from .bright_connection_connector import BrightConnectionConnector
else:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from setu.bright_connection_connector import BrightConnectionConnector

ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_PATH = ROOT_DIR / "data" / "bright_connection_receivables.json"

_HEADER_PREFIXES = (
    "list of outstanding due",
    "total customers:",
    "total amount:",
    "group:",
    "created by https://bizanalyst.in",
)


def _parse_amount(raw: Optional[str]) -> Optional[float]:
    if raw is None:
        return None
    cleaned = raw.replace(",", "").strip()
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _parse_int(raw: Optional[str]) -> Optional[int]:
    if raw is None:
        return None
    cleaned = raw.replace(",", "").strip()
    if not cleaned:
        return None
    try:
        return int(float(cleaned))
    except ValueError:
        return None


def _clean_cell(val: Optional[str]) -> str:
    if not val:
        return ""
    return " ".join(val.split()).strip()


def _extract_text_in_band(page: pdfplumber.page.Page, top: float, bottom: float) -> str:
    """Extract cleaned non-boilerplate text lines between vertical coordinates [top, bottom]."""
    if bottom <= top + 1:
        return ""
    cropped = page.crop((0, max(0.0, top), page.width, min(page.height, bottom)))
    raw_text = cropped.extract_text() or ""
    lines: List[str] = []
    for line in raw_text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        low = stripped.lower()
        if any(low.startswith(p) for p in _HEADER_PREFIXES):
            continue
        # Stop before the Bright Connections signature block on the final page
        if low.startswith("regards,"):
            break
        lines.append(stripped)
    return " ".join(lines).strip()


def _parse_report_metadata(pdf: pdfplumber.PDF) -> Dict[str, Any]:
    """Extract report header metadata from page 1 and company footer from the last page."""
    first_text = pdf.pages[0].extract_text() or ""
    last_text = pdf.pages[-1].extract_text() or ""

    total_customers_reported: Optional[int] = None
    total_amount_reported: Optional[float] = None
    group: Optional[str] = None

    for line in first_text.splitlines():
        s = line.strip()
        if s.lower().startswith("total customers:"):
            total_customers_reported = _parse_int(s.split(":", 1)[1])
        elif s.lower().startswith("total amount:"):
            total_amount_reported = _parse_amount(s.split(":", 1)[1])
        elif s.lower().startswith("group:"):
            group = s.split(":", 1)[1].strip()

    company_name = "Bright Connections"
    gstin = None
    email = None
    address_lines: List[str] = []

    in_regards = False
    for line in last_text.splitlines():
        s = line.strip()
        low = s.lower()
        if low.startswith("regards,"):
            in_regards = True
            continue
        if in_regards:
            if low.startswith("sent through"):
                break
            if low.startswith("gstin"):
                gstin = s.split(":", 1)[1].strip()
            elif low.startswith("e-mail") or low.startswith("email"):
                email = s.split(":", 1)[1].strip()
            elif s:
                address_lines.append(s)

    if address_lines:
        company_name = address_lines[0]
        address = ", ".join(address_lines[1:])
    else:
        address = ""

    return {
        "report_title": "List of outstanding due.",
        "company_name": company_name,
        "address": address,
        "location": "Mumbai 400104",
        "gstin": gstin,
        "email": email,
        "group": group,
        "source_app": "Biz Analyst App",
        "total_customers_reported": total_customers_reported,
        "total_amount_reported": total_amount_reported,
    }


def parse_receivable_pdf(pdf_path: str | Path) -> Dict[str, Any]:
    """
    Parse a BizAnalyst / Tally Receivable PDF into structured customer records
    and validate customer-level and grand-total sums.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {path}")

    with pdfplumber.open(str(path)) as pdf:
        metadata = _parse_report_metadata(pdf)
        metadata["source_file"] = path.name
        metadata["page_count"] = len(pdf.pages)

        # Infer report date from filename if possible (e.g., "Receivable-22 Sept 26.pdf")
        m_date = re.search(r"(\d{1,2}\s+[A-Za-z]+\s+\d{2,4})", path.stem)
        metadata["report_date"] = m_date.group(1) if m_date else None

        customers: List[Dict[str, Any]] = []
        current_customer: Optional[Dict[str, Any]] = None
        pending_name: str = ""
        grand_total_row: Optional[float] = None

        for page in pdf.pages:
            tables = sorted(page.find_tables(), key=lambda t: t.bbox[1])
            prev_bottom = 0.0

            for tbl in tables:
                top, bottom = tbl.bbox[1], tbl.bbox[3]
                between_text = _extract_text_in_band(page, prev_bottom, top)
                prev_bottom = bottom

                if between_text:
                    pending_name = f"{pending_name} {between_text}".strip() if pending_name else between_text

                rows = tbl.extract() or []
                if not rows:
                    continue

                # Check if this is the standalone Grand Total box on the last page: [['Total', '11,49,012']]
                if len(rows) == 1 and len(rows[0]) == 2 and _clean_cell(rows[0][0]).lower() == "total":
                    grand_total_row = _parse_amount(_clean_cell(rows[0][1]))
                    continue

                first_cell = _clean_cell(rows[0][0]).lower() if rows[0] else ""
                has_header = first_cell == "date"

                # Start a new customer when we have a pending name (and/or a fresh table header
                # when the previous customer is already closed with a Total).
                if pending_name and (current_customer is None or current_customer.get("closed", False) or has_header):
                    if current_customer is not None:
                        customers.append(current_customer)
                    current_customer = {
                        "customer_name": pending_name,
                        "entries": [],
                        "total": None,
                        "closed": False,
                    }
                    pending_name = ""

                if current_customer is None:
                    # Safety fallback if a table appeared without a detected name
                    current_customer = {
                        "customer_name": "UNKNOWN_CUSTOMER",
                        "entries": [],
                        "total": None,
                        "closed": False,
                    }

                for row in rows:
                    cells = [_clean_cell(c) for c in row]
                    if not any(cells):
                        continue
                    # Skip header row
                    if len(cells) >= 2 and cells[0].lower() == "date" and "ref" in cells[1].lower():
                        continue
                    # Customer Total row
                    if len(cells) >= 3 and cells[1].lower() == "total":
                        current_customer["total"] = _parse_amount(cells[2])
                        current_customer["closed"] = True
                        continue

                    if len(cells) >= 5:
                        date_str, ref_no, amt_str, due_on, overdue_str = cells[:5]
                        amount = _parse_amount(amt_str)
                        overdue_days = _parse_int(overdue_str)
                        current_customer["entries"].append({
                            "date": date_str or None,
                            "ref_no": ref_no,
                            "pending_amount": amount if amount is not None else 0.0,
                            "due_on": due_on or None,
                            "overdue_by_days": overdue_days,
                        })

            # Capture any trailing customer name at the bottom of the page for the next page's table
            trailing_text = _extract_text_in_band(page, prev_bottom, page.height)
            if trailing_text:
                pending_name = f"{pending_name} {trailing_text}".strip() if pending_name else trailing_text

        if current_customer is not None:
            customers.append(current_customer)

    # Finalize and validate arithmetic for every customer
    computed_grand_total = 0.0
    mismatches: List[Dict[str, Any]] = []

    for cust in customers:
        cust.pop("closed", None)
        entries_sum = round(sum(e["pending_amount"] for e in cust["entries"]), 2)
        if cust["total"] is None:
            cust["total"] = entries_sum
        else:
            cust["total"] = round(cust["total"], 2)
            if abs(cust["total"] - entries_sum) > 0.05:
                mismatches.append({
                    "customer_name": cust["customer_name"],
                    "reported_total": cust["total"],
                    "computed_sum": entries_sum,
                })

        overdue_vals = [e["overdue_by_days"] for e in cust["entries"] if e["overdue_by_days"] is not None]
        cust["max_overdue_days"] = max(overdue_vals) if overdue_vals else 0
        computed_grand_total = round(computed_grand_total + cust["total"], 2)

    reported_grand = grand_total_row or metadata.get("total_amount_reported") or computed_grand_total

    return {
        "report_id": f"RCV-BC-{path.stem.replace(' ', '_')}",
        "ingested_at": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata,
        "total_customers": len(customers),
        "total_amount": computed_grand_total,
        "validation": {
            "customer_count_matches_header": len(customers) == metadata.get("total_customers_reported"),
            "reported_customers": metadata.get("total_customers_reported"),
            "parsed_customers": len(customers),
            "grand_total_matches_header": abs(computed_grand_total - float(reported_grand)) <= 0.05,
            "reported_grand_total": reported_grand,
            "computed_grand_total": computed_grand_total,
            "customer_total_mismatches": mismatches,
        },
        "customers": customers,
    }


def ingest_receivable_pdf(
    pdf_path: str | Path,
    output_path: Optional[str | Path] = None,
    sync_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Parse the Receivable PDF, transform into Canonical MDU Receivable Ledger format
    via BrightConnectionConnector, and persist to JSON for SETU & Mitra.
    """
    parsed = parse_receivable_pdf(pdf_path)
    resolved_sync_id = sync_id or f"sync_bc_pdf_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    canonical_mdu = BrightConnectionConnector.transform_receivable_ledger(
        parsed,
        sync_id=resolved_sync_id,
    )
    canonical_mdu["validation"] = parsed["validation"]

    target_path = Path(output_path) if output_path else DEFAULT_OUTPUT_PATH
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(json.dumps(canonical_mdu, indent=2, ensure_ascii=False), encoding="utf-8")

    return canonical_mdu


def load_ingested_receivables(data_path: Optional[str | Path] = None) -> Optional[Dict[str, Any]]:
    """Load the persisted Bright Connection Canonical MDU Receivable Ledger if present."""
    path = Path(data_path) if data_path else DEFAULT_OUTPUT_PATH
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    pdf_arg = sys.argv[1] if len(sys.argv) > 1 else str(ROOT_DIR / "Receivable-22 Sept 26.pdf")
    result = ingest_receivable_pdf(pdf_arg)
    print(f"Ingested: {result['metadata'].get('source_file')}")
    print(f"Company:  {result['metadata'].get('company_name')} (GSTIN: {result['metadata'].get('gstin')})")
    print(f"Group:    {result['metadata'].get('group')}")
    print(f"Customers:{result['total_customers']} (Header: {result['validation']['reported_customers']})")
    print(f"Total:    INR {result['total_amount']:,.2f} (Header: INR {result['validation']['reported_grand_total']:,.2f})")
    print(f"Mismatches: {len(result['validation']['customer_total_mismatches'])}")
    print(f"Saved to: {DEFAULT_OUTPUT_PATH}")

