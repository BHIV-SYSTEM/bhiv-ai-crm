import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import {
  REPORT_TYPES,
  parseClientMap,
  getClientBridge,
  signBridgeToken,
  buildQueryString,
  newTraceId,
  callArtha,
  checkStatus,
} from '../src/services/arthaBridge.service.js';

const ORIGINAL_ENV = { ...process.env };

function withEnv(vars, fn) {
  Object.assign(process.env, vars);
  const restore = () => {
    Object.keys(vars).forEach((key) => {
      if (key in ORIGINAL_ENV) process.env[key] = ORIGINAL_ENV[key];
      else delete process.env[key];
    });
  };
  let result;
  try {
    result = fn();
  } catch (err) {
    restore();
    throw err;
  }
  if (result && typeof result.then === 'function') {
    return result.finally(restore);
  }
  restore();
  return result;
}

test('parseClientMap returns {} for empty, invalid and non-object values', () => {
  assert.deepEqual(parseClientMap(undefined), {});
  assert.deepEqual(parseClientMap(''), {});
  assert.deepEqual(parseClientMap('not-json'), {});
  assert.deepEqual(parseClientMap('[1,2,3]'), {});
  assert.deepEqual(parseClientMap('null'), {});
});

test('parseClientMap parses a valid tenant map', () => {
  const map = parseClientMap(
    JSON.stringify({ tenant_a: { user_id: 'u1', company_id: 'c1', email: 'a@x.com', name: 'A' } })
  );
  assert.equal(map.tenant_a.user_id, 'u1');
  assert.equal(map.tenant_a.company_id, 'c1');
});

test('getClientBridge resolves only mapped tenants with a user_id', () => {
  const map = { tenant_ok: { user_id: 'u1' }, tenant_bad: { company_id: 'c' } };
  assert.equal(getClientBridge('tenant_ok', map)?.user_id, 'u1');
  assert.equal(getClientBridge('tenant_bad', map), null);
  assert.equal(getClientBridge('tenant_missing', map), null);
  assert.equal(getClientBridge(null, map), null);
});

test('signBridgeToken throws bridge_not_configured without ARTHA_JWT_SECRET', () => {
  withEnv({ ARTHA_JWT_SECRET: '' }, () => {
    assert.throws(
      () => signBridgeToken({ user_id: 'u1' }, ''),
      (err) => err.code === 'bridge_not_configured'
    );
  });
});

test('signBridgeToken throws bridge_not_provisioned without user_id', () => {
  withEnv({ ARTHA_JWT_SECRET: 'setu-test-secret' }, () => {
    assert.throws(
      () => signBridgeToken({}),
      (err) => err.code === 'bridge_not_provisioned'
    );
  });
});

test('signBridgeToken mints a viewer-scoped HS256 token carrying user_id', () => {
  withEnv({ ARTHA_JWT_SECRET: 'setu-test-secret' }, () => {
    const token = signBridgeToken({ user_id: 'artha_user_1', company_id: 'co_1', email: 'c@x.com', name: 'Client' });
    const decoded = jwt.verify(token, 'setu-test-secret');
    assert.equal(decoded.user_id, 'artha_user_1');
    assert.equal(decoded.scope, 'setu_client_read');
    assert.deepEqual(decoded.roles, ['viewer']);
    assert.ok(decoded.exp > Math.floor(Date.now() / 1000));
  });
});

test('buildQueryString skips empty values and expands arrays', () => {
  assert.equal(buildQueryString({ a: 1, b: 'x', c: '', d: null, e: undefined }), '?a=1&b=x');
  assert.equal(buildQueryString({ tag: ['p', 'q'] }), '?tag=p&tag=q');
  assert.equal(buildQueryString({}), '');
});

test('REPORT_TYPES resolves known reports and rejects unknown ones', () => {
  assert.equal(REPORT_TYPES['profit-loss'], 'profit-loss');
  assert.equal(REPORT_TYPES.pnl, 'profit-loss');
  assert.equal(REPORT_TYPES['balance-sheet'], 'balance-sheet');
  assert.equal(REPORT_TYPES['giant-secret-report'], undefined);
});

test('newTraceId follows the TRC-YYYYMMDD-8hex convention', () => {
  const traceId = newTraceId();
  assert.match(traceId, /^TRC-\d{8}-[0-9a-f]{8}$/);
});

test('callArtha returns not_provisioned for unmapped tenants without any network call', async () => {
  withEnv(
    { ARTHA_API_URL: 'http://127.0.0.1:1', ARTHA_JWT_SECRET: 'setu-test-secret', ARTHA_CLIENT_MAP: '{}' },
    async () => {
      const result = await callArtha({ path: '/invoices', tenantId: 'tenant_unmapped' });
      assert.equal(result.ok, false);
      assert.equal(result.kind, 'not_provisioned');
      assert.equal(result.status, 403);
    }
  );
});

test('callArtha returns not_configured when ARTHA_JWT_SECRET is missing', async () => {
  withEnv(
    {
      ARTHA_API_URL: 'http://127.0.0.1:1',
      ARTHA_JWT_SECRET: '',
      ARTHA_CLIENT_MAP: JSON.stringify({ tenant_a: { user_id: 'u1', company_id: 'c1' } }),
    },
    async () => {
      const result = await callArtha({ path: '/invoices', tenantId: 'tenant_a' });
      assert.equal(result.ok, false);
      assert.equal(result.kind, 'not_configured');
      assert.equal(result.status, 503);
    }
  );
});

test('callArtha returns unreachable for a dead upstream with a mapped tenant', async () => {
  withEnv(
    {
      ARTHA_API_URL: 'http://127.0.0.1:1',
      ARTHA_JWT_SECRET: 'setu-test-secret',
      ARTHA_CLIENT_MAP: JSON.stringify({ tenant_a: { user_id: 'u1', company_id: 'c1' } }),
      ARTHA_TIMEOUT_MS: '2000',
    },
    async () => {
      const result = await callArtha({ path: '/invoices', tenantId: 'tenant_a' });
      assert.equal(result.ok, false);
      assert.ok(['unreachable', 'timeout'].includes(result.kind), `unexpected kind: ${result.kind}`);
      assert.ok(result.traceId);
    }
  );
});

test('checkStatus reports configuration honestly for an unmapped tenant', async () => {
  withEnv(
    {
      ARTHA_API_URL: 'http://127.0.0.1:1',
      ARTHA_JWT_SECRET: '',
      ARTHA_CLIENT_MAP: '{}',
    },
    async () => {
      const status = await checkStatus('tenant_x');
      assert.equal(status.configured, true);
      assert.equal(status.token_configured, false);
      assert.equal(status.tenant_mapped, false);
      assert.equal(status.reachable, false);
      assert.equal(status.tenant_id, 'tenant_x');
    }
  );
});
