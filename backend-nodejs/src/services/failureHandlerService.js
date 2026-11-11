import mongoose from 'mongoose';

/**
 * failureHandlerService.js — Failure & Provenance Policy Handler Engine (Node.js Edition)
 *
 * Handles validation failures, missing source_context scenarios, and trace errors
 * with structured logging to MongoDB.
 *
 * Rule: No handler silently swallows or invents context — every failure is explicitly represented.
 */

// MongoDB Schema for SETU Failure Logs
const setuFailureLogSchema = new mongoose.Schema({
  failure_id: { type: String, required: true, unique: true },
  failure_type: { type: String, required: true, index: true },
  trace_id: { type: String, default: null, index: true },
  tenant_id: { type: String, default: null, index: true },
  reason: { type: String, required: true },
  details: { type: Object, default: {} },
  status_code: { type: Number, required: true },
  timestamp: { type: String, default: () => new Date().toISOString() },
}, { timestamps: true });

const SetuFailureLog = mongoose.models.SetuFailureLog || mongoose.model('SetuFailureLog', setuFailureLogSchema);

export class FailureHandlerService {
  /**
   * Internal helper to log failure records to MongoDB
   */
  static async logFailure(record) {
    try {
      if (mongoose.connection.readyState !== 1) {
        return; // Skip DB persistence if MongoDB is not connected (e.g. offline unit tests)
      }
      const failureId = `fail_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 15)}_${Math.random().toString(36).substring(2, 7)}`;
      const logDoc = new SetuFailureLog({
        failure_id: failureId,
        failure_type: record.failure_type,
        trace_id: record.trace_id || null,
        tenant_id: record.tenant_id || null,
        reason: record.reason,
        details: record.details || {},
        status_code: record.status_code,
        timestamp: record.timestamp || new Date().toISOString(),
      });
      await logDoc.save();
    } catch (err) {
      console.error('[FailureHandlerService] Failed to log failure record to MongoDB:', err.message);
    }
  }

  /**
   * Handle invalid trace_id failure
   */
  static async handleInvalidTraceId(traceId, tenantId = null) {
    const failureRecord = {
      failure_type: 'invalid_trace_id',
      trace_id: traceId,
      tenant_id: tenantId,
      reason: 'Invalid or malformed trace_id',
      details: {
        received_trace_id: traceId,
        validation_rules: 'trace_id must be non-empty string with minimum 8 characters',
      },
      timestamp: new Date().toISOString(),
      status_code: 400,
    };

    await this.logFailure(failureRecord);

    return {
      success: false,
      error: 'invalid_trace_id',
      message: 'Request rejected due to invalid trace_id',
      details: failureRecord.details,
      status_code: 400,
    };
  }

  /**
   * Handle missing required field failure
   */
  static async handleMissingRequiredField(missingFields, traceId = null, tenantId = null) {
    const failureRecord = {
      failure_type: 'missing_required_field',
      trace_id: traceId,
      tenant_id: tenantId,
      reason: 'Contract validation failure - missing required fields',
      details: {
        missing_fields: missingFields,
        required_fields: ['trace_id', 'entity_id', 'event_type', 'timestamp', 'tenant_id'],
      },
      timestamp: new Date().toISOString(),
      status_code: 400,
    };

    await this.logFailure(failureRecord);

    return {
      success: false,
      error: 'contract_validation_failure',
      message: 'Request rejected due to missing required fields',
      details: failureRecord.details,
      status_code: 400,
    };
  }

  /**
   * Handle unauthorized tenant failure
   */
  static async handleUnauthorizedTenant(tenantId, traceId = null, reason = 'Unauthorized tenant access') {
    const failureRecord = {
      failure_type: 'unauthorized_tenant',
      trace_id: traceId,
      tenant_id: tenantId,
      reason: reason,
      details: {
        attempted_tenant_id: tenantId,
        rejection_reason: 'Tenant not authorized for this operation',
      },
      timestamp: new Date().toISOString(),
      status_code: 403,
    };

    await this.logFailure(failureRecord);

    return {
      success: false,
      error: 'unauthorized_tenant',
      message: '403 rejection - tenant not authorized',
      details: failureRecord.details,
      status_code: 403,
    };
  }

  /**
   * Handle records arriving with missing or incomplete source_context (Task §4 + Test E)
   *
   * @param {string|null} traceId
   * @param {string|null} tenantId
   * @param {Array<string>} missingFields
   * @param {string} action - 'reject' (400), 'quarantine' (202), or 'incomplete' (202)
   */
  static async handleMissingSourceContext(traceId, tenantId, missingFields = [], action = 'quarantine') {
    const statusCodeMap = { reject: 400, quarantine: 202, incomplete: 202 };
    const statusCode = statusCodeMap[action] || 202;

    const failureRecord = {
      failure_type: 'missing_source_context',
      trace_id: traceId,
      tenant_id: tenantId,
      reason: 'Record arrived with missing or incomplete source_context',
      details: {
        missing_context_fields: missingFields,
        action: action,
        rule: 'source_context must include: source_system, connected_company_id, connected_company_name, source_entity, received_at. Missing values are NOT inferred.',
      },
      timestamp: new Date().toISOString(),
      status_code: statusCode,
    };

    await this.logFailure(failureRecord);

    const messageMap = {
      reject: 'Record rejected — mandatory source_context fields are missing.',
      quarantine: 'Record quarantined — source_context is incomplete. Manual review required.',
      incomplete: 'Record accepted as incomplete — source_context fields are missing.',
    };

    return {
      success: action !== 'reject',
      error: action === 'reject' ? 'missing_source_context_rejected' : null,
      quarantined: action === 'quarantine',
      incomplete: action === 'incomplete',
      source_context_available: false,
      message: messageMap[action] || 'Source context unavailable',
      details: failureRecord.details,
      status_code: statusCode,
    };
  }

  /**
   * Handle trace continuity errors
   */
  static async handleTraceContinuityError(errorCode, errorMessage, execution = {}, details = {}) {
    const failureRecord = {
      failure_type: 'trace_continuity_error',
      trace_id: execution.trace_id || null,
      tenant_id: execution.tenant_id || null,
      reason: errorMessage,
      details: {
        error_code: errorCode,
        error_details: details,
        execution_context: execution,
      },
      timestamp: new Date().toISOString(),
      status_code: 409,
    };

    await this.logFailure(failureRecord);

    return {
      success: false,
      error: errorCode,
      message: errorMessage,
      details: details,
      status_code: 409,
    };
  }
}

export default FailureHandlerService;
