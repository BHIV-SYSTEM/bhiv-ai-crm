import express from 'express';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import RestockRequest from '../models/RestockRequest.js';
import FieldAgentTask from '../models/FieldAgentTask.js';
import { protect } from '../middleware/auth.js';
import { isAdminOrManager } from '../middleware/authorize.js';
import { HTTP_STATUS, ORDER_STATUS, USER_ROLES, RESTOCK_STATUS } from '../config/constants.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', async (req, res) => {
  try {
    const stats = {};

    // User statistics (Admin/Manager only)
    if (req.user.role === USER_ROLES.ADMIN || req.user.role === USER_ROLES.MANAGER) {
      const totalUsers = await User.countDocuments();
      const activeCustomers = await User.countDocuments({ 
        role: USER_ROLES.CUSTOMER, 
        isActive: true 
      });
      
      stats.users = {
        total: totalUsers,
        activeCustomers,
        adminCount: await User.countDocuments({ role: USER_ROLES.ADMIN }),
        managerCount: await User.countDocuments({ role: USER_ROLES.MANAGER }),
        customerCount: await User.countDocuments({ role: USER_ROLES.CUSTOMER })
      };
    }

    // Product statistics
    const totalProducts = await Product.countDocuments({ isActive: true });
    const lowStockProducts = await Product.countDocuments({
      $expr: { $lt: ['$stockQuantity', '$minThreshold'] },
      isActive: true
    });
    const outOfStock = await Product.countDocuments({ stockQuantity: 0, isActive: true });

    stats.products = {
      total: totalProducts,
      lowStock: lowStockProducts,
      outOfStock
    };

    // Order statistics
    let orderQuery = {};
    if (req.user.role === USER_ROLES.CUSTOMER) {
      orderQuery.customerId = req.user._id;
    }

    const totalOrders = await Order.countDocuments(orderQuery);
    const placedOrders = await Order.countDocuments({ ...orderQuery, status: ORDER_STATUS.PLACED });
    const dispatchedOrders = await Order.countDocuments({ ...orderQuery, status: ORDER_STATUS.DISPATCHED });
    const deliveredOrders = await Order.countDocuments({ ...orderQuery, status: ORDER_STATUS.DELIVERED });

    stats.orders = {
      total: totalOrders,
      placed: placedOrders,
      dispatched: dispatchedOrders,
      delivered: deliveredOrders
    };

    // Revenue statistics (Admin/Manager only)
    if (req.user.role === USER_ROLES.ADMIN || req.user.role === USER_ROLES.MANAGER) {
      const deliveredOrdersList = await Order.find({ status: ORDER_STATUS.DELIVERED });
      const totalRevenue = deliveredOrdersList.reduce((sum, order) => sum + order.totalAmount, 0);

      const products = await Product.find({ isActive: true });
      const totalInventoryValue = products.reduce((sum, p) => sum + (p.costPrice * p.stockQuantity), 0);

      stats.revenue = {
        total: totalRevenue.toFixed(2),
        inventoryValue: totalInventoryValue.toFixed(2)
      };

      // Restock statistics
      const pendingRestocks = await RestockRequest.countDocuments({
        status: { $in: [RESTOCK_STATUS.PENDING, RESTOCK_STATUS.EMAIL_SENT] }
      });

      stats.restock = {
        pending: pendingRestocks
      };
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/dashboard/recent-activity
// @desc    Get recent activity
// @access  Private
router.get('/recent-activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    let orderQuery = {};
    if (req.user.role === USER_ROLES.CUSTOMER) {
      orderQuery.customerId = req.user._id;
    }

    const recentOrders = await Order.find(orderQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('customerId', 'name email shopDetails')
      .populate('items.productId', 'name sku');

    let lowStockProducts = [];
    if (req.user.role === USER_ROLES.ADMIN || req.user.role === USER_ROLES.MANAGER) {
      lowStockProducts = await Product.find({
        $expr: { $lt: ['$stockQuantity', '$minThreshold'] },
        isActive: true
      })
        .sort({ stockQuantity: 1 })
        .limit(limit);
    }

    res.json({
      success: true,
      data: {
        recentOrders,
        lowStockProducts
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/dashboard/alerts
// @desc    Get system alerts
// @access  Private/Admin/Manager
router.get('/alerts', isAdminOrManager, async (req, res) => {
  try {
    const alerts = [];

    // Low stock alerts
    const lowStockProducts = await Product.find({
      $expr: { $lt: ['$stockQuantity', '$minThreshold'] },
      isActive: true
    }).limit(20);

    lowStockProducts.forEach(product => {
      alerts.push({
        type: 'low_stock',
        severity: product.stockQuantity === 0 ? 'critical' : 'warning',
        message: `${product.name} (${product.sku}) - Stock: ${product.stockQuantity} ${product.unit}`,
        productId: product._id,
        timestamp: new Date()
      });
    });

    // Pending restock requests
    const pendingRestocks = await RestockRequest.find({
      status: { $in: [RESTOCK_STATUS.PENDING, RESTOCK_STATUS.EMAIL_SENT] }
    })
      .populate('productId', 'name sku')
      .limit(20);

    pendingRestocks.forEach(request => {
      alerts.push({
        type: 'restock_pending',
        severity: 'info',
        message: `Pending restock for ${request.productName} - ${request.requestedQuantity} units`,
        requestId: request._id,
        timestamp: request.createdAt
      });
    });

    // Pending orders
    const pendingOrders = await Order.countDocuments({ status: ORDER_STATUS.PLACED });
    if (pendingOrders > 0) {
      alerts.push({
        type: 'pending_orders',
        severity: 'info',
        message: `${pendingOrders} order(s) waiting to be dispatched`,
        count: pendingOrders,
        timestamp: new Date()
      });
    }

    // Field Agent Proof & Arrival Alerts for Manager/Admin operational review
    const pendingTasks = await FieldAgentTask.find({
      $or: [
        { state: { $in: ['PROOF_SUBMITTED', 'REVIEW_REQUIRED'] } },
        { 'proof.reviewState': 'REVIEW_REQUIRED' },
        { state: 'ARRIVED' }
      ]
    })
      .populate('assignedAgentId', 'name email')
      .sort({ updatedAt: -1 })
      .limit(30);

    pendingTasks.forEach(task => {
      const isProof = task.state === 'PROOF_SUBMITTED' || task.proof?.reviewState === 'REVIEW_REQUIRED';
      const agentName = task.assignedAgentId?.name || 'Field Agent';

      if (isProof) {
        alerts.push({
          id: `fa_proof_${task.taskId}`,
          type: 'field_proof',
          severity: 'critical',
          title: `Storefront Proof Submitted: ${task.store?.name || 'Retail Store'}`,
          message: `${agentName} uploaded storefront signboard photo proof for ${task.store?.name || task.taskId}. Review and approval required.`,
          taskId: task.taskId,
          storeId: task.store?.storeId,
          storeName: task.store?.name,
          targetUrl: `/field-reviews?taskId=${task.taskId}`,
          timestamp: task.proof?.submittedAt || task.updatedAt || new Date()
        });
      } else if (task.state === 'ARRIVED') {
        alerts.push({
          id: `fa_arrived_${task.taskId}`,
          type: 'field_arrived',
          severity: 'warning',
          title: `Field Agent Arrived: ${task.store?.name || 'Retail Store'}`,
          message: `${agentName} reached 50m geofence for ${task.store?.name || task.taskId}.`,
          taskId: task.taskId,
          storeId: task.store?.storeId,
          storeName: task.store?.name,
          targetUrl: `/field-reviews?taskId=${task.taskId}`,
          timestamp: task.arrivalEvidence?.evaluatedAt || task.updatedAt || new Date()
        });
      }
    });

    // Recent Field Task Determinations (Verified or Rejected in last 24h)
    const recentResolved = await FieldAgentTask.find({
      state: { $in: ['VERIFIED', 'REJECTED'] },
      updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
      .populate('assignedAgentId', 'name email')
      .sort({ updatedAt: -1 })
      .limit(10);

    recentResolved.forEach(task => {
      const isVerified = task.state === 'VERIFIED';
      alerts.push({
        id: `fa_resolved_${task.taskId}`,
        type: isVerified ? 'field_verified' : 'field_rejected',
        severity: isVerified ? 'info' : 'warning',
        title: `Storefront Proof ${isVerified ? 'Verified ✓' : 'Rejected ✗'}: ${task.store?.name}`,
        message: `Task ${task.taskId} for ${task.store?.name} was marked ${task.state}.`,
        taskId: task.taskId,
        storeId: task.store?.storeId,
        storeName: task.store?.name,
        targetUrl: `/field-reviews?taskId=${task.taskId}`,
        timestamp: task.updatedAt || new Date()
      });
    });

    // Sort by severity and timestamp
    alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const sevA = severityOrder[a.severity] ?? 3;
      const sevB = severityOrder[b.severity] ?? 3;
      if (sevA !== sevB) return sevA - sevB;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    res.json({
      success: true,
      data: { alerts }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/dashboard/charts
// @desc    Get dashboard charts data
// @access  Private
router.get('/charts', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).limit(10);
    const categoryCounts = {};
    products.forEach(p => {
      const cat = p.category || 'General';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + (p.stockQuantity || 10);
    });

    const labels = Object.keys(categoryCounts).length > 0 ? Object.keys(categoryCounts) : ['Tools', 'Hardware', 'Electrical', 'Plumbing'];
    const currentStock = Object.values(categoryCounts).length > 0 ? Object.values(categoryCounts) : [150, 220, 180, 95];

    res.json({
      success: true,
      data: {
        orderStatus: {
          PLACED: await Order.countDocuments({ status: ORDER_STATUS.PLACED }),
          DISPATCHED: await Order.countDocuments({ status: ORDER_STATUS.DISPATCHED }),
          DELIVERED: await Order.countDocuments({ status: ORDER_STATUS.DELIVERED }),
          CANCELLED: await Order.countDocuments({ status: ORDER_STATUS.CANCELLED })
        },
        inventory: {
          labels,
          currentStock,
          minThreshold: labels.map(() => 20)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
