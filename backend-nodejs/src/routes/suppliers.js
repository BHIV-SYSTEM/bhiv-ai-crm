import express from 'express';
import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';
import mongoose from 'mongoose';
import { protect } from '../middleware/auth.js';
import { denyPortalRoles } from '../middleware/authorize.js';
import { HTTP_STATUS } from '../config/constants.js';

const router = express.Router();

// All routes require authentication
router.use(protect);
// Staff-only: supplier data is company-wide, never customer-visible
router.use(denyPortalRoles);

// @route   GET /api/suppliers
// @desc    Get all suppliers from Suppliers collection
// @access  Private
router.get('/', async (req, res) => {
  try {
    // Get all suppliers from the Suppliers collection
    const suppliers = await Supplier.find().sort({ name: 1 });

    // Also get unique suppliers from products (for backwards compatibility)
    const products = await Product.find({ 
      'supplier.name': { $exists: true, $ne: '' } 
    }).select('supplier');

    // Extract unique suppliers from products
    const productSupplierMap = new Map();
    products.forEach(product => {
      if (product.supplier && product.supplier.name) {
        const key = product.supplier.name.toLowerCase();
        if (!productSupplierMap.has(key)) {
          productSupplierMap.set(key, {
            id: key.replace(/\s+/g, '-'),
            name: product.supplier.name,
            email: product.supplier.email || '',
            phone: product.supplier.phone || '',
            address: product.supplier.address || '',
            isActive: true,
            source: 'product' // Mark as coming from product
          });
        }
      }
    });

    // Merge suppliers from both sources (Suppliers collection takes precedence)
    const supplierMap = new Map();
    
    // First add all suppliers from Suppliers collection
    suppliers.forEach(supplier => {
      supplierMap.set(supplier.name.toLowerCase(), {
        id: supplier._id.toString(),
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        isActive: supplier.isActive,
        leadTimeDays: supplier.leadTimeDays,
        rating: supplier.rating,
        createdAt: supplier.createdAt,
        source: 'database'
      });
    });

    // Then add suppliers from products if not already in the map
    productSupplierMap.forEach((supplier, key) => {
      if (!supplierMap.has(key)) {
        supplierMap.set(key, supplier);
      }
    });

    const allSuppliers = Array.from(supplierMap.values());

    res.json({
      success: true,
      data: { 
        suppliers: allSuppliers,
        count: allSuppliers.length
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/suppliers
// @desc    Create a new supplier
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, address, leadTimeDays, rating } = req.body;

    if (!name) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Supplier name is required'
      });
    }

    // Check if supplier already exists
    const existingSupplier = await Supplier.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });

    if (existingSupplier) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: `Supplier with name '${name}' already exists`
      });
    }

    // Create new supplier
    const supplier = await Supplier.create({
      name,
      email: email || '',
      phone: phone || '',
      address: address || '',
      leadTimeDays: leadTimeDays || 7,
      rating: rating || 0,
      isActive: true
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Supplier created successfully',
      data: {
        supplier: {
          id: supplier._id.toString(),
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          isActive: supplier.isActive,
          leadTimeDays: supplier.leadTimeDays,
          rating: supplier.rating,
          createdAt: supplier.createdAt
        }
      }
    });
  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'Supplier with this name already exists'
      });
    }
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/suppliers/:id
// @desc    Update a supplier
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, leadTimeDays, rating, isActive } = req.body;

    if (!name) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Supplier name is required'
      });
    }

    // Check if ID is a valid MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id) && id.length === 24;
    
    if (!isValidObjectId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Cannot edit legacy supplier. Please create a new supplier with this information.',
        data: { 
          suggestion: 'This supplier comes from product data. Create a new supplier to manage it properly.' 
        }
      });
    }

    // Check if supplier exists
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Check if name is being changed to an existing one
    const existingSupplier = await Supplier.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: id }
    });

    if (existingSupplier) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: `Supplier with name '${name}' already exists`
      });
    }

    // Update supplier
    const updatedSupplier = await Supplier.findByIdAndUpdate(
      id,
      {
        name,
        email: email || '',
        phone: phone || '',
        address: address || '',
        leadTimeDays: leadTimeDays || 7,
        rating: rating || 0,
        isActive: isActive !== undefined ? isActive : true
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: {
        supplier: {
          id: updatedSupplier._id.toString(),
          name: updatedSupplier.name,
          email: updatedSupplier.email,
          phone: updatedSupplier.phone,
          address: updatedSupplier.address,
          isActive: updatedSupplier.isActive,
          leadTimeDays: updatedSupplier.leadTimeDays,
          rating: updatedSupplier.rating,
          updatedAt: updatedSupplier.updatedAt
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

// @route   DELETE /api/suppliers/:id
// @desc    Delete a supplier
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if ID is a valid MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id) && id.length === 24;
    
    if (!isValidObjectId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Cannot delete legacy supplier directly.',
        data: { 
          suggestion: 'This supplier comes from product data. To remove it, update the products that reference it or create a proper supplier record first.' 
        }
      });
    }

    // Check if supplier exists
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Check if supplier is referenced in any products
    const productsWithSupplier = await Product.find({
      'supplier.name': { $regex: new RegExp(`^${supplier.name}$`, 'i') }
    });

    if (productsWithSupplier.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Cannot delete supplier. ${productsWithSupplier.length} products are still linked to this supplier.`,
        data: { linkedProducts: productsWithSupplier.length }
      });
    }

    // Delete the supplier
    await Supplier.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/suppliers/stats
// @desc    Get supplier statistics
// @access  Private
router.get('/stats', async (req, res) => {
  try {
    const products = await Product.find({ 
      'supplier.name': { $exists: true, $ne: '' } 
    }).select('supplier stockQuantity');

    const supplierStats = {};
    
    products.forEach(product => {
      if (product.supplier && product.supplier.name) {
        const name = product.supplier.name;
        if (!supplierStats[name]) {
          supplierStats[name] = {
            name,
            productCount: 0,
            totalStock: 0
          };
        }
        supplierStats[name].productCount++;
        supplierStats[name].totalStock += product.stockQuantity || 0;
      }
    });

    const stats = Object.values(supplierStats);

    res.json({
      success: true,
      data: {
        stats,
        totalSuppliers: stats.length,
        totalProducts: products.length
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
