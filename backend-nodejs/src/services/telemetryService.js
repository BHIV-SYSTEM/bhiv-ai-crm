import mongoose from 'mongoose';

/**
 * telemetryService.js — SETU Telemetry Layer Service (Node.js Edition)
 *
 * Real-time metric counter and event emitter for execution telemetry.
 */

export const TELEMETRY_TYPES = [
  'execution_started',
  'execution_failed',
  'execution_completed',
  'execution_blocked',
  'governance_rejection',
  'dependency_blocked',
  'tenant_rejection',
];

// MongoDB Schema for SETU Telemetry
const setuTelemetrySchema = new mongoose.Schema({
  telemetry_id: { type: String, required: true, unique: true },
  event_type: { type: String, required: true, index: true },
  execution_id: { type: String, required: true, index: true },
  trace_id: { type: String, required: true, index: true },
  tenant_id: { type: String, required: true, index: true },
  timestamp: { type: String, required: true },
  details: { type: Object, default: {} },
  source_system: { type: String, default: 'setu' },
}, { timestamps: true });

const SetuTelemetry = mongoose.models.SetuTelemetry || mongoose.model('SetuTelemetry', setuTelemetrySchema);

export class TelemetryService {
  /**
   * Emit a telemetry event
   */
  static async emit(event) {
    const requiredFields = ['execution_id', 'trace_id', 'tenant_id', 'timestamp', 'event_type'];
    const missing = requiredFields.filter(field => !event[field]);

    if (missing.length > 0) {
      throw new Error(`Telemetry missing required fields: ${missing.join(', ')}`);
    }

    if (!TELEMETRY_TYPES.includes(event.event_type)) {
      throw new Error(`Unsupported telemetry type: ${event.event_type}`);
    }

    const telemetryId = `tel_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 15)}_${Math.random().toString(36).substring(2, 7)}`;

    const storedEvent = {
      telemetry_id: telemetryId,
      event_type: event.event_type,
      execution_id: event.execution_id,
      trace_id: event.trace_id,
      tenant_id: event.tenant_id,
      timestamp: event.timestamp,
      details: event.details || {},
      source_system: event.source_system || 'setu',
    };

    if (mongoose.connection.readyState === 1) {
      await SetuTelemetry.create(storedEvent);
    }

    return storedEvent;
  }

  static buildEvent(eventType, execution, details = {}, overrides = {}) {
    return {
      event_type: eventType,
      execution_id: execution.execution_id,
      trace_id: execution.trace_id,
      tenant_id: execution.tenant_id,
      timestamp: overrides.timestamp || execution.timestamp || new Date().toISOString(),
      details: details || {},
      source_system: execution.source_system || 'setu',
    };
  }

  static async emitExecutionStarted(execution, details = {}, overrides = {}) {
    return await this.emit(this.buildEvent('execution_started', execution, details, overrides));
  }

  static async emitExecutionFailed(execution, details = {}, overrides = {}) {
    return await this.emit(this.buildEvent('execution_failed', execution, details, overrides));
  }

  static async emitExecutionCompleted(execution, details = {}, overrides = {}) {
    return await this.emit(this.buildEvent('execution_completed', execution, details, overrides));
  }
}

export default TelemetryService;
