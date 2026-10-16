import express from 'express';
import { randomUUID } from 'node:crypto';
import FieldAgentTask from '../models/FieldAgentTask.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { isAdminOrManager } from '../middleware/authorize.js';
import { HTTP_STATUS, USER_ROLES } from '../config/constants.js';

const router = express.Router();

// Strict Admin/Manager authorization
router.use(protect);
router.use(isAdminOrManager);

/**
 * GET /api/field-reviews
 * Returns all field agent tasks for operational approval / review by Admin & Manager.
 */
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    if (status === 'pending') {
      query.$or = [
        { state: { $in: ['PROOF_SUBMITTED', 'REVIEW_REQUIRED', 'ARRIVED'] } },
        { 'proof.reviewState': 'REVIEW_REQUIRED' },
      ];
    } else if (status === 'verified') {
      query.state = { $in: ['VERIFIED', 'COMPLETED'] };
    } else if (status === 'rejected') {
      query.state = 'REJECTED';
    }

function formatTaskForReview(taskDoc) {
  if (!taskDoc) return taskDoc;
  const task = typeof taskDoc.toObject === 'function' ? taskDoc.toObject() : { ...taskDoc };
  if (task.proof?.fileReference?.startsWith('proof:')) {
    task.proof.imageUrl = `/api/field-agent/proof/${encodeURIComponent(task.proof.fileReference)}`;
  }
  return task;
}

    const tasks = await FieldAgentTask.find(query)
      .populate('assignedAgentId', 'name email role')
      .sort({ updatedAt: -1 });

    const formattedTasks = tasks.map(formatTaskForReview);

    const totalCount = await FieldAgentTask.countDocuments();
    const pendingCount = await FieldAgentTask.countDocuments({
      $or: [
        { state: { $in: ['PROOF_SUBMITTED', 'REVIEW_REQUIRED', 'ARRIVED'] } },
        { 'proof.reviewState': 'REVIEW_REQUIRED' },
      ],
    });
    const verifiedCount = await FieldAgentTask.countDocuments({
      state: { $in: ['VERIFIED', 'COMPLETED'] },
    });
    const rejectedCount = await FieldAgentTask.countDocuments({
      state: 'REJECTED',
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      count: formattedTasks.length,
      tasks: formattedTasks,
      summary: {
        total: totalCount,
        pending: pendingCount,
        verified: verifiedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    console.error('Error fetching field reviews:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Failed to fetch field task reviews',
    });
  }
});

/**
 * GET /api/field-reviews/agents
 * List available field agents for task assignment.
 */
router.get('/agents', async (req, res) => {
  try {
    const agents = await User.find({ role: USER_ROLES.FIELD_AGENT })
      .select('name email role tenant_id')
      .lean();

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      agents,
    });
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Failed to fetch field agents',
    });
  }
});

/**
 * POST /api/field-reviews/tasks
 * Allows Admin or Manager to create and dispatch a new Field Agent task.
 */
router.post('/tasks', async (req, res) => {
  try {
    const {
      storeName,
      storeId,
      address,
      phone,
      location,
      assignedAgentId,
      items,
      notes,
    } = req.body;

    if (!storeName || !storeName.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Store name is required.',
      });
    }

    // Resolve or validate the assigned agent
    let targetAgentId = assignedAgentId;
    if (!targetAgentId) {
      const defaultAgent = await User.findOne({ role: USER_ROLES.FIELD_AGENT });
      if (defaultAgent) {
        targetAgentId = defaultAgent._id;
      } else {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'No field agent found. Please assign an agent.',
        });
      }
    }

    // Default Mumbai coordinates if not supplied
    const lat = Number(location?.lat) || 19.1197;
    const lng = Number(location?.lng) || 72.8464;

    const generatedTaskId = `TASK-FA-MUM-${Date.now().toString().slice(-4)}`;
    const generatedStoreId = storeId?.trim() || `STR-MUM-${Date.now().toString().slice(-4)}`;

    const newTask = await FieldAgentTask.create({
      taskId: generatedTaskId,
      tenantId: req.user.tenant_id || 'tenant_sampada_001',
      assignedAgentId: targetAgentId,
      store: {
        storeId: generatedStoreId,
        name: storeName.trim(),
        address: address?.trim() || 'Mumbai Distribution Hub Area, Maharashtra',
        phone: phone?.trim() || '+91 98201 44552',
        location: { lat, lng },
      },
      items: Array.isArray(items) && items.length > 0 ? items : [
        { id: 1, name: 'Standard Wholesale Spice Pack', quantity: '25 kg', packageType: 'Bales', checked: false }
      ],
      state: 'ASSIGNED',
      auditEvents: [
        {
          eventId: `EV-${randomUUID()}`,
          actorId: req.user._id,
          eventType: 'TASK_CREATED',
          currentState: 'ASSIGNED',
          occurredAt: new Date(),
          details: {
            createdBy: req.user.name,
            role: req.user.role,
            notes: notes || 'Created via Operations Dispatcher Portal',
          },
        },
      ],
    });

    const populatedTask = await FieldAgentTask.findById(newTask._id)
      .populate('assignedAgentId', 'name email role');

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: `Task ${generatedTaskId} successfully dispatched to field agent!`,
      task: populatedTask,
    });
  } catch (error) {
    console.error('Error creating field task:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Failed to create field task',
    });
  }
});

