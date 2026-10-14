import express from 'express';
import { protect } from '../middleware/auth.js';
import { denyPortalRoles } from '../middleware/authorize.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

const router = express.Router();

// All routes require authentication
router.use(protect);
// Staff-only: the query engine reads company-wide CRM data
router.use(denyPortalRoles);

// @route   POST /api/llm-query
// @desc    Process a natural language query about the CRM data
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { query, context = {} } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }

    const queryLower = query.toLowerCase();
    let response = {};

    const isAnalyticalQuery = /^(how|why|what strategies|explain|optimize|recommend|suggest|ways to)/i.test(queryLower) || queryLower.includes('optimize') || queryLower.includes('strategy');

    // Simple database count queries (only if not an analytical/reasoning prompt)
    if (!isAnalyticalQuery && (queryLower.includes('how many product') || queryLower.includes('inventory summary') || queryLower.includes('stock alert'))) {
      const totalProducts = await Product.countDocuments();
      const lowStockProducts = await Product.countDocuments({
        $expr: { $lte: ['$stockQuantity', '$minStockLevel'] }
      });
      const activeProducts = await Product.countDocuments({ isActive: true });

      response = {
        answer: `You have ${totalProducts} products in inventory. ${activeProducts} are active and ${lowStockProducts} are low on stock.`,
        data: { totalProducts, activeProducts, lowStockProducts },
        type: 'inventory_summary'
      };
    } else if (!isAnalyticalQuery && (queryLower.includes('pending order') || queryLower.includes('show order') || queryLower.includes('order summary'))) {
      const totalOrders = await Order.countDocuments();
      const pendingOrders = await Order.countDocuments({ status: 'pending' });
      const completedOrders = await Order.countDocuments({ status: { $in: ['completed', 'delivered'] } });

      response = {
        answer: `You have ${totalOrders} total orders. ${pendingOrders} are pending and ${completedOrders} are completed/delivered.`,
        data: { totalOrders, pendingOrders, completedOrders },
        type: 'order_summary'
      };
    } else if (queryLower.includes('help') && !isAnalyticalQuery) {
      response = {
        answer: 'I can help you with:\n- Product and inventory queries (e.g., "How many products do I have?")\n- Order information (e.g., "Show me pending orders")\n- AI reasoning and optimization advice\n\nTry asking me about your products, orders, or strategy advice!',
        type: 'help'
      };
    } else {
      // Generic query - Dispatch to UniGuru AI Reasoning Service
      try {
        const uniguruUrl = (process.env.UNIGURU_SERVICE_URL || 'http://163.128.209.18:8007').replace(/\/+$/, '');
        const apiToken = process.env.UNIGURU_API_TOKEN || '';
        const callerName = process.env.UNIGURU_CALLER_NAME || 'bhiv-setu';

        const headers = {
          'Content-Type': 'application/json',
          'X-Caller-Name': callerName
        };
        if (apiToken) {
          headers['Authorization'] = `Bearer ${apiToken}`;
          headers['X-Service-Token'] = apiToken;
        }

        const uniguruRes = await fetch(`${uniguruUrl}/ask`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query,
            context: { caller: callerName, domain: 'CRM & Inventory', ...context }
          })
        });

        if (uniguruRes.ok) {
          const resultData = await uniguruRes.json();
          response = {
            answer: resultData.answer || 'Query answered by UniGuru',
            data: resultData,
            type: 'uniguru_ai'
          };
        } else {
          throw new Error(`UniGuru returned status ${uniguruRes.status}`);
        }
      } catch (uniguruErr) {
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();

        response = {
          answer: `Here's a quick overview: You have ${totalProducts} products and ${totalOrders} orders in the system. Try asking more specific questions about your inventory or orders!`,
          data: { totalProducts, totalOrders },
          type: 'general_summary'
        };
      }
    }

    res.json({
      success: true,
      data: {
        query,
        ...response,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('LLM Query error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process query'
    });
  }
});

// @route   GET /api/llm-query/examples  
// @desc    Get example queries
// @access  Private
router.get('/examples', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        examples: [
          'How many products do I have?',
          'Show me pending orders',
          'Which products are low on stock?',
          'Give me an inventory summary',
          'What are my recent sales?',
          'How many active products are there?'
        ]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
