import express from 'express';
import RestockRequest from '../models/RestockRequest.js';
import Product from '../models/Product.js';
import { protect } from '../middleware/auth.js';
import { isAdminOrManager } from '../middleware/authorize.js';
import { HTTP_STATUS, RESTOCK_STATUS, INVENTORY_CHANGE_TYPE } from '../config/constants.js';
import emailService from '../services/emailService.js';
import InventoryLog from '../models/InventoryLog.js';
import { publishPurchaseApproved } from '../services/arthaEventPublisher.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/restock
// @desc    Get all restock requests
// @access  Private/Admin/Manager
router.get('/', isAdminOrManager, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    
    const query = {};
    
    if (status) {
      query.status = status;
    }

    const requests = await RestockRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('productId', 'name sku stockQuantity minThreshold')
      .populate('restockedBy', 'name email');

    const total = await RestockRequest.countDocuments(query);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/restock/run-procurement
// @desc    Run procurement agent: create restock requests for low-stock products and email suppliers
// @access  Private/Admin/Manager
router.post('/run-procurement', isAdminOrManager, async (req, res) => {
  try {
    const lowStockProducts = await Product.find({
      isActive: true,
      $expr: { $lt: ['$stockQuantity', '$minThreshold'] }
    }).sort({ stockQuantity: 1 });

    const results = [];
    let createdRequests = 0;
    let emailed = 0;
    let skippedMissingSupplierEmail = 0;
    let skippedAlreadyEmailed = 0;
    let failures = 0;

    for (const product of lowStockProducts) {
      const supplierEmail = product?.supplier?.email;
      const supplierName = product?.supplier?.name;

      if (!supplierEmail) {
        skippedMissingSupplierEmail += 1;
        results.push({
          productId: product._id,
          productName: product.name,
          sku: product.sku,
          currentStock: product.stockQuantity,
          threshold: product.minThreshold,
          supplierEmail: null,
          restockRequestId: null,
          created: false,
          emailSent: false,
          status: 'skipped',
          reason: 'missing_supplier_email'
        });
        continue;
      }

      const requestedQuantity = Math.max((product.minThreshold || 0) - (product.stockQuantity || 0), 1);

      const existingOpen = await RestockRequest.findOne({
        productId: product._id,
        status: { $in: [RESTOCK_STATUS.PENDING, RESTOCK_STATUS.EMAIL_SENT] }
      }).sort({ createdAt: -1 });

      if (existingOpen && existingOpen.status === RESTOCK_STATUS.EMAIL_SENT && existingOpen.emailSentAt) {
        skippedAlreadyEmailed += 1;
        results.push({
          productId: product._id,
          productName: product.name,
          sku: product.sku,
          currentStock: product.stockQuantity,
          threshold: product.minThreshold,
          supplierEmail,
          restockRequestId: existingOpen._id,
          created: false,
          emailSent: true,
          status: 'skipped',
          reason: 'already_emailed'
        });
        continue;
      }

      let request = existingOpen;
      let created = false;

      if (!request) {
        request = await RestockRequest.create({
          productId: product._id,
          productName: product.name,
          sku: product.sku,
          currentStock: product.stockQuantity,
          threshold: product.minThreshold,
          requestedQuantity,
          supplierEmail,
          supplierName,
          status: RESTOCK_STATUS.PENDING
        });
        createdRequests += 1;
        created = true;
      } else {
        request.productName = product.name;
        request.sku = product.sku;
        request.currentStock = product.stockQuantity;
        request.threshold = product.minThreshold;
        request.requestedQuantity = requestedQuantity;
        request.supplierEmail = request.supplierEmail || supplierEmail;
        request.supplierName = request.supplierName || supplierName;
        await request.save();
      }

      const emailResult = await emailService.sendRestockEmail(product, request);

      if (emailResult.success) {
        request.emailSentAt = new Date();
        request.status = RESTOCK_STATUS.EMAIL_SENT;
        await request.save();
        emailed += 1;

        results.push({
          productId: product._id,
          productName: product.name,
          sku: product.sku,
          currentStock: product.stockQuantity,
          threshold: product.minThreshold,
          supplierEmail,
          restockRequestId: request._id,
          created,
          emailSent: true,
          status: 'emailed'
        });
      } else {
        failures += 1;
        results.push({
          productId: product._id,
          productName: product.name,
          sku: product.sku,
          currentStock: product.stockQuantity,
          threshold: product.minThreshold,
          supplierEmail,
          restockRequestId: request._id,
          created,
          emailSent: false,
          status: 'failed',
          error: emailResult.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Procurement run completed',
      data: {
        lowStockProducts: lowStockProducts.length,
        createdRequests,
        emailed,
        skippedMissingSupplierEmail,
        skippedAlreadyEmailed,
        failures,
        results
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/restock/:id/resend-email
// @desc    Resend restock email
// @access  Private/Admin/Manager
router.post('/:id/resend-email', isAdminOrManager, async (req, res) => {
  try {
    const request = await RestockRequest.findById(req.params.id).populate('productId');

    if (!request) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Restock request not found'
      });
    }

    const emailResult = await emailService.sendRestockEmail(request.productId, request);

    if (emailResult.success) {
      request.emailSentAt = new Date();
      request.status = RESTOCK_STATUS.EMAIL_SENT;
      await request.save();

      res.json({
        success: true,
        message: 'Restock email sent successfully'
      });
    } else {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to send email: ' + emailResult.message
      });
    }
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/restock/:id/complete
// @desc    Mark restock request as completed
// @access  Private/Admin/Manager
router.put('/:id/complete', isAdminOrManager, async (req, res) => {
  try {
    const { receivedQuantity, notes } = req.body;

    const request = await RestockRequest.findById(req.params.id);

    if (!request) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Restock request not found'
      });
    }

    const product = await Product.findById(request.productId);

    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Update product stock
    const previousStock = product.stockQuantity;
    product.stockQuantity += receivedQuantity || request.requestedQuantity;
    await product.save();

    // Create inventory log
    await InventoryLog.create({
      productId: product._id,
      changeType: INVENTORY_CHANGE_TYPE.RESTOCK,
      quantityChanged: receivedQuantity || request.requestedQuantity,
      previousStock,
      newStock: product.stockQuantity,
      performedBy: req.user._id,
      notes: notes || `Restock from request ${request._id}`
    });

    // Update restock request
    request.status = RESTOCK_STATUS.RESTOCKED;
    request.restockedAt = new Date();
    request.restockedBy = req.user._id;
    request.notes = notes;
    await request.save();

    // Create the ARTHA vendor bill/payable (fire-and-forget, idempotent by restock id)
    setImmediate(() => {
      publishPurchaseApproved({
        request,
        product,
        receivedQuantity: receivedQuantity || request.requestedQuantity,
        actorUser: req.user,
      }).catch((e) => console.warn('Failed to publish supplier.purchase-approved to ARTHA:', e.message));
    });

    const populatedRequest = await RestockRequest.findById(request._id)
      .populate('productId', 'name sku stockQuantity minThreshold')
      .populate('restockedBy', 'name email');

    res.json({
      success: true,
      message: 'Restock completed successfully',
      data: { request: populatedRequest, product }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/restock/stats/summary
// @desc    Get restock statistics
// @access  Private/Admin/Manager
router.get('/stats/summary', isAdminOrManager, async (req, res) => {
  try {
    const totalRequests = await RestockRequest.countDocuments();
    const pendingRequests = await RestockRequest.countDocuments({ 
      status: { $in: [RESTOCK_STATUS.PENDING, RESTOCK_STATUS.EMAIL_SENT] }
    });
    const completedRequests = await RestockRequest.countDocuments({ 
      status: RESTOCK_STATUS.RESTOCKED 
    });

    res.json({
      success: true,
      data: {
        totalRequests,
        pendingRequests,
        completedRequests
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
