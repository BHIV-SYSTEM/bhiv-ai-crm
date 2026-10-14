import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

import FieldAgentTask from '../../models/FieldAgentTask.js';
import {
  FIELD_TASK_STATES,
  validateTaskTransition,
  validateArrival,
} from './fieldAgentLifecycle.js';

function ensureDatabaseAvailable() {
  if (mongoose.connection.readyState !== 1) {
    const error = new Error('Task database is unavailable');
    error.status = 503;
    throw error;
  }
}

function safeTaskView(task) {
  const source = typeof task.toObject === 'function'
    ? task.toObject()
    : task;

  return {
    taskId: source.taskId,
    state: source.state,
    store: {
      storeId: source.store.storeId,
      name: source.store.name,
      location: {
        lat: source.store.location.lat,
        lng: source.store.location.lng,
      },
    },
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    arrivalEvidence: source.arrivalEvidence
      ? {
          agentLocation: { ...source.arrivalEvidence.agentLocation },
          accuracyMeters: source.arrivalEvidence.accuracyMeters,
          distanceMeters: source.arrivalEvidence.distanceMeters,
          radiusMeters: source.arrivalEvidence.radiusMeters,
          outcome: source.arrivalEvidence.outcome,
          evaluatedAt: source.arrivalEvidence.evaluatedAt,
        }
      : null,
    proof: source.proof
      ? {
          proofId: source.proof.proofId,
          fileReference: source.proof.fileReference,
          submittedAt: source.proof.submittedAt,
          reviewState: source.proof.reviewState,
          ocrStatus: source.proof.ocrStatus,
          extractedFields: source.proof.extractedFields,
          confidence: source.proof.confidence,
        }
      : null,
  };
}

function buildAuditEvent({
  actorId,
  eventType,
  previousState,
  currentState,
  correlationId,
  details = {},
}) {
  return {
    eventId: randomUUID(),
    actorId,
    eventType,
    previousState,
    currentState,
    occurredAt: new Date(),
    correlationId: correlationId || null,
    details,
  };
}

function validateIdentity(agentId, tenantId) {
  if (!agentId || !mongoose.isValidObjectId(agentId)) {
    const error = new Error('A valid authenticated agent ID is required');
    error.status = 400;
    throw error;
  }

  if (typeof tenantId !== 'string' || !tenantId.trim()) {
    const error = new Error('Authenticated tenant ID is required');
    error.status = 400;
    throw error;
  }
}

async function findOwnedTask(taskId, agentId, tenantId) {
  return FieldAgentTask.findOne({
    taskId: String(taskId),
    assignedAgentId: new mongoose.Types.ObjectId(agentId),
    tenantId,
  });
}

export async function listPersistentAgentTasks({ agentId, tenantId }) {
  ensureDatabaseAvailable();
  validateIdentity(agentId, tenantId);

  const tasks = await FieldAgentTask.find({
    assignedAgentId: new mongoose.Types.ObjectId(agentId),
    tenantId,
  })
    .sort({ createdAt: -1 })
    .lean();

  return tasks.map(safeTaskView);
}

export async function getPersistentAgentTask({
  taskId,
  agentId,
  tenantId,
}) {
  ensureDatabaseAvailable();
  validateIdentity(agentId, tenantId);

  const task = await findOwnedTask(taskId, agentId, tenantId);

  return task ? safeTaskView(task) : null;
}

