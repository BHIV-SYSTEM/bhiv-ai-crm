import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';

import {
  listPersistentAgentTasks,
  getPersistentAgentTask,
  transitionPersistentAgentTask,
  recordPersistentAgentArrival,
  submitPersistentAgentProof,
  reviewPersistentAgentProof,
} from '../src/services/fieldAgent/persistentFieldAgentTaskService.js';

test('rejects task listing when MongoDB is unavailable', async () => {
  const originalReadyState = mongoose.connection.readyState;

  try {
    mongoose.connection.readyState = 0;

    await assert.rejects(
      listPersistentAgentTasks({
        agentId: new mongoose.Types.ObjectId().toString(),
        tenantId: 'tenant_test',
      }),
      error => error.status === 503 &&
        error.message === 'Task database is unavailable',
    );
  } finally {
    mongoose.connection.readyState = originalReadyState;
  }
});

test('rejects task lookup when MongoDB is unavailable', async () => {
  const originalReadyState = mongoose.connection.readyState;

  try {
    mongoose.connection.readyState = 0;

    await assert.rejects(
      getPersistentAgentTask({
        taskId: 'TASK-001',
        agentId: new mongoose.Types.ObjectId().toString(),
        tenantId: 'tenant_test',
      }),
      error => error.status === 503,
    );
  } finally {
    mongoose.connection.readyState = originalReadyState;
  }
});

test('rejects state changes when MongoDB is unavailable', async () => {
  const originalReadyState = mongoose.connection.readyState;

  try {
    mongoose.connection.readyState = 0;

    await assert.rejects(
      transitionPersistentAgentTask({
        taskId: 'TASK-001',
        agentId: new mongoose.Types.ObjectId().toString(),
        tenantId: 'tenant_test',
        nextState: 'ACCEPTED',
      }),
      error => error.status === 503,
    );
  } finally {
    mongoose.connection.readyState = originalReadyState;
  }
});

test('rejects arrival recording when MongoDB is unavailable', async () => {
  const originalReadyState = mongoose.connection.readyState;

  try {
    mongoose.connection.readyState = 0;

    await assert.rejects(
      recordPersistentAgentArrival({
        taskId: 'TASK-001',
        agentId: new mongoose.Types.ObjectId().toString(),
        tenantId: 'tenant_test',
        agentLocation: { lat: 19.076, lng: 72.8777 },
        accuracyMeters: 5,
      }),
      error => error.status === 503,
    );
  } finally {
    mongoose.connection.readyState = originalReadyState;
  }
});

test('rejects an invalid agent ID before querying MongoDB', async () => {
  const originalReadyState = mongoose.connection.readyState;

  try {
    mongoose.connection.readyState = 1;

    await assert.rejects(
      listPersistentAgentTasks({
        agentId: 'not-a-valid-object-id',
        tenantId: 'tenant_test',
      }),
      error => error.status === 400 &&
        error.message === 'A valid authenticated agent ID is required',
    );
  } finally {
    mongoose.connection.readyState = originalReadyState;
  }
});

test('rejects a missing tenant ID before querying MongoDB', async () => {
  const originalReadyState = mongoose.connection.readyState;

  try {
    mongoose.connection.readyState = 1;

    await assert.rejects(
      listPersistentAgentTasks({
        agentId: new mongoose.Types.ObjectId().toString(),
        tenantId: '',
      }),
      error => error.status === 400 &&
        error.message === 'Authenticated tenant ID is required',
    );
  } finally {
    mongoose.connection.readyState = originalReadyState;
  }
});


test('rejects proof submission when MongoDB is unavailable', async () => {
  const originalReadyState = mongoose.connection.readyState;

  try {
    mongoose.connection.readyState = 0;

    await assert.rejects(
      submitPersistentAgentProof({
        taskId: 'TASK-001',
        agentId: new mongoose.Types.ObjectId().toString(),
        tenantId: 'tenant_test',
        fileReference: 'proof:test-image-001',
      }),
      error =>
        error.status === 503 &&
        error.message === 'Task database is unavailable',
    );
  } finally {
    mongoose.connection.readyState = originalReadyState;
  }
});

test('rejects invalid proof references', async () => {
  const originalReadyState = mongoose.connection.readyState;

  try {
    mongoose.connection.readyState = 1;

    await assert.rejects(
      submitPersistentAgentProof({
        taskId: 'TASK-001',
        agentId: 'not-a-valid-object-id',
        tenantId: 'tenant_test',
        fileReference: 'C:\\private\\image.jpg',
      }),
      error =>
        error.status === 400 &&
        error.message === 'A valid authenticated agent ID is required',
    );
  } finally {
    mongoose.connection.readyState = originalReadyState;
  }
});

test('rejects proof review when MongoDB is unavailable', async () => {
  const originalReadyState = mongoose.connection.readyState;

  try {
    mongoose.connection.readyState = 0;

    await assert.rejects(
      reviewPersistentAgentProof({
        taskId: 'TASK-001',
        reviewerId: new mongoose.Types.ObjectId().toString(),
        tenantId: 'tenant_test',
        decision: 'VERIFIED',
      }),
      error =>
        error.status === 503 &&
        error.message === 'Task database is unavailable',
    );
  } finally {
    mongoose.connection.readyState = originalReadyState;
  }
});

test('rejects invalid reviewer IDs before querying MongoDB', async () => {
  const originalReadyState = mongoose.connection.readyState;

  try {
    mongoose.connection.readyState = 1;

    await assert.rejects(
      reviewPersistentAgentProof({
        taskId: 'TASK-001',
        reviewerId: 'invalid-reviewer-id',
        tenantId: 'tenant_test',
        decision: 'VERIFIED',
      }),
      error =>
        error.status === 400 &&
        error.message === 'A valid authenticated reviewer ID is required',
    );
  } finally {
    mongoose.connection.readyState = originalReadyState;
  }
});

test('rejects missing tenant IDs before querying MongoDB', async () => {
  const originalReadyState = mongoose.connection.readyState;

  try {
    mongoose.connection.readyState = 1;

    await assert.rejects(
      reviewPersistentAgentProof({
        taskId: 'TASK-001',
        reviewerId: new mongoose.Types.ObjectId().toString(),
        tenantId: '',
        decision: 'VERIFIED',
      }),
      error =>
        error.status === 400 &&
        error.message === 'Authenticated tenant ID is required',
    );
  } finally {
    mongoose.connection.readyState = originalReadyState;
  }
});

test('rejects unsupported proof-review decisions', async () => {
  const originalReadyState = mongoose.connection.readyState;

  try {
    mongoose.connection.readyState = 1;

    const result = await reviewPersistentAgentProof({
      taskId: 'TASK-001',
      reviewerId: new mongoose.Types.ObjectId().toString(),
      tenantId: 'tenant_test',
      decision: 'APPROVED',
    });

    assert.equal(result.success, false);
    assert.equal(result.status, 400);
    assert.equal(
      result.message,
      'Decision must be VERIFIED or REJECTED',
    );
  } finally {
    mongoose.connection.readyState = originalReadyState;
  }
});