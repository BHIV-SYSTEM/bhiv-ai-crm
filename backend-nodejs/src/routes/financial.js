import { Router } from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.js';
import {
  REPORT_TYPES,
  callArtha,
  callArthaRaw,
  callArthaMultipart,
  checkStatus,
  newTraceId,
  sendBridgeError,
  sendBridgeResult,
} from '../services/arthaBridge.service.js';

/**
 * /api/financial — client-facing financial access (SETU Workstream B).
 *
 * This router is READ-ONLY with respect to accounting truth:
 *  - no journal/ledger/invoice/expense POST endpoints are exposed here;
 *  - document upload only forwards into ARTHA's ingestion workflow;
 *  - MITRA chat is conversational and cannot post entries.
 * Company scope is resolved server-side per authenticated tenant
 * (never from browser-supplied identifiers) and enforced inside ARTHA.
 */

const router = Router();
router.use(protect);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

/** Wrap multer so oversized/bad files return an honest 400, not a 500. */
const parseUpload = (field) => {
  const mw = upload.single(field);
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          code: 'upload_rejected',
          message: err.message || 'Upload rejected',
        });
      }
      return next();
    });
  };
};

const safeId = (value) => String(value || '').replace(/[^\w-]/g, '').slice(0, 64);
const tenantOf = (req) => req.user?.tenant_id || null;
const traceOf = (req) => req.headers['x-trace-id'] || newTraceId();

/* ------------------------------------------------------------------ status */

router.get('/status', async (req, res) => {
  const traceId = traceOf(req);
  const data = await checkStatus(tenantOf(req));
  res.json({ success: true, data, trace_id: traceId });
});