export async function transitionPersistentAgentTask({
  taskId,
  agentId,
  tenantId,
  nextState,
  correlationId = null,
}) {
  ensureDatabaseAvailable();
  validateIdentity(agentId, tenantId);

  if (!Object.hasOwn(FIELD_TASK_STATES, nextState)) {
    return {
      success: false,
      status: 400,
      message: 'Unknown task state',
    };
  }

  const task = await findOwnedTask(taskId, agentId, tenantId);

  if (!task) {
    return {
      success: false,
      status: 404,
      message: 'Task not found',
    };
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
  const now = new Date();

  task.state = nextState;
  task.updatedAt = now;
  task.auditEvents.push(
    buildAuditEvent({
      actorId: agentId,
      eventType: 'TASK_STATE_CHANGED',
      previousState,
      currentState: nextState,
      correlationId,
    }),
  );

  await task.save();

  return {
    success: true,
    task: safeTaskView(task),
  };
}

export async function recordPersistentAgentArrival({
  taskId,
  agentId,
  tenantId,
  agentLocation,
  accuracyMeters,
  correlationId = null,
}) {
  ensureDatabaseAvailable();
  validateIdentity(agentId, tenantId);

  const task = await findOwnedTask(taskId, agentId, tenantId);

  if (!task) {
    return {
      success: false,
      status: 404,
      message: 'Task not found',
    };
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
  const now = new Date();

  task.arrivalEvidence = {
    agentLocation,
    accuracyMeters,
    distanceMeters: decision.distanceMeters,
    radiusMeters: decision.radiusMeters,
    outcome: 'ARRIVAL_CONFIRMED',
    evaluatedAt: now,
  };

  task.state = FIELD_TASK_STATES.ARRIVED;
  task.updatedAt = now;

  task.auditEvents.push(
    buildAuditEvent({
      actorId: agentId,
      eventType: 'ARRIVAL_CONFIRMED',
      previousState,
      currentState: task.state,
      correlationId,
      details: {
        outcome: decision.outcome,
        distanceMeters: decision.distanceMeters,
        accuracyMeters,
      },
    }),
  );

  await task.save();

  return {
    success: true,
    decision,
    task: safeTaskView(task),
  };
}


/**
 * Submit storefront proof for an assigned task.
 *
 * OCR is explicitly marked NOT_CONFIGURED until an approved OCR
 * provider is integrated. This function does not process images.
 */
export async function submitPersistentAgentProof({
  taskId,
  agentId,
  tenantId,
  fileReference,
  correlationId = null,
}) {
  ensureDatabaseAvailable();
  validateIdentity(agentId, tenantId);

  if (
    typeof fileReference !== 'string' ||
    !fileReference.trim() ||
    fileReference.length > 2048
  ) {
    return {
      success: false,
      status: 400,
      message: 'A valid proof file reference is required',
    };
  }

  // Accept only opaque application-managed references, not local paths,
  // arbitrary URLs, or client-supplied file locations.
  if (
    !/^proof:[A-Za-z0-9_-]{1,200}$/.test(fileReference.trim())
  ) {
    return {
      success: false,
      status: 400,
      message: 'Use an application-managed proof reference',
    };
  }

  const task = await findOwnedTask(taskId, agentId, tenantId);

  if (!task) {
    return {
      success: false,
      status: 404,
      message: 'Task not found',
    };
  }

  if (task.state !== FIELD_TASK_STATES.ARRIVED) {
    return {
      success: false,
      status: 409,
      message: 'Task must be ARRIVED before proof can be submitted',
    };
  }

  const previousState = task.state;
  const now = new Date();
  const proofId = randomUUID();

  task.proof = {
    proofId,
    fileReference: fileReference.trim(),
    submittedAt: now,
    reviewState: FIELD_TASK_STATES.REVIEW_REQUIRED,
    ocrStatus: 'NOT_CONFIGURED',
    extractedFields: {},
    confidence: null,
  };

  task.state = FIELD_TASK_STATES.PROOF_SUBMITTED;
  task.updatedAt = now;

  task.auditEvents.push(
    buildAuditEvent({
      actorId: agentId,
      eventType: 'STOREFRONT_PROOF_SUBMITTED',
      previousState,
      currentState: task.state,
      correlationId,
      details: {
        proofId,
        ocrStatus: 'NOT_CONFIGURED',
      },
    }),
  );

  await task.save();

  return {
    success: true,
    task: safeTaskView(task),
  };
}