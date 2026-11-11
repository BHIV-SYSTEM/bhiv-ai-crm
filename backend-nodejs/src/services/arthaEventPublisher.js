import crypto from 'node:crypto';
import ArthaEventLog from '../models/ArthaEventLog.js';
import User from '../models/User.js';

const arthaBaseUrl = () => (process.env.ARTHA_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const hmacSecret = () => process.env.SETU_HMAC_SECRET || process.env.HMAC_SECRET || null;
const eventTimeoutMs = () => {
  const n = Number(process.env.ARTHA_EVENT_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 10000;
};
const MAX_ATTEMPTS = 3;

export const newEventId = () =>
  `EVT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

export const newTraceId = () =>
  `TRC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8)}`;

export function signBody(bodyString, secret) {
  return crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
}

export function buildEnvelope({ eventId, eventType, tenantId, idempotencyKey, payload, traceId }) {
  return {
    event_id: eventId,
    event_type: eventType,
    tenant_id: tenantId,
    idempotency_key: idempotencyKey,
    occurred_at: new Date().toISOString(),
    trace_id: traceId,
    payload,
  };
}

async function postEnvelope(envelope) {
  const secret = hmacSecret();
  if (!secret) {
    return { ok: false, terminal: true, kind: 'not_configured', message: 'SETU_HMAC_SECRET is not configured' };
  }
  const bodyString = JSON.stringify(envelope);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), eventTimeoutMs());
  try {
    const res = await fetch(`${arthaBaseUrl()}/api/v1/setu/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Setu-Signature': signBody(bodyString, secret),
        'X-Trace-Id': envelope.trace_id,
        'X-Event-Id': envelope.event_id,
        'X-Idempotency-Key': envelope.idempotency_key || '',
        'X-Source-System': 'setu',
      },
      body: bodyString,
      signal: controller.signal,
    });
    let parsed = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
    if (res.ok && parsed && parsed.success) {
      return { ok: true, status: res.status, parsed };
    }
    const terminal =
      res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
    return {
      ok: false,
      terminal,
      status: res.status,
      kind: parsed?.code || 'upstream',
      message: parsed?.message || `ARTHA responded with HTTP ${res.status}`,
      parsed,
    };
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    return {
      ok: false,
      terminal: false,
      kind: isAbort ? 'timeout' : 'unreachable',
      message: isAbort ? 'ARTHA did not accept the event in time' : 'ARTHA is unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findLog(filter) {
  try {
    return await ArthaEventLog.findOne(filter);
  } catch {
    return null;
  }
}

export async function emitEvent({
  eventType,
  tenantId,
  idempotencyKey,
  payload,
  orderId = null,
  restockId = null,
}) {
  if (!tenantId) {
    return { ok: false, terminal: true, kind: 'no_tenant', message: 'No tenant id for event' };
  }
  if (!idempotencyKey) {
    return { ok: false, terminal: true, kind: 'no_key', message: 'No idempotency key for event' };
  }

  let log = await findLog({ tenantId, eventType, idempotencyKey });
  if (log && log.status === 'SYNCED') {
    return { ok: true, skipped: true, log };
  }

  if (!log) {
    try {
      log = await ArthaEventLog.create({
        eventId: newEventId(),
        eventType,
        tenantId,
        idempotencyKey,
        status: 'PENDING',
        attempts: 0,
        orderId,
        restockId,
      });
    } catch (err) {
      if (err && err.code === 11000) {
        log = await findLog({ tenantId, eventType, idempotencyKey });
      }
      if (!log) {
        return { ok: false, terminal: true, kind: 'log_create_failed', message: err.message };
      }
    }
  } else if (orderId && !log.orderId) {
    log.orderId = orderId;
  } else if (restockId && !log.restockId) {
    log.restockId = restockId;
  }

  const traceId = newTraceId();
  let lastResult = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    log.attempts = (log.attempts || 0) + 1;
    log.status = 'PENDING';
    try {
      await log.save();
    } catch {
      // keep going even if the status write fails; the send still happens
    }

    const envelope = buildEnvelope({
      eventId: log.eventId,
      eventType,
      tenantId,
      idempotencyKey,
      payload,
      traceId,
    });
    const result = await postEnvelope(envelope);
    lastResult = result;

    if (result.ok) {
      log.status = 'SYNCED';
      log.httpStatus = result.status;
      log.lastError = null;
      log.response = result.parsed?.data || result.parsed || null;
      log.entity = result.parsed?.data?.entity || null;
      try {
        await log.save();
      } catch {
        // ignore persistence failure; next emit re-checks by key
      }
      return { ok: true, log };
    }

    log.httpStatus = result.status || null;
    log.lastError = result.message || 'Event delivery failed';
    log.response = result.parsed || null;
    try {
      await log.save();
    } catch {
      // ignore
    }

    if (result.terminal) {
      log.status = 'FAILED';
      try {
        await log.save();
      } catch {
        // ignore
      }
      return { ok: false, terminal: true, kind: result.kind || 'upstream', log, message: result.message };
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(250 * 2 ** (attempt - 1));
    }
  }

  log.status = 'FAILED';
  try {
    await log.save();
  } catch {
    // ignore
  }
  return {
    ok: false,
    terminal: false,
    kind: lastResult?.kind || 'delivery_failed',
    log,
    message: lastResult?.message || 'Event delivery failed',
  };
}

