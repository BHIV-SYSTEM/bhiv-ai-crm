import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

/**
 * arthaBridge.service.js — SETU → ARTHA financial API bridge.
 *
 * Gives an authenticated SETU client (tenant) a server-side minted, read-scoped
 * ARTHA identity so ARTHA enforces company isolation and role permissions itself.
 *
 * Rules enforced here:
 *  - Company context comes ONLY from the server-side ARTHA_CLIENT_MAP keyed by the
 *    authenticated SETU tenant. Nothing sent by the browser selects a company.
 *  - No accounting write endpoints are proxied. Only read APIs, document upload
 *    (ingestion) and MITRA chat are reachable through this bridge.
 *  - Failures are reported honestly (not_configured / not_provisioned /
 *    unreachable / upstream error). Never substitutes placeholder financial data.
 */

const DEFAULT_ARTHA_URL = 'http://localhost:5000';
const DEFAULT_TIMEOUT_MS = 10000;
const UPLOAD_TIMEOUT_MS = 60000;

/** Allow-list of report types exposed to clients (path fragments under /api/v1/reports). */
export const REPORT_TYPES = Object.freeze({
  'profit-loss': 'profit-loss',
  pnl: 'profit-loss',
  'balance-sheet': 'balance-sheet',
  'cash-flow': 'cash-flow',
  'trial-balance': 'trial-balance',
  'aged-receivables': 'aged-receivables',
  'period-context': 'period-context',
  dashboard: 'dashboard',
});

export function getArthaBaseUrl() {
  return (process.env.ARTHA_API_URL || DEFAULT_ARTHA_URL).replace(/\/$/, '');
}

