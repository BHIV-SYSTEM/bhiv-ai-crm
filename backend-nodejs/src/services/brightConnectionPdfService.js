import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const BOILERPLATE_PREFIXES = [
  'list of outstanding due',
  'total customers:',
  'total amount:',
  'group:',
  'created by https://bizanalyst.in',
];

function parseAmount(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/,/g, '').trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseIntVal(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/,/g, '').trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

function groupPageItemsIntoLines(items) {
  const cleanItems = items
    .map((it) => ({
      str: (it.str || '').trim(),
      x: Number(it.transform?.[4] || 0),
      y: Number(it.transform?.[5] || 0),
    }))
    .filter((it) => it.str.length > 0);

  // Sort top-to-bottom (y descending), then left-to-right (x ascending)
  cleanItems.sort((a, b) => (Math.abs(b.y - a.y) > 4 ? b.y - a.y : a.x - b.x));

  const lines = [];
  for (const item of cleanItems) {
    const lastLine = lines[lines.length - 1];
    if (lastLine && Math.abs(lastLine.y - item.y) <= 4) {
      lastLine.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = line.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
  }
  return lines;
}

function splitRowColumns(lineItems) {
  const cols = { date: [], ref: [], amount: [], dueOn: [], overdue: [] };
  for (const it of lineItems) {
    if (it.x < 115) cols.date.push(it.str);
    else if (it.x < 245) cols.ref.push(it.str);
    else if (it.x < 385) cols.amount.push(it.str);
    else if (it.x < 480) cols.dueOn.push(it.str);
    else cols.overdue.push(it.str);
  }
  return {
    date: cols.date.join(' ').trim(),
    ref: cols.ref.join(' ').trim(),
    amount: cols.amount.join(' ').trim(),
    dueOn: cols.dueOn.join(' ').trim(),
    overdue: cols.overdue.join(' ').trim(),
  };
}

function isDateToken(str) {
  return /^\d{1,2}\s+[A-Za-z]{3,5}\s+\d{2,4}$/.test((str || '').trim());
}

/**
 * Parse a BizAnalyst / Tally "List of outstanding due" PDF Buffer in pure Node.js.
 * Returns a Canonical MDU Receivable Ledger object matching bright_connection_pdf_ingestor.py.
 */
export async function parseReceivablePdfBuffer(buffer, fileName = 'Receivable-22 Sept 26.pdf') {
  const uint8 = buffer instanceof Uint8Array ? new Uint8Array(buffer) : new Uint8Array(Buffer.from(buffer));
  const doc = await pdfjsLib.getDocument({ data: uint8, useSystemFonts: true, verbosity: 0 }).promise;

  let totalCustomersReported = null;
  let totalAmountReported = null;
  let group = null;

  let companyName = 'Bright Connections';
  let gstin = null;
  let email = null;
  const addressLines = [];

  const customers = [];
  let currentCustomer = null;
  let pendingNameParts = [];
  let grandTotalRow = null;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lines = groupPageItemsIntoLines(tc.items || []);

    let inRegards = false;
    let expectHeaderWrap = false;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const text = line.text;
      const low = text.toLowerCase();

      // Metadata on page 1
      if (p === 1) {
        if (low.startsWith('total customers:')) {
          totalCustomersReported = parseIntVal(text.split(':')[1]);
          continue;
        }
        if (low.startsWith('total amount:')) {
          totalAmountReported = parseAmount(text.split(':')[1]);
          continue;
        }
        if (low.startsWith('group:')) {
          group = text.split(':').slice(1).join(':').trim();
          continue;
        }
      }

      if (BOILERPLATE_PREFIXES.some((pfx) => low.startsWith(pfx))) {
        continue;
      }

      // Signature block on final page
      if (p === doc.numPages && low.startsWith('regards,')) {
        inRegards = true;
        continue;
      }
      if (inRegards) {
        if (low.startsWith('sent through')) {
          inRegards = false;
          continue;
        }
        if (low.startsWith('gstin')) {
          gstin = text.split(':').slice(1).join(':').trim();
        } else if (low.startsWith('e-mail') || low.startsWith('email')) {
          email = text.split(':').slice(1).join(':').trim();
        } else if (text) {
          addressLines.push(text);
        }
        continue;
      }

      // Skip wrapped second line of table header ("Amount" + "by days")
      if (expectHeaderWrap) {
        expectHeaderWrap = false;
        if (low === 'amount by days' || (low.includes('amount') && low.includes('by days'))) {
          continue;
        }
      }

      // Detect table header row: "Date Ref. No. Pending Due on Overdue"
      const cols = splitRowColumns(line.items);
      if (cols.date.toLowerCase() === 'date' && cols.ref.toLowerCase().includes('ref')) {
        expectHeaderWrap = true;
        if (pendingNameParts.length > 0) {
          if (currentCustomer) customers.push(currentCustomer);
          currentCustomer = {
            customer_name: pendingNameParts.join(' ').replace(/\s+/g, ' ').trim(),
            entries: [],
            total: null,
            closed: false,
          };
          pendingNameParts = [];
        }
        continue;
      }

      // Detect Grand Total box on last page: e.g. line.items = ["Total", "11,49,012"] with no date/due
      if (
        p === doc.numPages &&
        line.items.length === 2 &&
        line.items[0].str.toLowerCase() === 'total' &&
        line.items[0].x >= 180 &&
        parseAmount(line.items[1].str) !== null
      ) {
        grandTotalRow = parseAmount(line.items[1].str);
        continue;
      }

      // Detect Customer Total row: "Total" in Ref column (x between 115 and 245) + amount in Pending Amount column
      if (cols.ref.toLowerCase() === 'total' && parseAmount(cols.amount) !== null) {
        if (!currentCustomer && pendingNameParts.length > 0) {
          currentCustomer = {
            customer_name: pendingNameParts.join(' ').replace(/\s+/g, ' ').trim(),
            entries: [],
            total: null,
            closed: false,
          };
          pendingNameParts = [];
        }
        if (currentCustomer) {
          currentCustomer.total = parseAmount(cols.amount);
          currentCustomer.closed = true;
        }
        continue;
      }

      // Detect data row: either Date column has a date, or Ref column has "On Account", or Amount is numeric with Date/Ref
      const parsedAmt = parseAmount(cols.amount);
      const isDataRow =
        parsedAmt !== null &&
        (isDateToken(cols.date) ||
          cols.ref.toLowerCase() === 'on account' ||
          isDateToken(cols.dueOn) ||
          cols.overdue !== '');

      if (isDataRow) {
        if (!currentCustomer || (currentCustomer.closed && pendingNameParts.length > 0)) {
          if (currentCustomer) customers.push(currentCustomer);
          currentCustomer = {
            customer_name: pendingNameParts.length > 0 ? pendingNameParts.join(' ').trim() : 'UNKNOWN_CUSTOMER',
            entries: [],
            total: null,
            closed: false,
          };
          pendingNameParts = [];
        }

        currentCustomer.entries.push({
          date: cols.date || null,
          ref_no: cols.ref || (cols.date ? '' : 'On Account'),
          pending_amount: parsedAmt,
          due_on: cols.dueOn || null,
          overdue_by_days: parseIntVal(cols.overdue),
        });
        continue;
      }

      // Otherwise, this line is part of the next customer's name (can be 1-3 wrapped lines)
      pendingNameParts.push(text);
    }
  }

  if (currentCustomer) {
    customers.push(currentCustomer);
  }

  if (addressLines.length > 0) {
    companyName = addressLines[0];
  }
  const address = addressLines.slice(1).join(', ');
  const dateMatch = fileName.match(/(\d{1,2}\s+[A-Za-z]+\s+\d{2,4})/);
  const reportDate = dateMatch ? dateMatch[1] : null;
  const stem = fileName.replace(/\.pdf$/i, '').replace(/\s+/g, '_');
  const reportId = `RCV-BC-${stem}`;
  const nowIso = new Date().toISOString();

  // Validate per-customer & grand totals
  let computedGrandTotal = 0;
  const mismatches = [];
  const canonicalCustomers = [];

  customers.forEach((cust, idx) => {
    const entriesSum = Math.round(cust.entries.reduce((acc, e) => acc + (e.pending_amount || 0), 0) * 100) / 100;
    const totalPending = cust.total !== null ? Math.round(cust.total * 100) / 100 : entriesSum;
    if (cust.total !== null && Math.abs(totalPending - entriesSum) > 0.05) {
      mismatches.push({
        customer_name: cust.customer_name,
        reported_total: totalPending,
        computed_sum: entriesSum,
      });
    }
    const overdueVals = cust.entries.map((e) => e.overdue_by_days).filter((v) => v !== null && v !== undefined);
    const maxOverdue = overdueVals.length > 0 ? Math.max(...overdueVals) : 0;
    computedGrandTotal = Math.round((computedGrandTotal + totalPending) * 100) / 100;

    const custId = `CUST-BC-${String(idx + 1).padStart(3, '0')}`;
    canonicalCustomers.push({
      mdu_type: 'receivable_customer_ledger',
      tenant_id: 'tenant_bright_connection',
      customer_id: custId,
      customer_name: cust.customer_name,
      group: group || 'ARUN CHALKE',
      total_pending_amount: totalPending,
      invoice_count: cust.entries.length,
      max_overdue_days: maxOverdue,
      entries: cust.entries,
      canonical_version: '1.0',
      transformed_at: nowIso,
      source_context: {
        source_system: 'tally_bizanalyst_pdf',
        connected_company_id: 'bc_bright_connection_001',
        connected_company_name: companyName,
        store_id: custId,
        store_name: cust.customer_name,
        location_identifier: 'Mumbai',
        store_context_available: true,
        source_entity: 'receivable_customer_ledger',
        source_record_id: custId,
        source_timestamp: reportDate,
        received_at: nowIso,
        group: group || 'ARUN CHALKE',
      },
    });
  });

  const reportedGrand = grandTotalRow ?? totalAmountReported ?? computedGrandTotal;

  const metadata = {
    report_title: 'List of outstanding due.',
    company_name: companyName,
    address,
    location: 'Mumbai 400104',
    gstin,
    email,
    group: group || 'ARUN CHALKE',
    source_app: 'Biz Analyst App',
    total_customers_reported: totalCustomersReported ?? canonicalCustomers.length,
    total_amount_reported: totalAmountReported ?? reportedGrand,
    source_file: fileName,
    page_count: doc.numPages,
    report_date: reportDate,
  };

  return {
    mdu_type: 'receivable_ledger',
    tenant_id: 'tenant_bright_connection',
    report_id: reportId,
    metadata,
    total_customers: canonicalCustomers.length,
    total_amount: computedGrandTotal,
    customers: canonicalCustomers,
    canonical_version: '1.0',
    transformed_at: nowIso,
    source_context: {
      source_system: 'tally_bizanalyst_pdf',
      connected_company_id: 'bc_bright_connection_001',
      connected_company_name: companyName,
      store_id: null,
      store_name: companyName,
      location_identifier: 'Mumbai 400104',
      store_context_available: false,
      source_entity: 'receivable_ledger',
      source_record_id: reportId,
      source_timestamp: reportDate,
      received_at: nowIso,
      gstin,
      group: group || 'ARUN CHALKE',
    },
    validation: {
      customer_count_matches_header: canonicalCustomers.length === (totalCustomersReported ?? canonicalCustomers.length),
      reported_customers: totalCustomersReported ?? canonicalCustomers.length,
      parsed_customers: canonicalCustomers.length,
      grand_total_matches_header: Math.abs(computedGrandTotal - Number(reportedGrand)) <= 0.05,
      reported_grand_total: Number(reportedGrand),
      computed_grand_total: computedGrandTotal,
      customer_total_mismatches: mismatches,
    },
  };
}