router.get('/company', async (req, res) => {
  const traceId = traceOf(req);
  const result = await callArtha({ path: '/settings/company', tenantId: tenantOf(req), traceId });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

/* ----------------------------------------------------------------- reports */

router.get('/reports/:type', async (req, res) => {
  const traceId = traceOf(req);
  const reportKey = String(req.params.type || '').toLowerCase();
  const upstreamPath = REPORT_TYPES[reportKey];
  if (!upstreamPath) {
    return res.status(404).json({
      success: false,
      code: 'unknown_report',
      message: `Unknown report type '${reportKey}'`,
      available: Object.keys(REPORT_TYPES),
      trace_id: traceId,
    });
  }
  const result = await callArtha({
    path: `/reports/${upstreamPath}`,
    query: req.query,
    tenantId: tenantOf(req),
    traceId,
  });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

/* ------------------------------------------------------- invoices/expenses */

/**
 * Customer ownership scope for invoice access.
 * Returns the query params a `customer` role user is allowed to see:
 * invoices addressed to their email or their shop GSTIN (Artha matches
 * either). Values are enforced server-side — client-supplied
 * customerEmail/customerGSTIN are always stripped.
 */
const customerInvoiceScope = (user) => {
  const scope = {};
  const email = String(user?.email || '').trim();
  const gstin = String(user?.shopDetails?.gstNumber || '').trim();
  if (email) scope.customerEmail = email;
  if (gstin) scope.customerGSTIN = gstin;
  return scope;
};

router.get('/invoices', async (req, res) => {
  const traceId = traceOf(req);
  const query = { ...req.query };
  if (req.user?.role === 'customer') {
    const scope = customerInvoiceScope(req.user);
    delete query.customerEmail;
    delete query.customerGSTIN;
    if (Object.keys(scope).length === 0) {
      // No identifying scope on the account → nothing to show, never all invoices.
      return res.json({
        success: true,
        data: [],
        pagination: { page: 1, limit: Number(query.limit) || 20, total: 0, pages: 0 },
        trace_id: traceId,
      });
    }
    Object.assign(query, scope);
  }
  const result = await callArtha({ path: '/invoices', query, tenantId: tenantOf(req), traceId });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

router.get('/invoices/:id/pdf', async (req, res) => {
  const traceId = traceOf(req);
  const id = safeId(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, code: 'invalid_id', message: 'Invoice id is required' });
  }
  if (req.user?.role === 'customer') {
    // Ownership guard: customers may only fetch PDFs of their own invoices.
    const meta = await callArtha({ path: `/invoices/${id}`, tenantId: tenantOf(req), traceId });
    if (!meta.ok) return sendBridgeError(res, meta);
    const invoice = meta.body?.data || null;
    const scope = customerInvoiceScope(req.user);
    const invoiceEmail = String(invoice?.customerEmail || '').trim().toLowerCase();
    const invoiceGstin = String(invoice?.customerGSTIN || '').trim().toUpperCase();
    const emailMatch = scope.customerEmail && invoiceEmail === scope.customerEmail.trim().toLowerCase();
    const gstinMatch = scope.customerGSTIN && invoiceGstin === scope.customerGSTIN.trim().toUpperCase();
    if (!invoice || (!emailMatch && !gstinMatch)) {
      return res.status(403).json({
        success: false,
        code: 'forbidden',
        message: 'Invoice does not belong to this customer',
        trace_id: traceId,
      });
    }
  }
  const result = await callArthaRaw({ path: `/invoices/${id}/pdf`, tenantId: tenantOf(req), traceId });
  if (!result.ok) return sendBridgeError(res, result);
  res.setHeader('Content-Type', result.contentType);
  if (result.fileName) res.setHeader('Content-Disposition', result.fileName);
  res.setHeader('X-Trace-Id', result.traceId || traceId);
  return res.send(result.buffer);
});

router.get('/expenses', async (req, res) => {
  const traceId = traceOf(req);
  const result = await callArtha({ path: '/expenses', query: req.query, tenantId: tenantOf(req), traceId });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

/* ------------------------------------------------- compliance (GST and TDS) */

router.get('/compliance', async (req, res) => {
  const traceId = traceOf(req);
  const tenantId = tenantOf(req);
  const query = req.query;
  const sources = {};

  const run = async (key, path, queryOverride = query) => {
    const result = await callArtha({ path, query: queryOverride, tenantId, traceId });
    sources[key] = result.ok
      ? { ok: true, status: result.status }
      : { ok: false, code: result.kind, message: result.message };
    return result.ok ? result.body : null;
  };

  const [gstSummary, gstReturns, tdsSummary, tdsDashboard, tdsEntries, signals] = await Promise.all([
    run('gst_summary', '/gst/summary'),
    run('gst_returns', '/gst/returns'),
    run('tds_summary', '/tds/summary'),
    run('tds_dashboard', '/tds/dashboard'),
    run('tds_entries', '/tds/entries'),
    run('signals', '/compliance/signals'),
  ]);

  res.json({
    success: true,
    data: {
      gst: { summary: gstSummary, returns: gstReturns },
      tds: { summary: tdsSummary, dashboard: tdsDashboard, entries: tdsEntries },
      signals,
    },
    sources,
    trace_id: traceId,
  });
});

/* ------------------------------------- dealers / statements (distribution) */

router.get('/dealers', async (req, res) => {
  const traceId = traceOf(req);
  const result = await callArtha({ path: '/dealers', query: req.query, tenantId: tenantOf(req), traceId });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

router.get('/dealers/:id/summary', async (req, res) => {
  const traceId = traceOf(req);
  const id = safeId(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, code: 'invalid_id', message: 'Dealer id is required' });
  }
  const result = await callArtha({ path: `/dealers/${id}/summary`, tenantId: tenantOf(req), traceId });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

router.get('/statements', async (req, res) => {
  const traceId = traceOf(req);
  const result = await callArtha({ path: '/statements', query: req.query, tenantId: tenantOf(req), traceId });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

router.post('/statements/upload', parseUpload('statement'), async (req, res) => {
  const traceId = traceOf(req);
  if (!req.file) {
    return res.status(400).json({
      success: false,
      code: 'file_required',
      message: 'Statement file is required (field: statement)',
    });
  }
  const result = await callArthaMultipart({
    path: '/statements/upload',
    field: 'statement',
    buffer: req.file.buffer,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    fields: {
      accountNumber: req.body?.accountNumber,
      bankName: req.body?.bankName,
      accountHolderName: req.body?.accountHolderName,
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
      openingBalance: req.body?.openingBalance,
      closingBalance: req.body?.closingBalance,
    },
    tenantId: tenantOf(req),
    traceId,
  });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

/* ------------------------------------------------------ document ingestion */

router.post('/documents', parseUpload('file'), async (req, res) => {
  const traceId = traceOf(req);
  if (!req.file) {
    return res.status(400).json({
      success: false,
      code: 'file_required',
      message: 'Document file is required (field: file)',
    });
  }
  const result = await callArthaMultipart({
    path: '/upload',
    field: 'file',
    buffer: req.file.buffer,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    tenantId: tenantOf(req),
    traceId,
  });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

/* ------------------------------------------------------------ notifications */

router.get('/notifications', async (req, res) => {
  const traceId = traceOf(req);
  const result = await callArtha({
    path: '/notifications',
    query: req.query,
    tenantId: tenantOf(req),
    traceId,
  });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

router.get('/notifications/unread-count', async (req, res) => {
  const traceId = traceOf(req);
  const result = await callArtha({ path: '/notifications/unread-count', tenantId: tenantOf(req), traceId });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

router.put('/notifications/read-all', async (req, res) => {
  const traceId = traceOf(req);
  const result = await callArtha({ path: '/notifications/read-all', method: 'PUT', tenantId: tenantOf(req), traceId });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

router.put('/notifications/:id/read', async (req, res) => {
  const traceId = traceOf(req);
  const id = safeId(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, code: 'invalid_id', message: 'Notification id is required' });
  }
  const result = await callArtha({
    path: `/notifications/${id}/read`,
    method: 'PUT',
    tenantId: tenantOf(req),
    traceId,
  });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

/* ------------------------------------------------------------------- MITRA */

router.get('/mitra/capabilities', async (req, res) => {
  const traceId = traceOf(req);
  const result = await callArtha({ path: '/mitra/capabilities', tenantId: tenantOf(req), traceId });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

router.post('/mitra/chat', async (req, res) => {
  const traceId = traceOf(req);
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ success: false, code: 'message_required', message: 'Message is required' });
  }
  if (message.length > 4000) {
    return res.status(400).json({ success: false, code: 'message_too_long', message: 'Message exceeds 4000 characters' });
  }
  const result = await callArtha({
    path: '/mitra/chat',
    method: 'POST',
    body: { message },
    tenantId: tenantOf(req),
    traceId,
  });
  if (!result.ok) return sendBridgeError(res, result);
  return sendBridgeResult(res, result);
});

export default router;
