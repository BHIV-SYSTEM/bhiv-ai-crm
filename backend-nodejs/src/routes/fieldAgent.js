import express from 'express';
import multer from 'multer';

import { storeProofImage, deleteProofImage } from '../services/fieldAgent/proofStorageService.js';
import { randomUUID } from 'node:crypto';

import { fieldAgentAuth } from '../middleware/fieldAgentAuth.js';

import { fieldAgentReviewerAuth } from '../middleware/fieldAgentReviewerAuth.js';
import { reviewPersistentAgentProof } from '../services/fieldAgent/persistentFieldAgentTaskService.js';

import {
  listPersistentAgentTasks,
  getPersistentAgentTask,
  transitionPersistentAgentTask,
  recordPersistentAgentArrival,
  submitPersistentAgentProof,
} from '../services/fieldAgent/persistentFieldAgentTaskService.js';

const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);

    const allowedExtensions = /\.(jpe?g|png|webp)$/i;
    const extensionMatches = allowedExtensions.test(file.originalname || '');

    if (!allowedMimeTypes.has(file.mimetype) || !extensionMatches) {
      const error = new Error('Only JPEG, PNG, and WebP images are accepted.');
      error.status = 400;
      return callback(error);
    }

    callback(null, true);
  },
});
const router = express.Router();

function handleProofUpload(req, res, next) {
  proofUpload.single('file')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Image must not exceed 5 MB.'
        : 'Invalid proof upload. Upload one image using the "file" field.';

      return res.status(status).json({
        success: false,
        message,
      });
    }

    return handleError(res, error);
  });
}

// All endpoints in this router require strict Field Agent authentication.

/**
 * PATCH /api/field-agent/reviews/:taskId
 * Allows authorized reviewers to verify or reject submitted storefront proof.
 */
router.patch(
  '/reviews/:taskId',
  fieldAgentReviewerAuth,
  async (req, res) => {
    try {
      const { decision, reason } = req.body ?? {};

      if (typeof decision !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'decision must be VERIFIED or REJECTED.',
        });
      }

      const result = await reviewPersistentAgentProof({
        taskId: req.params.taskId,
        reviewerId: req.user._id,
        tenantId: req.user.tenant_id,
        decision,
        reason: reason ?? null,
        correlationId: getCorrelationId(req),
      });

      if (!result.success) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
        });
      }

      return res.status(200).json({
        success: true,
        task: result.task,
      });
    } catch (error) {
      return handleError(res, error);
    }
  },
);


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

router.post('/tasks/:taskId/proof', handleProofUpload, async (req, res) => {
  let storedProof = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'An image file is required in the "file" field.',
      });
    }

    storedProof = await storeProofImage(req.file.buffer);

    const result = await submitPersistentAgentProof({
      taskId: req.params.taskId,
      agentId: req.user._id,
      tenantId: req.user.tenant_id,
      fileReference: storedProof.fileReference,
      correlationId: getCorrelationId(req),
    });

    if (!result.success) {
      await deleteProofImage(storedProof.fileReference);

      return res.status(result.status).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(201).json({
      ...result,
      proofFile: {
        fileReference: storedProof.fileReference,
        mimeType: storedProof.mimeType,
        sizeBytes: storedProof.sizeBytes,
        sha256: storedProof.sha256,
      },
    });
  } catch (error) {
    if (storedProof) {
      try {
        await deleteProofImage(storedProof.fileReference);
      } catch (cleanupError) {
        console.error('Failed to clean up proof image:', cleanupError.message);
      }
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'Image must not exceed 5 MB.',
      });
    }

    return handleError(res, error);
  }
});

export default router;