/**
 * GET /api/field-reviews/:taskId
 * Returns a specific field task for detailed inspection.
 */
router.get('/:taskId', async (req, res) => {
  try {
    const task = await FieldAgentTask.findOne({ taskId: req.params.taskId })
      .populate('assignedAgentId', 'name email role');

    if (!task) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Field task not found',
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      task: formatTaskForReview(task),
    });
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/field-reviews/:taskId/approve
 * Approves storefront proof and marks task as VERIFIED.
 */
router.post('/:taskId/approve', async (req, res) => {
  try {
    const { notes } = req.body || {};
    const task = await FieldAgentTask.findOne({ taskId: req.params.taskId })
      .populate('assignedAgentId', 'name email');

    if (!task) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: `Task ${req.params.taskId} not found`,
      });
    }

    const previousState = task.state;
    task.state = 'VERIFIED';

    if (task.proof) {
      task.proof.reviewState = 'VERIFIED';
    } else {
      task.proof = {
        proofId: `proof:manager_manual_${Date.now()}`,
        fileReference: 'Verified by Manager in Portal',
        submittedAt: new Date(),
        reviewState: 'VERIFIED',
        ocrStatus: 'COMPLETED',
      };
    }

    const auditEvent = {
      eventId: `EV-APP-${randomUUID()}`,
      actorId: req.user._id,
      eventType: 'PROOF_APPROVED',
      previousState,
      currentState: 'VERIFIED',
      occurredAt: new Date(),
      details: {
        reviewerId: req.user._id,
        reviewerName: req.user.name,
        reviewerRole: req.user.role,
        notes: notes || 'Storefront proof verified and approved by manager',
      },
    };

    task.auditEvents.push(auditEvent);
    task.markModified('proof');
    task.markModified('auditEvents');
    await task.save();

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Storefront proof for ${task.store?.name} approved successfully.`,
      task,
    });
  } catch (error) {
    console.error('Error approving field proof:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Failed to approve field proof',
    });
  }
});

/**
 * POST /api/field-reviews/:taskId/reject
 * Rejects storefront proof with reason and marks task as REJECTED.
 */
router.post('/:taskId/reject', async (req, res) => {
  try {
    const { reason } = req.body || {};
    const rejectionReason = reason || 'Storefront signboard or geofence verification failed inspection';

    const task = await FieldAgentTask.findOne({ taskId: req.params.taskId })
      .populate('assignedAgentId', 'name email');

    if (!task) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: `Task ${req.params.taskId} not found`,
      });
    }

    const previousState = task.state;
    task.state = 'REJECTED';

    if (task.proof) {
      task.proof.reviewState = 'REJECTED';
      if (!task.proof.extractedFields) task.proof.extractedFields = {};
      task.proof.extractedFields.rejectionReason = rejectionReason;
    }

    const auditEvent = {
      eventId: `EV-REJ-${randomUUID()}`,
      actorId: req.user._id,
      eventType: 'PROOF_REJECTED',
      previousState,
      currentState: 'REJECTED',
      occurredAt: new Date(),
      details: {
        reviewerId: req.user._id,
        reviewerName: req.user.name,
        reviewerRole: req.user.role,
        reason: rejectionReason,
      },
    };

    task.auditEvents.push(auditEvent);
    task.markModified('proof');
    task.markModified('auditEvents');
    await task.save();

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Storefront proof for ${task.store?.name} rejected.`,
      task,
    });
  } catch (error) {
    console.error('Error rejecting field proof:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Failed to reject field proof',
    });
  }
});

export default router;
