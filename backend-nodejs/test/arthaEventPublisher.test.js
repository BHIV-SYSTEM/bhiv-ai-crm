import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.SETU_HMAC_SECRET = 'test-secret';

const { signBody, buildEnvelope, emitEvent, newEventId } = await import(
  '../src/services/arthaEventPublisher.js'
);
const { default: ArthaEventLog } = await import('../src/models/ArthaEventLog.js');

const originalFetch = globalThis.fetch;
const originalFindOne = ArthaEventLog.findOne;
const originalCreate = ArthaEventLog.create;

function makeStore() {
  const rows = [];
  return {
    rows,
    async findOne(filter) {
      const hit = rows.find((r) =>
        Object.entries(filter).every(([k, v]) => String(r[k]) === String(v))
      );
      return hit || null;
    },
    async create(doc) {
      const dup = rows.find(
        (r) =>
          r.tenantId === doc.tenantId &&
          r.eventType === doc.eventType &&
          r.idempotencyKey === doc.idempotencyKey
      );
      if (dup) {
        const err = new Error('dup');
        err.code = 11000;
        throw err;
      }
      const row = {
        attempts: 0,
        status: 'PENDING',
        ...doc,
        save: async function save() {
          return this;
        },
      };
      rows.push(row);
      return row;
    },
    restore() {
      ArthaEventLog.findOne = originalFindOne;
      ArthaEventLog.create = originalCreate;
    },
  };
}

function installStore() {
  const store = makeStore();
  ArthaEventLog.findOne = (filter) => store.findOne(filter);
  ArthaEventLog.create = (doc) => store.create(doc);
  return store;
}

function fetchResponder(handler) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return handler({ url, opts }, calls.length);
  };
  return calls;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test('signBody produces a stable HMAC-SHA256 hex digest', () => {
  const sig = signBody('{"a":1}', 'secret');
  const expected = crypto.createHmac('sha256', 'secret').update('{"a":1}').digest('hex');
  assert.equal(sig, expected);
  assert.match(sig, /^[0-9a-f]{64}$/);
});

test('buildEnvelope shape matches the ARTHA contract', () => {
  const env = buildEnvelope({
    eventId: 'EVT-1',
    eventType: 'order.confirmed',
    tenantId: 'tenant_sampada_001',
    idempotencyKey: 'ORD-1',
    payload: { orderNumber: 'ORD-1' },
    traceId: 'TRC-1',
  });
  assert.equal(env.event_id, 'EVT-1');
  assert.equal(env.event_type, 'order.confirmed');
  assert.equal(env.tenant_id, 'tenant_sampada_001');
  assert.equal(env.idempotency_key, 'ORD-1');
  assert.equal(env.trace_id, 'TRC-1');
  assert.deepEqual(env.payload, { orderNumber: 'ORD-1' });
  assert.ok(env.occurred_at);
  assert.match(newEventId(), /^EVT-\d{8}-[0-9a-f]{12}$/);
});

test('emitEvent sends a signed envelope and marks the log SYNCED', async () => {
  const store = installStore();
  const calls = fetchResponder(() =>
    jsonResponse(200, {
      success: true,
      data: { event_id: 'x', entity: { type: 'invoice', id: 'i1', number: 'SETU-ORD-1', status: 'draft' } },
    })
  );

  const result = await emitEvent({
    eventType: 'order.confirmed',
    tenantId: 'tenant_sampada_001',
    idempotencyKey: 'ORD-1',
    payload: { orderNumber: 'ORD-1' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.log.status, 'SYNCED');
  assert.equal(result.log.entity.number, 'SETU-ORD-1');
  assert.equal(calls.length, 1);

  const { opts } = calls[0];
  const body = opts.body;
  const parsed = JSON.parse(body);
  assert.equal(parsed.event_type, 'order.confirmed');
  assert.equal(
    opts.headers['X-Setu-Signature'],
    crypto.createHmac('sha256', 'test-secret').update(body).digest('hex')
  );
  assert.equal(opts.headers['X-Event-Id'], parsed.event_id);
  assert.equal(opts.headers['X-Source-System'], 'setu');

  store.restore();
  globalThis.fetch = originalFetch;
});

test('emitEvent is a no-op replay when the log is already SYNCED', async () => {
  const store = installStore();
  const calls = fetchResponder(() => jsonResponse(200, { success: true, data: {} }));

  await emitEvent({
    eventType: 'order.confirmed',
    tenantId: 'tenant_sampada_001',
    idempotencyKey: 'ORD-2',
    payload: { orderNumber: 'ORD-2' },
  });
  const replay = await emitEvent({
    eventType: 'order.confirmed',
    tenantId: 'tenant_sampada_001',
    idempotencyKey: 'ORD-2',
    payload: { orderNumber: 'ORD-2' },
  });

  assert.equal(replay.ok, true);
  assert.equal(replay.skipped, true);
  assert.equal(calls.length, 1);

  store.restore();
  globalThis.fetch = originalFetch;
});

test('terminal 4xx marks FAILED without retrying', async () => {
  const store = installStore();
  const calls = fetchResponder(() => jsonResponse(400, { success: false, code: 'invalid_envelope', message: 'bad' }));

  const result = await emitEvent({
    eventType: 'order.confirmed',
    tenantId: 'tenant_sampada_001',
    idempotencyKey: 'ORD-3',
    payload: {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.terminal, true);
  assert.equal(result.log.status, 'FAILED');
  assert.equal(calls.length, 1);

  store.restore();
  globalThis.fetch = originalFetch;
});

test('5xx retries then succeeds', async () => {
  const store = installStore();
  const calls = fetchResponder((_, n) =>
    n < 3
      ? jsonResponse(503, { success: false, message: 'down' })
      : jsonResponse(200, { success: true, data: { entity: { id: 'i3' } } })
  );

  const result = await emitEvent({
    eventType: 'order.confirmed',
    tenantId: 'tenant_sampada_001',
    idempotencyKey: 'ORD-4',
    payload: { orderNumber: 'ORD-4' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.log.status, 'SYNCED');
  assert.equal(calls.length, 3);

  store.restore();
  globalThis.fetch = originalFetch;
});

test('emitEvent refuses to send without an HMAC secret', async () => {
  const store = installStore();
  delete process.env.SETU_HMAC_SECRET;
  delete process.env.HMAC_SECRET;
  const calls = fetchResponder(() => jsonResponse(200, { success: true }));

  const result = await emitEvent({
    eventType: 'order.confirmed',
    tenantId: 'tenant_sampada_001',
    idempotencyKey: 'ORD-5',
    payload: {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.kind, 'not_configured');
  assert.equal(calls.length, 0);

  process.env.SETU_HMAC_SECRET = 'test-secret';
  store.restore();
  globalThis.fetch = originalFetch;
});