async function resolveTenant(order, actorUser) {
  if (actorUser?.tenant_id) return actorUser.tenant_id;
  try {
    const customer = await User.findById(order.customerId).select('tenant_id');
    if (customer?.tenant_id) return customer.tenant_id;
  } catch {
    // fall through
  }
  return null;
}

export async function publishOrderConfirmed({ order, actorUser = null }) {
  const tenantId = await resolveTenant(order, actorUser);
  if (!tenantId) {
    return { ok: false, terminal: true, kind: 'no_tenant', message: 'Order has no resolvable tenant' };
  }

  let customer = null;
  if (actorUser && String(actorUser._id) === String(order.customerId)) {
    customer = actorUser;
  } else {
    try {
      customer = await User.findById(order.customerId);
    } catch {
      customer = null;
    }
  }

  const payload = {
    orderNumber: order.orderNumber,
    customerName: customer?.name || customer?.email || 'SETU Client',
    customerEmail: customer?.email,
    customerGSTIN: customer?.shopDetails?.gstNumber,
    items: (order.items || []).map((item) => ({
      description: item.productName || 'Item',
      quantity: item.quantity,
      unitPrice: item.price,
      amount: item.total,
    })),
    totalAmount: order.totalAmount,
    orderDate: order.tracking?.deliveredAt || order.createdAt || new Date(),
    notes: order.notes,
  };

  return emitEvent({
    eventType: 'order.confirmed',
    tenantId,
    idempotencyKey: order.orderNumber,
    payload,
    orderId: order._id,
  });
}

export async function publishOrderCancelled({ order, reason = null, actorUser = null }) {
  const tenantId = await resolveTenant(order, actorUser);
  if (!tenantId) {
    return { ok: false, terminal: true, kind: 'no_tenant', message: 'Order has no resolvable tenant' };
  }
  return emitEvent({
    eventType: 'order.cancelled',
    tenantId,
    idempotencyKey: order.orderNumber,
    payload: { orderNumber: order.orderNumber, reason },
    orderId: order._id,
  });
}

export async function publishPaymentReceived({
  tenantId,
  invoiceNumber = null,
  orderNumber = null,
  amount,
  paymentMethod = 'other',
  reference = null,
  paymentDate = null,
  notes = null,
}) {
  return emitEvent({
    eventType: 'payment.received',
    tenantId,
    idempotencyKey: reference || invoiceNumber || orderNumber,
    payload: { invoiceNumber, orderNumber, amount, paymentMethod, reference, paymentDate, notes },
  });
}

export async function publishPurchaseApproved({ request, product, receivedQuantity = null, actorUser = null }) {
  const tenantId = actorUser?.tenant_id;
  if (!tenantId) {
    return { ok: false, terminal: true, kind: 'no_tenant', message: 'Actor has no tenant id' };
  }

  const quantity = receivedQuantity || request.requestedQuantity || 0;
  const unitCost = Number(product?.costPrice) || 0;
  const totalAmount = Math.round(quantity * unitCost * 100) / 100;

  if (!(totalAmount > 0)) {
    return {
      ok: false,
      terminal: true,
      kind: 'invalid_amount',
      message: 'Cannot compute purchase value (quantity x cost price must be > 0)',
    };
  }

  const payload = {
    restockId: String(request._id),
    supplierName: request.supplierName || 'SETU Supplier',
    productName: request.productName,
    sku: request.sku,
    quantity,
    unitCost,
    totalAmount,
    date: request.restockedAt || new Date(),
    notes: request.notes,
  };

  return emitEvent({
    eventType: 'supplier.purchase-approved',
    tenantId,
    idempotencyKey: String(request._id),
    payload,
    restockId: request._id,
  });
}