export function getArthaTimeoutMs() {
  const raw = Number(process.env.ARTHA_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/**
 * Parse ARTHA_CLIENT_MAP env (JSON) safely.
 * Shape: { "<tenant_id>": { "user_id": "...", "company_id": "...", "email": "...", "name": "..." } }
 */
export function parseClientMap(raw = process.env.ARTHA_CLIENT_MAP) {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return {};
  } catch {
    return {};
  }
}

export function getClientBridge(tenantId, map = parseClientMap()) {
  if (!tenantId) return null;
  const entry = map[tenantId];
  if (!entry || typeof entry !== 'object' || !entry.user_id) return null;
  return entry;
}

/**
 * Mint an ARTHA-compatible HS256 token. ARTHA's protect middleware hydrates the
 * user (role + companyId) from its own database, so the DB — not this token —
 * remains the authority for roles and company scope.
 */
export function signBridgeToken(entry, secret = process.env.ARTHA_JWT_SECRET) {
  if (!secret) {
    const err = new Error('ARTHA_JWT_SECRET is not configured on SETU');
    err.code = 'bridge_not_configured';
    throw err;
  }
  if (!entry?.user_id) {
    const err = new Error('Bridge entry is missing user_id');
    err.code = 'bridge_not_provisioned';
    throw err;
  }
  return jwt.sign(
    {
      user_id: entry.user_id,
      email: entry.email || `setu-bridge@${entry.company_id || 'tenant'}.local`,
      name: entry.name || 'SETU Client',
      roles: ['viewer'],
      allowedApps: [],
      scope: 'setu_client_read',
    },
    secret,
    { expiresIn: process.env.ARTHA_BRIDGE_TOKEN_TTL || '1h' }
  );
}

/**
 * Per-user SSO identity provisioning (SETU staff → their own ARTHA account).
 *
 * ARTHA exposes a server-to-server `POST /api/v1/bridge/provision` endpoint
 * guarded by a bridge ADMIN token (shared JWT secret + `scope` claim). Given a
 * SETU person's email/name/role and the tenant's company, it find-or-creates
 * the matching ARTHA user and returns its id. Every SETU admin therefore gets
 * their OWN ARTHA company-Admin identity (and can manage accountants/viewers
 * inside ARTHA), instead of all sharing one accountant service account.
 */
const PROVISION_TTL_MS = 10 * 60 * 1000;
const provisionCache = new Map(); // `${companyId}:${email}` -> { userId, at }

export function signBridgeAdminToken(entry, secret = process.env.ARTHA_JWT_SECRET) {
  if (!secret) {
    const err = new Error('ARTHA_JWT_SECRET is not configured on SETU');
    err.code = 'bridge_not_configured';
    throw err;
  }
  if (!entry?.user_id) {
    const err = new Error('Bridge entry is missing user_id');
    err.code = 'bridge_not_provisioned';
    throw err;
  }
  return jwt.sign(
    {
      user_id: entry.user_id,
      email: entry.email || 'setu-bridge@artha.local',
      name: entry.name || 'SETU Bridge',
      roles: ['viewer'],
      allowedApps: [],
      scope: 'setu_client_admin',
    },
    secret,
    { expiresIn: '5m' }
  );
}

/**
 * Find-or-create the ARTHA identity for one SETU person. Returns the ARTHA
 * user id, or null on any failure (caller falls back to the shared account).
 */
export async function provisionArthaIdentity({ entry, email, name, role, timeoutMs }) {
  const key = `${entry?.company_id || ''}:${String(email || '').toLowerCase()}`;
  const hit = provisionCache.get(key);
  if (hit && Date.now() - hit.at < PROVISION_TTL_MS) return hit.userId;

  let token;
  try {
    token = signBridgeAdminToken(entry);
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || getArthaTimeoutMs());
  try {
    const res = await fetch(`${getArthaBaseUrl()}/api/v1/bridge/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Source-System': 'setu',
      },
      body: JSON.stringify({
        email,
        name,
        role,
        companyId: entry?.company_id,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const parsed = await res.json();
    const userId = parsed?.data?.user_id;
    if (userId) {
      provisionCache.set(key, { userId, at: Date.now() });
      return userId;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function newTraceId() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `TRC-${y}${m}${d}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

export function buildQueryString(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else params.append(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Map network/HTTP failures into honest, typed bridge results. */
function failure(kind, status, message, extra = {}) {
  return { ok: false, kind, status, message, ...extra };
}

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: text.slice(0, 500) };
  }
}

/**
 * Core caller. Returns:
 *   { ok: true,  status, body }
 *   { ok: false, kind: 'not_configured'|'not_provisioned'|'token_error'|'unreachable'|'timeout'|'upstream', status, message, traceId }
 */
export async function callArtha({
  path,
  method = 'GET',
  query,
  body,
  tenantId,
  traceId = newTraceId(),
  contentType = 'application/json',
  timeoutMs,
}) {
  const baseUrl = getArthaBaseUrl();
  const entry = getClientBridge(tenantId);
  if (!entry) {
    return failure(
      'not_provisioned',
      403,
      'This client workspace is not provisioned for financial data access yet',
      { traceId }
    );
  }

  let token;
  try {
    token = signBridgeToken(entry);
  } catch (err) {
    return failure(err.code === 'bridge_not_configured' ? 'not_configured' : 'token_error', 503, err.message, {
      traceId,
    });
  }

  const url = `${baseUrl}/api/v1${path}${buildQueryString(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || getArthaTimeoutMs());

  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Trace-Id': traceId,
    'X-Source-System': 'setu',
    'X-SetU-Tenant': String(tenantId || ''),
  };
  if (body !== undefined && contentType === 'application/json') {
    headers['Content-Type'] = 'application/json';
  } else if (contentType !== 'application/json') {
    headers['Content-Type'] = contentType;
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined && method !== 'GET' ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const parsed = await readJsonResponse(res);
    if (res.ok) {
      return { ok: true, status: res.status, body: parsed ?? { success: true }, traceId };
    }
    const upstreamMessage =
      parsed?.message || parsed?.detail || `ARTHA responded with HTTP ${res.status}`;
    return failure('upstream', res.status, upstreamMessage, { traceId, body: parsed });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return failure('timeout', 504, 'ARTHA financial API did not respond in time', { traceId });
    }
    return failure('unreachable', 503, 'ARTHA financial API is unreachable', { traceId });
  } finally {
    clearTimeout(timer);
  }
}

/** Binary passthrough for files (e.g. invoice PDF). */
export async function callArthaRaw({ path, query, tenantId, traceId = newTraceId(), timeoutMs }) {
  const baseUrl = getArthaBaseUrl();
  const entry = getClientBridge(tenantId);
  if (!entry) {
    return failure('not_provisioned', 403, 'This client workspace is not provisioned for financial data access yet', {
      traceId,
    });
  }
  let token;
  try {
    token = signBridgeToken(entry);
  } catch (err) {
    return failure(err.code === 'bridge_not_configured' ? 'not_configured' : 'token_error', 503, err.message, {
      traceId,
    });
  }

  const url = `${baseUrl}/api/v1${path}${buildQueryString(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || getArthaTimeoutMs());
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Trace-Id': traceId,
        'X-Source-System': 'setu',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const parsed = await readJsonResponse(res);
      return failure('upstream', res.status, parsed?.message || `ARTHA responded with HTTP ${res.status}`, {
        traceId,
        body: parsed,
      });
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return {
      ok: true,
      status: 200,
      buffer,
      contentType: res.headers.get('content-type') || 'application/octet-stream',
      fileName: res.headers.get('content-disposition'),
      traceId,
    };
  } catch (err) {
    if (err?.name === 'AbortError') {
      return failure('timeout', 504, 'ARTHA financial API did not respond in time', { traceId });
    }
    return failure('unreachable', 503, 'ARTHA financial API is unreachable', { traceId });
  } finally {
    clearTimeout(timer);
  }
}

/** Multipart passthrough for document/statement ingestion. */
export async function callArthaMultipart({ path, field, buffer, filename, mimetype, fields = {}, tenantId, traceId = newTraceId() }) {
  const baseUrl = getArthaBaseUrl();
  const entry = getClientBridge(tenantId);
  if (!entry) {
    return failure('not_provisioned', 403, 'This client workspace is not provisioned for document upload yet', {
      traceId,
    });
  }
  let token;
  try {
    token = signBridgeToken(entry);
  } catch (err) {
    return failure(err.code === 'bridge_not_configured' ? 'not_configured' : 'token_error', 503, err.message, {
      traceId,
    });
  }

  const form = new FormData();
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
  });
  form.append(field, new Blob([buffer], { type: mimetype || 'application/octet-stream' }), filename || 'upload');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Trace-Id': traceId,
        'X-Source-System': 'setu',
        'X-SetU-Tenant': String(tenantId || ''),
      },
      body: form,
      signal: controller.signal,
    });
    const parsed = await readJsonResponse(res);
    if (res.ok) {
      return { ok: true, status: res.status, body: parsed ?? { success: true }, traceId };
    }
    return failure('upstream', res.status, parsed?.message || `ARTHA responded with HTTP ${res.status}`, {
      traceId,
      body: parsed,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return failure('timeout', 504, 'ARTHA did not accept the upload in time', { traceId });
    }
    return failure('unreachable', 503, 'ARTHA financial API is unreachable', { traceId });
  } finally {
    clearTimeout(timer);
  }
}

