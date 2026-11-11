import crypto from 'crypto';
import mongoose from 'mongoose';

/**
 * bucketLineageAdapter.js — SETU Bucket Lineage Adapter (Node.js Edition)
 *
 * Emits and verifies deterministic lineage events across execution traces.
 */

// MongoDB Schema for SETU Lineage Events
const setuLineageEventSchema = new mongoose.Schema({
  lineage_event_id: { type: String, required: true, unique: true },
  execution_id: { type: String, required: true, index: true },
  trace_id: { type: String, required: true, index: true },
  tenant_id: { type: String, required: true, index: true },
  event_type: { type: String, required: true },
  timestamp: { type: String, required: true },
  sequence: { type: Number, required: true },
  payload: { type: Object, default: {} },
  determinism_hash: { type: String, required: true },
}, { timestamps: true });

const SetuLineageEvent = mongoose.models.SetuLineageEvent || mongoose.model('SetuLineageEvent', setuLineageEventSchema);

/**
 * Computes deterministic SHA-256 hash for lineage event payload
 */
export function computeDeterminismHash(eventObj) {
  const content = `${eventObj.execution_id}|${eventObj.trace_id}|${eventObj.tenant_id}|${eventObj.event_type}|${eventObj.timestamp}|${eventObj.sequence}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

export class BucketLineageAdapter {
  /**
   * Emits a lineage event with deterministic hash and sequence counter
   */
  static async emitExecutionEvent(execution, eventType, payload = {}, overrides = {}) {
    if (!execution || !execution.execution_id || !execution.trace_id || !execution.tenant_id) {
      throw new Error('Execution identifiers (execution_id, trace_id, tenant_id) are required for lineage emission');
    }

    const timestamp = overrides.timestamp || execution.timestamp || new Date().toISOString();
    
    let sequence = overrides.sequence || 1;
    if (mongoose.connection.readyState === 1) {
      const lastEvent = await SetuLineageEvent.findOne({ trace_id: execution.trace_id }).sort({ sequence: -1 }).lean();
      if (lastEvent) {
        sequence = lastEvent.sequence + 1;
      }
    }

    const eventObj = {
      execution_id: execution.execution_id,
      trace_id: execution.trace_id,
      tenant_id: execution.tenant_id,
      event_type: eventType,
      timestamp: timestamp,
      sequence: sequence,
      payload: payload || {},
    };

    const determinismHash = computeDeterminismHash(eventObj);
    const lineageEventId = `lin_${determinismHash.slice(0, 16)}`;

    const finalEvent = {
      lineage_event_id: lineageEventId,
      ...eventObj,
      determinism_hash: determinismHash,
    };

    if (mongoose.connection.readyState === 1) {
      await SetuLineageEvent.create(finalEvent);
    }

    return finalEvent;
  }

  /**
   * List lineage events by trace_id
   */
  static async listEvents(traceId, limit = 200) {
    if (mongoose.connection.readyState === 1) {
      return await SetuLineageEvent.find({ trace_id: traceId }).sort({ sequence: 1 }).limit(limit).lean();
    }
    return [];
  }

  /**
   * Verify execution event history exists in lineage store
   */
  static async verifyExecutionHistory(executionId, traceId) {
    const events = await this.listEvents(traceId, 1000);
    const eventFound = events.some(e => e.execution_id === executionId);

    return {
      execution_id: executionId,
      trace_id: traceId,
      verified: eventFound,
      verification_details: {
        execution_event_exists: eventFound,
        total_trace_events: events.length,
      },
    };
  }
}

export default BucketLineageAdapter;
