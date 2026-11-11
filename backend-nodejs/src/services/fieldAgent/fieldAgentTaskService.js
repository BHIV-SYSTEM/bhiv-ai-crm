import {
  FIELD_TASK_STATES,
  ALLOWED_TRANSITIONS,
  validateTaskTransition,
  validateArrival,
} from './fieldAgentLifecycle.js';

/**
 * In-memory task repository for isolated development and testing.
 *
 * This is NOT persistent storage and must not be used as the
 * production task repository. Production integration will use the
 * approved canonical task store.
 */
const tasks = new Map();
const auditEvents = [];

function safeTaskView(task) {
  // Explicit allowlist: never return financial data, source payloads,
  // internal credentials, or another agent's private information.
  return {
    taskId: task.taskId,
    assignedAgentId: task.assignedAgentId,
    store: {
      storeId: task.store.storeId,
      name: task.store.name,
      location: {
        lat: task.store.location.lat,
        lng: task.store.location.lng,
      },
    },
    state: task.state,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    arrivalEvidence: task.arrivalEvidence
      ? { ...task.arrivalEvidence }
      : null,
    proof: task.proof
      ? {
          proofId: task.proof.proofId,
          fileReference: task.proof.fileReference,
          submittedAt: task.proof.submittedAt,
          reviewState: task.proof.reviewState,
          ocrStatus: task.proof.ocrStatus,
          extractedFields: { ...task.proof.extractedFields },
          confidence: task.proof.confidence,
        }
      : null,
  };
}

function recordEvent(task, actorId, eventType, details = {}) {
  auditEvents.push({
    eventId: `FAE-${Date.now()}-${auditEvents.length + 1}`,
    taskId: task.taskId,
    actorId: String(actorId),
    eventType,
    previousState: details.previousState ?? task.state,
    currentState: task.state,
    occurredAt: new Date().toISOString(),
    correlationId: details.correlationId ?? null,
    details,
  });
}

function findOwnedTask(taskId, agentId) {
  const task = tasks.get(String(taskId));

  if (!task || task.assignedAgentId !== String(agentId)) {
    return null;
  }

  return task;
}

/**
 * Creates a task for isolated tests and local development.
 * Do not expose this function through a public Field Agent endpoint.
 */
export function createDevelopmentTask({
  taskId,
  assignedAgentId,
  store,
}) {
  if (!taskId || !assignedAgentId || !store?.storeId ||
      !store?.name || !Number.isFinite(store?.location?.lat) ||
      !Number.isFinite(store?.location?.lng)) {
    throw new TypeError('Valid task, agent, and store details are required');
  }

  if (tasks.has(String(taskId))) {
    throw new Error('Task already exists');
  }

  const now = new Date().toISOString();

  const task = {
    taskId: String(taskId),
    assignedAgentId: String(assignedAgentId),
    store: {
      storeId: String(store.storeId),
      name: String(store.name),
      location: {
        lat: store.location.lat,
        lng: store.location.lng,
      },
    },
    state: FIELD_TASK_STATES.ASSIGNED,
    createdAt: now,
    updatedAt: now,
    arrivalEvidence: null,
    proof: null,
  };

  tasks.set(task.taskId, task);
  recordEvent(task, assignedAgentId, 'TASK_CREATED');

  return safeTaskView(task);
}

export function listAgentTasks(agentId) {
  if (!agentId) {
    throw new TypeError('Authenticated agent ID is required');
  }

  return [...tasks.values()]
    .filter(task => task.assignedAgentId === String(agentId))
    .map(safeTaskView);
}

export function getAgentTask(taskId, agentId) {
  const task = findOwnedTask(taskId, agentId);
  return task ? safeTaskView(task) : null;
}

export function transitionAgentTask({
  taskId,
  agentId,
  nextState,
  correlationId = null,
}) {
  const task = findOwnedTask(taskId, agentId);

  if (!task) {
    return { success: false, status: 404, message: 'Task not found' };
  }

  const transition = validateTaskTransition(task.state, nextState);

  if (!transition.allowed) {
    return {
      success: false,
      status: 409,
      message: 'Invalid task state transition',
      reason: transition.reason,
    };
  }

  const previousState = task.state;
  task.state = nextState;
  task.updatedAt = new Date().toISOString();

  recordEvent(task, agentId, 'TASK_STATE_CHANGED', {
    previousState,
    correlationId,
  });

  return { success: true, task: safeTaskView(task) };
}

export function recordAgentArrival({
  taskId,
  agentId,
  agentLocation,
  accuracyMeters,
  correlationId = null,
}) {
  const task = findOwnedTask(taskId, agentId);

  if (!task) {
    return { success: false, status: 404, message: 'Task not found' };
  }

  if (task.state !== FIELD_TASK_STATES.EN_ROUTE) {
    return {
      success: false,
      status: 409,
      message: 'Task must be EN_ROUTE before arrival can be recorded',
    };
  }

  const decision = validateArrival({
    agentLocation,
    storeLocation: task.store.location,
    accuracyMeters,
  });

  if (!decision.allowed) {
    return {
      success: false,
      status: 422,
      message: 'Arrival geofence validation failed',
      decision,
    };
  }

  const previousState = task.state;

  task.arrivalEvidence = {
    agentLocation: { ...agentLocation },
    accuracyMeters,
    distanceMeters: decision.distanceMeters,
    radiusMeters: decision.radiusMeters,
    outcome: decision.outcome,
    evaluatedAt: decision.evaluatedAt,
  };

  task.state = FIELD_TASK_STATES.ARRIVED;
  task.updatedAt = new Date().toISOString();

  recordEvent(task, agentId, 'ARRIVAL_CONFIRMED', {
    previousState,
    correlationId,
    outcome: decision.outcome,
    distanceMeters: decision.distanceMeters,
    accuracyMeters,
  });

  return {
    success: true,
    decision,
    task: safeTaskView(task),
  };
}

/**
 * Audit retrieval for tests and internal integration only.
 * Do not expose this function directly to field-agent clients.
 */
export function getDevelopmentAuditEvents(taskId) {
  return auditEvents
    .filter(event => event.taskId === String(taskId))
    .map(event => ({ ...event, details: { ...event.details } }));
}

/**
 * Allows isolated tests to clear the in-memory repository.
 */
export function resetDevelopmentTasks() {
  tasks.clear();
  auditEvents.length = 0;
}