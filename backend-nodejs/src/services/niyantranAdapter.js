import mongoose from 'mongoose';

/**
 * niyantranAdapter.js — Niyantran Integration & Visibility Bridge (Node.js Edition)
 *
 * Consumes and stores Niyantran task states and submission states for SETU execution visibility.
 */

// MongoDB Schema for SETU Visibility Records
const setuVisibilityRecordSchema = new mongoose.Schema({
  record_id: { type: String, required: true, unique: true },
  record_type: { type: String, required: true, index: true }, // 'task_state' or 'submission_state'
  task_id: { type: String, required: true, index: true },
  submission_id: { type: String, default: null, index: true },
  trace_id: { type: String, required: true, index: true },
  tenant_id: { type: String, required: true, index: true },
  state: { type: String, required: true },
  timestamp: { type: String, required: true },
  result: { type: Object, default: null },
  metadata: { type: Object, default: {} },
  consumed_at: { type: String, default: () => new Date().toISOString() },
  source: { type: String, default: 'niyantran' },
}, { timestamps: true });

const SetuVisibilityRecord = mongoose.models.SetuVisibilityRecord || mongoose.model('SetuVisibilityRecord', setuVisibilityRecordSchema);

export class NiyantranAdapter {
  /**
   * Consume task state from Niyantran
   */
  static async consumeTaskState(taskState = {}) {
    const requiredFields = ['task_id', 'trace_id', 'tenant_id', 'state', 'timestamp'];
    const missing = requiredFields.filter(f => !taskState[f]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    const recordId = `vis_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 15)}_${Math.random().toString(36).substring(2, 7)}`;

    const visibilityRecord = {
      record_id: recordId,
      record_type: 'task_state',
      task_id: taskState.task_id,
      trace_id: taskState.trace_id,
      tenant_id: taskState.tenant_id,
      state: taskState.state,
      timestamp: taskState.timestamp,
      metadata: taskState.metadata || {},
      consumed_at: new Date().toISOString(),
      source: 'niyantran',
    };

    if (mongoose.connection.readyState === 1) {
      await SetuVisibilityRecord.create(visibilityRecord);
    }

    return {
      success: true,
      record_type: 'task_state',
      task_id: taskState.task_id,
      trace_id: taskState.trace_id,
    };
  }

  /**
   * Consume submission state from Niyantran
   */
  static async consumeSubmissionState(submissionState = {}) {
    const requiredFields = ['submission_id', 'task_id', 'trace_id', 'tenant_id', 'state', 'timestamp'];
    const missing = requiredFields.filter(f => !submissionState[f]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    const recordId = `vis_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 15)}_${Math.random().toString(36).substring(2, 7)}`;

    const visibilityRecord = {
      record_id: recordId,
      record_type: 'submission_state',
      submission_id: submissionState.submission_id,
      task_id: submissionState.task_id,
      trace_id: submissionState.trace_id,
      tenant_id: submissionState.tenant_id,
      state: submissionState.state,
      timestamp: submissionState.timestamp,
      result: submissionState.result || null,
      metadata: submissionState.metadata || {},
      consumed_at: new Date().toISOString(),
      source: 'niyantran',
    };

    if (mongoose.connection.readyState === 1) {
      await SetuVisibilityRecord.create(visibilityRecord);
    }

    return {
      success: true,
      record_type: 'submission_state',
      submission_id: submissionState.submission_id,
      task_id: submissionState.task_id,
      trace_id: submissionState.trace_id,
    };
  }

  /**
   * Consume execution status from Niyantran
   */
  static async consumeExecutionStatus(executionStatus = {}) {
    const requiredFields = ['execution_id', 'trace_id', 'tenant_id', 'status', 'timestamp'];
    const missing = requiredFields.filter(f => !executionStatus[f]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    const recordId = `vis_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 15)}_${Math.random().toString(36).substring(2, 7)}`;

    const visibilityRecord = {
      record_id: recordId,
      record_type: 'execution_status',
      task_id: executionStatus.execution_id,
      trace_id: executionStatus.trace_id,
      tenant_id: executionStatus.tenant_id,
      state: executionStatus.status,
      timestamp: executionStatus.timestamp,
      result: executionStatus.result || null,
      metadata: executionStatus.metadata || {},
      consumed_at: new Date().toISOString(),
      source: 'niyantran',
    };

    if (mongoose.connection.readyState === 1) {
      await SetuVisibilityRecord.create(visibilityRecord);
    }

    return {
      success: true,
      record_type: 'execution_status',
      execution_id: executionStatus.execution_id,
      trace_id: executionStatus.trace_id,
    };
  }


  /**
   * Get execution timeline by trace_id
   */
  static async getExecutionTimeline(traceId) {
    let records = [];
    if (mongoose.connection.readyState === 1) {
      records = await SetuVisibilityRecord.find({ trace_id: traceId }).sort({ timestamp: 1 }).lean();
    }

    const timeline = records.map(r => ({
      type: r.record_type,
      timestamp: r.timestamp,
      data: {
        task_id: r.task_id,
        submission_id: r.submission_id,
        state: r.state,
        status: r.state,
        result: r.result,
        metadata: r.metadata,
      },
    }));

    return {
      trace_id: traceId,
      timeline: timeline,
      total_events: timeline.length,
    };
  }

  /**
   * Get task states by trace_id
   */
  static async getTaskStates(traceId) {
    if (mongoose.connection.readyState === 1) {
      return await SetuVisibilityRecord.find({ trace_id: traceId, record_type: 'task_state' }).sort({ timestamp: 1 }).lean();
    }
    return [];
  }
}

export default NiyantranAdapter;
