import mongoose from 'mongoose';

/**
 * traceContinuity.js — Trace Continuity & Execution Contract Middleware (Node.js Edition)
 *
 * Validates trace continuity headers and execution contracts across SETU endpoints.
 * Logs trace propagation events (TRACE_RECEIVED, TRACE_FORWARDED, TRACE_MISMATCH_REJECTED)
 * to MongoDB setu_trace_logs collection.
 */

// MongoDB Schema for SETU Trace Logs
const setuTraceLogSchema = new mongoose.Schema({
  log_id: { type: String, required: true, unique: true },
  event: { type: String, required: true, index: true },
  execution_id: { type: String, default: null },
  trace_id: { type: String, default: null, index: true },
  tenant_id: { type: String, default: null, index: true },
  reason: { type: String, default: null },
  details: { type: Object, default: {} },
  timestamp: { type: String, default: () => new Date().toISOString() },
}, { timestamps: true });

const SetuTraceLog = mongoose.models.SetuTraceLog || mongoose.model('SetuTraceLog', setuTraceLogSchema);

export async function appendTraceLog(logData) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return; // Skip DB persistence if MongoDB is not connected
    }
    const logId = `trc_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 15)}_${Math.random().toString(36).substring(2, 7)}`;
    const doc = new SetuTraceLog({
      log_id: logId,
      event: logData.event,
      execution_id: logData.execution_id || null,
      trace_id: logData.trace_id || null,
      tenant_id: logData.tenant_id || null,
      reason: logData.reason || null,
      details: logData.details || {},
      timestamp: logData.timestamp || new Date().toISOString(),
    });
    await doc.save();
  } catch (err) {
    console.error('[TraceContinuityMiddleware] Failed to append trace log to MongoDB:', err.message);
  }
}

/**
 * Express Middleware factory for trace continuity check
 *
 * @param {Object} options
 * @param {Array<string>} options.paths - Endpoint paths requiring trace continuity check
 */
export function traceContinuityMiddleware(options = {}) {
  const targetPaths = options.paths || ['/setu/route', '/setu/signals/ingest'];

  return async (req, res, next) => {
    const currentPath = req.path || req.baseUrl;
    const isTarget = targetPaths.some(p => currentPath.endsWith(p));

    if (!isTarget) {
      return next();
    }

    const headerTraceId = req.headers['x-trace-id'];
    const headerTenantId = req.headers['x-tenant-id'];
    const headerExecutionId = req.headers['x-execution-id'];

    const body = req.body || {};
    const traceId = headerTraceId || body.trace_id || null;
    const tenantId = headerTenantId || body.tenant_id || null;
    const executionId = headerExecutionId || body.execution_id || (traceId ? `exec_${traceId.slice(0, 8)}` : null);

    // Log TRACE_RECEIVED
    await appendTraceLog({
      event: 'TRACE_RECEIVED',
      execution_id: executionId,
      trace_id: traceId,
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),
    });

    if (!traceId || typeof traceId !== 'string' || traceId.trim().length < 8) {
      await appendTraceLog({
        event: 'TRACE_MISMATCH_REJECTED',
        execution_id: executionId,
        trace_id: traceId,
        tenant_id: tenantId,
        reason: 'invalid_or_missing_trace_id',
        details: { received_trace_id: traceId },
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        error: 'invalid_trace_id',
        message: 'Trace continuity failure — trace_id is missing or invalid (minimum 8 characters required)',
        status_code: 400,
      });
    }

    // Attach trace info to request context
    req.setuExecution = {
      execution_id: executionId,
      trace_id: traceId,
      tenant_id: tenantId,
    };

    // Log TRACE_FORWARDED
    await appendTraceLog({
      event: 'TRACE_FORWARDED',
      execution_id: executionId,
      trace_id: traceId,
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),
    });

    next();
  };
}

export default traceContinuityMiddleware;