/** Integration health for the client workspace (honest, no fake data). */
export async function checkStatus(tenantId) {
  const entry = getClientBridge(tenantId);
  const status = {
    baseUrl: getArthaBaseUrl(),
    configured: !!process.env.ARTHA_API_URL || !!DEFAULT_ARTHA_URL,
    token_configured: !!process.env.ARTHA_JWT_SECRET,
    tenant_id: tenantId || null,
    tenant_mapped: !!entry,
    company_id: entry?.company_id || null,
    reachable: false,
  };
  if (!status.token_configured || !entry) return status;
  const probe = await callArtha({ path: '/mitra/health', tenantId, timeoutMs: 4000 });
  status.reachable = probe.ok;
  if (!probe.ok) status.probe_error = { code: probe.kind, message: probe.message };
  return status;
}

/** Send a bridge failure as an HTTP response with a stable machine-readable code. */
export function sendBridgeError(res, result) {
  return res.status(result.status || 503).json({
    success: false,
    code: result.kind || 'bridge_error',
    message: result.message || 'Financial integration error',
    trace_id: result.traceId || null,
    ...(result.body ? { upstream: result.body } : {}),
  });
}

/** Forward a successful bridge result as-is (ARTHA owns the response contract). */
export function sendBridgeResult(res, result) {
  if (result.body === null || result.body === undefined) {
    return res.status(result.status || 200).json({ success: true });
  }
  return res.status(result.status || 200).json(result.body);
}
