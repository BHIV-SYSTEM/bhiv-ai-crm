import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FIELD_TASK_STATES,
  ALLOWED_TRANSITIONS,
  GEOFENCE_RADIUS_METERS,
  calculateDistanceMeters,
  validateArrival,
  validateTaskTransition,
} from '../src/services/fieldAgent/fieldAgentLifecycle.js';

test('defines the required field task lifecycle states', () => {
  assert.deepEqual(Object.values(FIELD_TASK_STATES), [
    'ASSIGNED',
    'ACCEPTED',
    'EN_ROUTE',
    'ARRIVED',
    'PROOF_SUBMITTED',
    'REVIEW_REQUIRED',
    'VERIFIED',
    'REJECTED',
    'COMPLETED',
  ]);
});

test('allows valid task transitions', () => {
  assert.equal(validateTaskTransition('ASSIGNED', 'ACCEPTED').allowed, true);
  assert.equal(validateTaskTransition('ACCEPTED', 'EN_ROUTE').allowed, true);
  assert.equal(validateTaskTransition('REVIEW_REQUIRED', 'VERIFIED').allowed, true);
  assert.equal(validateTaskTransition('REVIEW_REQUIRED', 'REJECTED').allowed, true);
});

test('rejects invalid and backward task transitions', () => {
  assert.equal(
    validateTaskTransition('ASSIGNED', 'COMPLETED').allowed,
    false,
  );

  assert.equal(
    validateTaskTransition('COMPLETED', 'ASSIGNED').allowed,
    false,
  );

  assert.equal(
    validateTaskTransition('UNKNOWN', 'ACCEPTED').reason,
    'UNKNOWN_CURRENT_STATE',
  );

  assert.equal(
    validateTaskTransition('ASSIGNED', 'UNKNOWN').reason,
    'UNKNOWN_NEXT_STATE',
  );
});

test('terminal states cannot transition further', () => {
  for (const state of ['REJECTED', 'COMPLETED']) {
    assert.deepEqual(ALLOWED_TRANSITIONS[state], []);
  }
});

test('uses a 50 metre geofence', () => {
  assert.equal(GEOFENCE_RADIUS_METERS, 50);
});

test('calculates zero distance for identical coordinates', () => {
  const point = { lat: 19.076, lng: 72.8777 };

  assert.equal(calculateDistanceMeters(point, point), 0);
});

test('calculates a positive distance between different coordinates', () => {
  const distance = calculateDistanceMeters(
    { lat: 19.076, lng: 72.8777 },
    { lat: 19.077, lng: 72.8777 },
  );

  assert.ok(distance > 100);
  assert.ok(distance < 120);
});

test('confirms arrival inside the geofence with acceptable accuracy', () => {
  const result = validateArrival({
    agentLocation: { lat: 19.076, lng: 72.8777 },
    storeLocation: { lat: 19.076, lng: 72.8777 },
    accuracyMeters: 5,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.outcome, 'ARRIVAL_CONFIRMED');
  assert.equal(result.radiusMeters, 50);
  assert.ok(result.evaluatedAt);
});

test('rejects arrival outside the geofence', () => {
  const result = validateArrival({
    agentLocation: { lat: 19.077, lng: 72.8777 },
    storeLocation: { lat: 19.076, lng: 72.8777 },
    accuracyMeters: 5,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.outcome, 'OUTSIDE_GEOFENCE');
});

test('rejects invalid GPS accuracy', () => {
  for (const accuracyMeters of [-1, NaN, Infinity]) {
    const result = validateArrival({
      agentLocation: { lat: 19.076, lng: 72.8777 },
      storeLocation: { lat: 19.076, lng: 72.8777 },
      accuracyMeters,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.outcome, 'REJECTED_INVALID_ACCURACY');
  }
});

test('rejects invalid coordinates', () => {
  const result = validateArrival({
    agentLocation: { lat: 200, lng: 72.8777 },
    storeLocation: { lat: 19.076, lng: 72.8777 },
    accuracyMeters: 5,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.outcome, 'REJECTED_INVALID_COORDINATES');
});