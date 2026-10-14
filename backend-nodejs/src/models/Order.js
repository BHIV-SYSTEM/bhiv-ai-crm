import mongoose from 'mongoose';
import { ORDER_STATUS } from '../config/constants.js';

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // The seller (delivery partner) this parcel is assigned to. Admin assigns a
  // parcel to a seller; only that seller can then see and dispatch it. Null
  // means unassigned (visible to admin/manager, invisible to every seller).
  assignedSeller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative']
    },
    total: {
      type: Number,
      required: true
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.PLACED
  },
  tracking: {
    placedAt: {
      type: Date,
      default: Date.now
    },
    dispatchedAt: {
      type: Date
    },
    dispatchedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveredAt: {
      type: Date
    },
    confirmedByCustomer: {
      type: Boolean,
      default: false
    }
  },
  notes: {
    type: String,
    trim: true
  },
  shippingAddress: {
    shopName: String,
    address: String,
    phone: String
  }
}, {
  timestamps: true
});

// Generate order number before validation so `required: true` passes
orderSchema.pre('validate', function(next) {
  if (!this.orderNumber) {
    const uniqueSuffix = new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase();
    this.orderNumber = `ORD-${Date.now()}-${uniqueSuffix}`;
  }
  next();
});

// Index for efficient queries
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
const Order = mongoose.model('Order', orderSchema);

export default Order;
