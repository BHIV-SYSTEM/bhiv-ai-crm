import express from 'express';
import { randomUUID } from 'node:crypto';

import { fieldAgentAuth } from '../middleware/fieldAgentAuth.js';

import {
  listPersistentAgentTasks,
  getPersistentAgentTask,
  transitionPersistentAgentTask,
  recordPersistentAgentArrival,
  submitPersistentAgentProof,
} from '../services/fieldAgent/persistentFieldAgentTaskService.js';

const router = express.Router();

// All endpoints in this router require strict Field Agent authentication.
router.use(fieldAgentAuth);

function getAgentContext(req) {
  return {
    agentId: String(req.user._id),
    tenantId: req.user.tenant_id,
  };
}

function getCorrelationId(req) {
  const supplied = req.get('x-correlation-id');

  // Do not accept arbitrarily long correlation identifiers.
  if (supplied && supplied.length <= 128) {
    return supplied;
  }

  return randomUUID();
}

function handleError(res, error) {
  const status = Number.isInteger(error.status) ? error.status : 500;

  if (status >= 500) {
    console.error('Field Agent API error:', error.message);
  }

  return res.status(status).json({
    success: false,
    message: status === 500
      ? 'An unexpected server error occurred.'
      : error.message,
  });
}

/**
 * GET /api/field-agent/tasks
 * Lists tasks assigned to the authenticated agent.
 */
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await listPersistentAgentTasks(getAgentContext(req));

    return res.status(200).json({
      success: true,
      tasks,
      count: tasks.length,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

/**
 * GET /api/field-agent/tasks/:taskId
 * Retrieves a task assigned to the authenticated agent.
 */
router.get('/tasks/:taskId', async (req, res) => {
  try {
    const task = await getPersistentAgentTask({
      ...getAgentContext(req),
      taskId: req.params.taskId,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
      });
    }

    return res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

/**
 * PATCH /api/field-agent/tasks/:taskId/state
 * Transitions an assigned task through the approved lifecycle.
 */
router.patch('/tasks/:taskId/state', async (req, res) => {
  try {
    const { nextState } = req.body ?? {};

    if (typeof nextState !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'nextState must be a string.',
      });
    }

    const result = await transitionPersistentAgentTask({
      ...getAgentContext(req),
      taskId: req.params.taskId,
      nextState,
      correlationId: getCorrelationId(req),
    });

    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        message: result.message,
        ...(result.reason ? { reason: result.reason } : {}),
      });
    }

    return res.status(200).json({
      success: true,
      task: result.task,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

/**
 * POST /api/field-agent/tasks/:taskId/arrival
 * Validates geofence arrival for an assigned task.
 */
router.post('/tasks/:taskId/arrival', async (req, res) => {
  try {
    const { agentLocation, accuracyMeters } = req.body ?? {};

    if (
      !agentLocation ||
      typeof agentLocation !== 'object' ||
      !Number.isFinite(agentLocation.lat) ||
      !Number.isFinite(agentLocation.lng) ||
      !Number.isFinite(accuracyMeters)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid agentLocation coordinates and accuracyMeters are required.',
      });
    }

    const result = await recordPersistentAgentArrival({
      ...getAgentContext(req),
      taskId: req.params.taskId,
      agentLocation: {
        lat: agentLocation.lat,
        lng: agentLocation.lng,
      },
      accuracyMeters,
      correlationId: getCorrelationId(req),
    });

    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        message: result.message,
        ...(result.decision ? { decision: result.decision } : {}),
      });
    }

    return res.status(200).json({
      success: true,
      decision: result.decision,
      task: result.task,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post('/tasks/:taskId/proof', async (req, res) => {
  try {
    const result = await submitPersistentAgentProof({
      taskId: req.params.taskId,
      agentId: req.user._id,
      tenantId: req.user.tenant_id,
      fileReference: req.body?.fileReference,
      correlationId: getCorrelationId(req),
    });

    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(201).json(result);
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;

