import mongoose from 'mongoose';
import { NiyantranAdapter } from './niyantranAdapter.js';

/**
 * uiVisibilityService.js — SETU UI Visibility Service (Node.js Edition)
 *
 * READ-ONLY service for aggregating trace timelines, task state visibility,
 * and candidate state summaries for SETU dashboard UIs.
 */

export class UiVisibilityService {
  /**
   * Get candidate execution state for UI visibility
   */
  static async getCandidateState(traceId) {
    const timelineRes = await NiyantranAdapter.getExecutionTimeline(traceId);
    const timeline = timelineRes.timeline || [];

    let currentState = 'unknown';

    if (timeline.length > 0) {
      const latestEvent = timeline[timeline.length - 1];

      if (latestEvent.type === 'task_state') {
        currentState = latestEvent.data.state;
      } else if (latestEvent.type === 'submission_state') {
        currentState = `submission_${latestEvent.data.state}`;
      } else if (latestEvent.type === 'execution_status') {
        currentState = latestEvent.data.status;
      }
    }

    return {
      trace_id: traceId,
      current_state: currentState,
      last_updated: timeline.length > 0 ? timeline[timeline.length - 1].timestamp : null,
      total_events: timeline.length,
    };
  }

  /**
   * Get task states organized for UI visibility
   */
  static async getTaskStateVisibility(traceId) {
    const taskStates = await NiyantranAdapter.getTaskStates(traceId);

    const tasksById = {};
    for (const state of taskStates) {
      const taskId = state.task_id;
      if (!tasksById[taskId]) {
        tasksById[taskId] = [];
      }
      tasksById[taskId].push(state);
    }

    const taskSummaries = Object.keys(tasksById).map(taskId => {
      const history = tasksById[taskId];
      const latest = history[history.length - 1];
      return {
        task_id: taskId,
        current_state: latest.state,
        last_updated: latest.timestamp,
        history_count: history.length,
      };
    });

    return {
      trace_id: traceId,
      tasks: taskSummaries,
      total_tasks: taskSummaries.length,
    };
  }

  /**
   * Get signal visibility by trace_id
   */
  static async getSignalVisibility(traceId) {
    let signals = [];
    if (mongoose.connection.readyState === 1 && mongoose.models.SetuSignal) {
      signals = await mongoose.models.SetuSignal.find({ trace_id: traceId }).lean();
    }

    const signalsBySeverity = { low: [], medium: [], high: [], critical: [] };

    for (const signal of signals) {
      const severity = (signal.severity || 'low').toLowerCase();
      if (signalsBySeverity[severity]) {
        signalsBySeverity[severity].push({
          signal_id: signal.ingestion_id,
          entity_id: signal.entity_id,
          event_type: signal.event_type,
          signal_type: signal.signal_type,
          timestamp: signal.timestamp,
          ingested_at: signal.ingested_at,
        });
      }
    }

    return {
      trace_id: traceId,
      signals_by_severity: signalsBySeverity,
      total_signals: signals.length,
      severity_counts: {
        low: signalsBySeverity.low.length,
        medium: signalsBySeverity.medium.length,
        high: signalsBySeverity.high.length,
        critical: signalsBySeverity.critical.length,
      },
    };
  }

  /**
   * Get severity dashboard for UI visibility
   */
  static async getSeverityDashboard(traceId) {
    let signals = [];
    if (mongoose.connection.readyState === 1 && mongoose.models.SetuSignal) {
      signals = await mongoose.models.SetuSignal.find({ trace_id: traceId }).lean();
    }

    const severityAnalysis = {
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      overall_severity: 'low',
      latest_critical: null,
      trend: [],
    };

    for (const signal of signals) {
      const severity = (signal.severity || 'low').toLowerCase();
      if (severity === 'critical') {
        severityAnalysis.critical_count += 1;
        if (!severityAnalysis.latest_critical || signal.timestamp > severityAnalysis.latest_critical.timestamp) {
          severityAnalysis.latest_critical = signal;
        }
      } else if (severity === 'high') {
        severityAnalysis.high_count += 1;
      } else if (severity === 'medium') {
        severityAnalysis.medium_count += 1;
      } else if (severity === 'low') {
        severityAnalysis.low_count += 1;
      }
    }

    if (severityAnalysis.critical_count > 0) {
      severityAnalysis.overall_severity = 'critical';
    } else if (severityAnalysis.high_count > 0) {
      severityAnalysis.overall_severity = 'high';
    } else if (severityAnalysis.medium_count > 0) {
      severityAnalysis.overall_severity = 'medium';
    }

    return {
      trace_id: traceId,
      severity_analysis: severityAnalysis,
    };
  }

