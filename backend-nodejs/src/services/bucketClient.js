/**
 * bucketClient.js — BHIV SETU Client for External Bucket Service
 *
 * Provides outward HTTP integration with the standalone bhiv-bucket service,
 * supporting governance-gated artifact submission, evidence storage, and provenance.
 * Uses native Node.js fetch (zero external HTTP dependencies).
 */

import crypto from 'crypto';

const BUCKET_BASE_URL = process.env.BUCKET_BASE_URL || 'http://localhost:8002';
const BUCKET_API_KEY = process.env.BUCKET_API_KEY || '';
const BUCKET_TIMEOUT_MS = parseInt(process.env.BUCKET_TIMEOUT_MS || '5000', 10);

const SETU_INTEGRATION_ID = 'bhiv-setu-logistics';

export class BucketClient {
  static getBaseUrl() {
    return BUCKET_BASE_URL;
  }

  static getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'x-source': 'setu',
    };
    if (BUCKET_API_KEY) {
      headers['x-api-key'] = BUCKET_API_KEY;
    }
    return headers;
  }

  static async checkHealth() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), BUCKET_TIMEOUT_MS);
      const res = await fetch(`${BUCKET_BASE_URL}/health`, {
        headers: this.getHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  static async validateArtifactAdmission(artifactType, payloadSizeBytes) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), BUCKET_TIMEOUT_MS);
      const url = new URL(`${BUCKET_BASE_URL}/governance/gate/validate-operation`);
      url.searchParams.set('operation_type', 'CREATE');
      url.searchParams.set('artifact_class', artifactType);
      url.searchParams.set('data_size', String(payloadSizeBytes));
      url.searchParams.set('integration_id', SETU_INTEGRATION_ID);

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: this.getHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        return {
          valid: false,
          reason: body?.detail?.reason || 'governance_rejected',
        };
      }
      const data = await res.json().catch(() => ({}));
      return { valid: res.ok, response: data };
    } catch (err) {
      return { valid: true, fallback: true, warning: err.message };
    }
  }

  static buildArtifactEnvelope({ artifactType, traceId, executionId, payload, tenantId }) {
    const timestamp = new Date().toISOString();
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const contentHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    return {
      envelope_version: '1.0.0',
      artifact_id: `art_${crypto.randomUUID()}`,
      artifact_type: artifactType || 'evidence_records',
      trace_id: traceId,
      execution_id: executionId,
      tenant_id: tenantId || 'tenant_bright_connection',
      source_system: 'setu',
      timestamp,
      content_hash: contentHash,
      payload: payload,
    };
  }

  static async storeEvidenceRecord({ traceId, executionId, entityType, fileReference, ocrData, coordinates, metadata = {} }) {
    const envelope = this.buildArtifactEnvelope({
      artifactType: 'evidence_records',
      traceId,
      executionId,
      payload: {
        entity_type: entityType,
        file_reference: fileReference,
        ocr_data: ocrData,
        coordinates,
        metadata,
      },
    });

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), BUCKET_TIMEOUT_MS);
      const res = await fetch(`${BUCKET_BASE_URL}/bucket/artifacts/write`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(envelope),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: true, artifact_id: envelope.artifact_id, response: data };
      }
      return {
        success: false,
        artifact_id: envelope.artifact_id,
        status: res.status,
        offline_queued: true,
      };
    } catch (err) {
      return {
        success: false,
        artifact_id: envelope.artifact_id,
        error: err.message,
        envelope,
        offline_queued: true,
      };
    }
  }
}

export default BucketClient;
