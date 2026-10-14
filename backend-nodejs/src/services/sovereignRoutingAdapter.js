/**
 * sovereignRoutingAdapter.js — SETU Sovereign Routing Adapter (Node.js Edition)
 *
 * Multi-tenant data isolation routing for sovereign / high-compliance payload handling.
 */

export const REQUIRED_FIELDS = [
  'execution_id',
  'trace_id',
  'source_system',
  'actor',
  'intent_type',
  'target_system',
  'parameters',
  'priority',
  'timestamp',
  'schema_version',
  'tenant_id',
];

export const REQUIRED_GATED_FIELDS = [
  'status',
  'attestation_id',
  'policy_id',
  'policy_version',
  'checked_at',
];

export class SovereignRoutingAdapter {
  static assertRequiredFields(execution = {}) {
    const missing = REQUIRED_FIELDS.filter(field => execution[field] === undefined || execution[field] === null);
    if (missing.length > 0) {
      throw new Error(`Missing execution fields: ${missing.join(', ')}`);
    }
  }

  static validateGatedBridge(execution = {}) {
    const gated = execution.governance ? execution.governance.gated_bridge : null;
    if (!gated) {
      return { ok: false, reason: 'gated_bridge_missing' };
    }

    const missing = REQUIRED_GATED_FIELDS.filter(field => gated[field] === undefined || gated[field] === null);
    if (missing.length > 0) {
      return { ok: false, reason: 'gated_bridge_incomplete', missing_fields: missing };
    }

    if (gated.status !== 'approved') {
      return { ok: false, reason: 'gated_bridge_not_approved', status: gated.status };
    }

    return { ok: true, governance: { gated_bridge: gated } };
  }

/**
   * Routing block handed to Sarathi. Mirrors buildSarathiPayload() in
   * integration/sovereign_routing_adapter.js — keep the two in lockstep.
   */
  static buildSarathiPayload(execution = {}) {
    return {
      sarathi_version: '1.0',
      execution_id: execution.execution_id,
      trace_id: execution.trace_id,
      tenant_id: execution.tenant_id,
      intent_type: execution.intent_type,
      source_system: execution.source_system,
      target_system: execution.target_system,
      parameters: execution.parameters,
      priority: execution.priority,
      timestamp: execution.timestamp,
      schema_version: execution.schema_version,
      actor: execution.actor,
    };
  }

  static toSarathiPayload(execution = {}) {
    this.assertRequiredFields(execution);
    return this.buildSarathiPayload(execution);
  }

  static toBhivEnvelope(execution = {}) {
    this.assertRequiredFields(execution);
    const sarathiPayload = this.buildSarathiPayload(execution);
    return {
      envelope_version: '1.0',
      execution: {
        execution_id: execution.execution_id,
        trace_id: execution.trace_id,
        tenant_id: execution.tenant_id,
        intent_type: execution.intent_type,
        source_system: execution.source_system,
        target_system: execution.target_system,
        parameters: execution.parameters,
        priority: execution.priority,
        timestamp: execution.timestamp,
        schema_version: execution.schema_version,
        actor: execution.actor,
      },
      routing: sarathiPayload,
      governance: execution.governance,
      provenance: execution.provenance,
      replay: execution.replay,
    };
  }

  static buildRoutingPacket(execution = {}) {
    try {
      this.assertRequiredFields(execution);
    } catch (error) {
      return {
        ok: false,
        reason: 'execution_contract_invalid',
        details: error.message,
      };
    }

    const gated = this.validateGatedBridge(execution);
    if (!gated.ok) {
      return {
        ok: false,
        reason: gated.reason,
        details: gated.missing_fields || gated.status,
      };
    }

    const sarathiPayload = this.buildSarathiPayload(execution);
    const bhivEnvelope = this.toBhivEnvelope(execution);

    return {
      ok: true,
      sarathi_payload: sarathiPayload,
      bhiv_envelope: bhivEnvelope,
      governance: gated.governance,
    };
  }
}

export default SovereignRoutingAdapter;