  /**
   * Get enhanced timeline for UI display
   */
  static async getExecutionTimelineUi(traceId) {
    const timelineRes = await NiyantranAdapter.getExecutionTimeline(traceId);
    const rawTimeline = timelineRes.timeline || [];

    const enhancedTimeline = rawTimeline.map(event => ({
      timestamp: event.timestamp,
      type: event.type,
      title: this._getEventTitle(event),
      description: this._getEventDescription(event),
      status: this._getEventStatus(event),
      icon: this._getEventIcon(event.type),
      color: this._getEventColor(event),
      data: event.data,
    }));

    return {
      trace_id: traceId,
      timeline: enhancedTimeline,
      total_events: enhancedTimeline.length,
    };
  }

  /**
   * Get complete visibility dashboard (read-only)
   */
  static async getVisibilityDashboard(traceId) {
    const candidateState = await this.getCandidateState(traceId);
    const taskState = await this.getTaskStateVisibility(traceId);
    const signalVisibility = await this.getSignalVisibility(traceId);
    const severityDashboard = await this.getSeverityDashboard(traceId);
    const timeline = await this.getExecutionTimelineUi(traceId);

    return {
      trace_id: traceId,
      dashboard_type: 'visibility_only',
      no_execution_actions: true,
      no_workflow_mutations: true,
      candidate_state: candidateState,
      task_state: taskState,
      signal_visibility: signalVisibility,
      severity_dashboard: severityDashboard,
      timeline: timeline,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Get full trace timeline
   */
  static async getTraceTimeline(traceId) {
    return await NiyantranAdapter.getExecutionTimeline(traceId);
  }

  // Helpers
  static _getEventTitle(event) {
    const eventType = event.type;
    const data = event.data || {};
    if (eventType === 'task_state') {
      return `Task ${data.task_id || 'Unknown'} - ${data.state || 'Unknown'}`;
    } else if (eventType === 'submission_state') {
      return `Submission ${data.submission_id || 'Unknown'} - ${data.state || 'Unknown'}`;
    } else if (eventType === 'execution_status') {
      return `Execution ${data.task_id || 'Unknown'} - ${data.state || 'Unknown'}`;
    }
    return eventType;
  }

  static _getEventDescription(event) {
    const data = event.data || {};
    if (data.metadata && Object.keys(data.metadata).length > 0) {
      return `Metadata: ${JSON.stringify(data.metadata).slice(0, 100)}...`;
    }
    return 'No additional details';
  }

  static _getEventStatus(event) {
    const data = event.data || {};
    const state = (data.state || '').toLowerCase();
    if (['completed', 'success'].includes(state)) return 'success';
    if (['failed', 'error'].includes(state)) return 'error';
    if (['running', 'in_progress'].includes(state)) return 'running';
    return 'pending';
  }

  static _getEventIcon(eventType) {
    const icons = { task_state: 'task', submission_state: 'submit', execution_status: 'execute' };
    return icons[eventType] || 'event';
  }

  static _getEventColor(event) {
    const status = this._getEventStatus(event);
    const colors = { success: 'green', error: 'red', running: 'blue', pending: 'orange', info: 'gray' };
    return colors[status] || 'gray';
  }
}

export default UiVisibilityService;

