export const FIELD_TASK_STATES = Object.freeze({
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  EN_ROUTE: 'EN_ROUTE',
  ARRIVED: 'ARRIVED',
  PROOF_SUBMITTED: 'PROOF_SUBMITTED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
});

export const ALLOWED_TRANSITIONS = Object.freeze({
  ASSIGNED: ['ACCEPTED'],
  ACCEPTED: ['EN_ROUTE'],
  EN_ROUTE: ['ARRIVED'],
  ARRIVED: ['PROOF_SUBMITTED'],
  PROOF_SUBMITTED: ['REVIEW_REQUIRED'],
  REVIEW_REQUIRED: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['COMPLETED'],
  REJECTED: [],
  COMPLETED: [],
});

export const GEOFENCE_RADIUS_METERS = 50;

const EARTH_RADIUS_METERS = 6_371_000;

function isValidCoordinate(value, min, max) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

export function calculateDistanceMeters(pointA, pointB) {
  if (
    !pointA ||
    !pointB ||
    !isValidCoordinate(pointA.lat, -90, 90) ||
    !isValidCoordinate(pointA.lng, -180, 180) ||
    !isValidCoordinate(pointB.lat, -90, 90) ||
    !isValidCoordinate(pointB.lng, -180, 180)
  ) {
    throw new TypeError('Valid latitude and longitude are required');
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const lat1 = toRadians(pointA.lat);
  const lat2 = toRadians(pointB.lat);
  const deltaLat = toRadians(pointB.lat - pointA.lat);
  const deltaLng = toRadians(pointB.lng - pointA.lng);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

  const boundedHaversine = Math.min(1, Math.max(0, haversine));

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(
      Math.sqrt(boundedHaversine),
      Math.sqrt(1 - boundedHaversine),
    )
  );
}

export function validateArrival({
  agentLocation,
  storeLocation,
  accuracyMeters,
}) {
  if (
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters < 0
  ) {
    return {
      allowed: false,
      outcome: 'REJECTED_INVALID_ACCURACY',
      distanceMeters: null,
      radiusMeters: GEOFENCE_RADIUS_METERS,
    };
  }

  let distanceMeters;

  try {
    distanceMeters = calculateDistanceMeters(
      agentLocation,
      storeLocation,
    );
  } catch {
    return {
      allowed: false,
      outcome: 'REJECTED_INVALID_COORDINATES',
      distanceMeters: null,
      radiusMeters: GEOFENCE_RADIUS_METERS,
    };
  }

  // Require the reported accuracy circle to fit inside the geofence.
  const allowed = distanceMeters + accuracyMeters <= GEOFENCE_RADIUS_METERS;

  return {
    allowed,
    outcome: allowed ? 'ARRIVAL_CONFIRMED' : 'OUTSIDE_GEOFENCE',
    distanceMeters: Math.round(distanceMeters * 100) / 100,
    accuracyMeters,
    radiusMeters: GEOFENCE_RADIUS_METERS,
    evaluatedAt: new Date().toISOString(),
  };
}

export function validateTaskTransition(currentState, nextState) {
  if (!Object.hasOwn(ALLOWED_TRANSITIONS, currentState)) {
    return {
      allowed: false,
      reason: 'UNKNOWN_CURRENT_STATE',
    };
  }

  if (!Object.hasOwn(ALLOWED_TRANSITIONS, nextState)) {
    return {
      allowed: false,
      reason: 'UNKNOWN_NEXT_STATE',
    };
  }

  if (!ALLOWED_TRANSITIONS[currentState].includes(nextState)) {
    return {
      allowed: false,
      reason: 'INVALID_STATE_TRANSITION',
    };
  }

  return {
    allowed: true,
    reason: null,
  };
}