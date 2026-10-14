import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import {
  createDevelopmentTask,
  listAgentTasks,
  getAgentTask,
  transitionAgentTask,
  recordAgentArrival,
  getDevelopmentAuditEvents,
  resetDevelopmentTasks,
} from '../src/services/fieldAgent/fieldAgentTaskService.js';

beforeEach(() => {
  resetDevelopmentTasks();

  createDevelopmentTask({
    taskId: 'TASK-001',
    assignedAgentId: 'AGENT-001',
    store: {
      storeId: 'STORE-001',
      name: 'Mumbai General Store',
      location: { lat: 19.076, lng: 72.8777 },
    },
  });

  createDevelopmentTask({
    taskId: 'TASK-002',
    assignedAgentId: 'AGENT-002',
    store: {
      storeId: 'STORE-002',
      name: 'Thane General Store',
      location: { lat: 19.2183, lng: 72.9781 },
    },
  });
});

test('lists only tasks assigned to the requested agent', () => {
  const tasks = listAgentTasks('AGENT-001');

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].taskId, 'TASK-001');
});

test('does not reveal another agent task through direct lookup', () => {
  assert.equal(getAgentTask('TASK-002', 'AGENT-001'), null);
});

test('rejects access when the agent ID is missing', () => {
  assert.throws(() => listAgentTasks(''), /Authenticated agent ID is required/);
});

test('allows a valid task transition', () => {
  const result = transitionAgentTask({
    taskId: 'TASK-001',
    agentId: 'AGENT-001',
    nextState: 'ACCEPTED',
    correlationId: 'TRACE-001',
  });

  assert.equal(result.success, true);
  assert.equal(result.task.state, 'ACCEPTED');
});

test('rejects an invalid task transition', () => {
  const result = transitionAgentTask({
    taskId: 'TASK-001',
    agentId: 'AGENT-001',
    nextState: 'COMPLETED',
  });

  assert.equal(result.success, false);
  assert.equal(result.status, 409);
});

test('does not allow one agent to transition another agent task', () => {
  const result = transitionAgentTask({
    taskId: 'TASK-002',
    agentId: 'AGENT-001',
    nextState: 'ACCEPTED',
  });

  assert.equal(result.success, false);
  assert.equal(result.status, 404);
});

test('records arrival only after the task reaches EN_ROUTE', () => {
  const result = recordAgentArrival({
    taskId: 'TASK-001',
    agentId: 'AGENT-001',
    agentLocation: { lat: 19.076, lng: 72.8777 },
    accuracyMeters: 5,
  });

  assert.equal(result.success, false);
  assert.equal(result.status, 409);
});

test('accepts arrival inside the geofence after EN_ROUTE', () => {
  transitionAgentTask({
    taskId: 'TASK-001',
    agentId: 'AGENT-001',
    nextState: 'ACCEPTED',
  });

  transitionAgentTask({
    taskId: 'TASK-001',
    agentId: 'AGENT-001',
    nextState: 'EN_ROUTE',
  });

  const result = recordAgentArrival({
    taskId: 'TASK-001',
    agentId: 'AGENT-001',
    agentLocation: { lat: 19.076, lng: 72.8777 },
    accuracyMeters: 5,
    correlationId: 'TRACE-ARRIVAL-001',
  });

  assert.equal(result.success, true);
  assert.equal(result.task.state, 'ARRIVED');
  assert.equal(result.decision.outcome, 'ARRIVAL_CONFIRMED');
  assert.equal(result.task.arrivalEvidence.radiusMeters, 50);
});

test('rejects arrival outside the geofence', () => {
  transitionAgentTask({
    taskId: 'TASK-001',
    agentId: 'AGENT-001',
    nextState: 'ACCEPTED',
  });

  transitionAgentTask({
    taskId: 'TASK-001',
    agentId: 'AGENT-001',
    nextState: 'EN_ROUTE',
  });

  const result = recordAgentArrival({
    taskId: 'TASK-001',
    agentId: 'AGENT-001',
    agentLocation: { lat: 19.077, lng: 72.8777 },
    accuracyMeters: 5,
  });

  assert.equal(result.success, false);
  assert.equal(result.status, 422);
  assert.equal(result.decision.outcome, 'OUTSIDE_GEOFENCE');
});

test('does not expose financial fields in task responses', () => {
  const task = getAgentTask('TASK-001', 'AGENT-001');

  assert.ok(task);
  assert.equal(Object.hasOwn(task, 'paymentCollected'), false);
  assert.equal(Object.hasOwn(task, 'invoiceTotal'), false);
  assert.equal(Object.hasOwn(task, 'creditLimit'), false);
  assert.equal(Object.hasOwn(task, 'paymentStatus'), false);
});

test('records task-state changes in the audit trail', () => {
  transitionAgentTask({
    taskId: 'TASK-001',
    agentId: 'AGENT-001',
    nextState: 'ACCEPTED',
    correlationId: 'TRACE-AUDIT-001',
  });

  const events = getDevelopmentAuditEvents('TASK-001');
  const stateChange = events.find(
    event => event.eventType === 'TASK_STATE_CHANGED',
  );

  assert.ok(stateChange);
  assert.equal(stateChange.previousState, 'ASSIGNED');
  assert.equal(stateChange.currentState, 'ACCEPTED');
  assert.equal(stateChange.correlationId, 'TRACE-AUDIT-001');
});

test('rejects duplicate task IDs', () => {
  assert.throws(
    () => createDevelopmentTask({
      taskId: 'TASK-001',
      assignedAgentId: 'AGENT-001',
      store: {
        storeId: 'STORE-003',
        name: 'Duplicate Store',
        location: { lat: 19.076, lng: 72.8777 },
      },
    }),
    /Task already exists/,
  );
});