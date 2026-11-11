import express from 'express';
import { body } from 'express-validator';
import Product from '../models/Product.js';
import { protect } from '../middleware/auth.js';
import { isAdminOrManager } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { HTTP_STATUS } from '../config/constants.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * Customer-safe product view: strips internal/commercial fields
 * (cost price, supplier details, who created it) from catalogue data.
 */
const toCustomerProduct = (product) => {
  const obj = product.toObject ? product.toObject() : { ...product };
  delete obj.costPrice;
  delete obj.supplier;
  delete obj.createdBy;
  delete obj.profitMargin;
  return obj;
};

// @route   GET /api/products
// @desc    Get all products
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { search, category, lowStock, page = 1, limit = 50, isActive } = req.query;
    
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }

    if (typeof isActive !== 'undefined') {
      query.isActive = isActive === 'true';
    }
    
    if (lowStock === 'true') {
      query.$expr = { $lt: ['$stockQuantity', '$minThreshold'] };
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('createdBy', 'name email');

    const total = await Product.countDocuments(query);

    const isCustomer = req.user.role === 'customer';
    const payload = isCustomer ? products.map(toCustomerProduct) : products;

    res.json({
      success: true,
      data: {
        products: payload,
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

// @route   POST /api/products
// @desc    Create new product
// @access  Private/Admin/Manager
router.post('/', isAdminOrManager, [
  body('name').notEmpty().withMessage('Product name is required'),
  body('sku').notEmpty().withMessage('SKU is required'),
  body('costPrice').isNumeric().withMessage('Cost price must be a number'),
  body('sellingPrice').isNumeric().withMessage('Selling price must be a number'),
  body('stockQuantity').isNumeric().withMessage('Stock quantity must be a number'),
  body('minThreshold').isNumeric().withMessage('Minimum threshold must be a number')
], validate, async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const productData = {
      ...req.body,
      createdBy: req.user._id
    };

    const product = await Product.create(productData);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Product created successfully',
      data: { product }
    });
  } catch (error) {
    // Handle duplicate SKU error
    if (error.code === 11000) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'A product with this SKU already exists'
      });
    }
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/products/:id
// @desc    Get product by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: { product: req.user.role === 'customer' ? toCustomerProduct(product) : product }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private/Admin/Manager
router.put('/:id', isAdminOrManager, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: { product }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Private/Admin/Manager
router.delete('/:id', isAdminOrManager, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/products/stats/summary
// @desc    Get product statistics
// @access  Private/Admin/Manager
router.get('/stats/summary', isAdminOrManager, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ isActive: true });
    const lowStockProducts = await Product.countDocuments({
      $expr: { $lt: ['$stockQuantity', '$minThreshold'] }
    });
    const outOfStock = await Product.countDocuments({ stockQuantity: 0 });

    // Get total inventory value
    const products = await Product.find();
    const totalInventoryValue = products.reduce((sum, p) => sum + (p.costPrice * p.stockQuantity), 0);
    const totalSellingValue = products.reduce((sum, p) => sum + (p.sellingPrice * p.stockQuantity), 0);

    res.json({
      success: true,
      data: {
        totalProducts,
        activeProducts,
        lowStockProducts,
        outOfStock,
        totalInventoryValue: totalInventoryValue.toFixed(2),
        totalSellingValue: totalSellingValue.toFixed(2),
        potentialProfit: (totalSellingValue - totalInventoryValue).toFixed(2)
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
