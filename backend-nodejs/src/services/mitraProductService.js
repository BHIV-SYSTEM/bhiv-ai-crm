import Order from '../models/Order.js';
import Product from '../models/Product.js';

const INTENTS = Object.freeze({
  INVENTORY_LOOKUP: 'setu.inventory.lookup',
  OPERATIONS_SUMMARY: 'setu.operations.summary',
  ORDER_LOOKUP: 'setu.order.lookup',
});

const clampLimit = (value, fallback = 20) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 100);
};

export const createMongoSetuRepository = (context = {}) => ({
  async inventory({ query, sku, lowStockOnly, limit }) {
    const filter = { isActive: true };
    if (sku) filter.sku = String(sku).trim().toUpperCase();
    if (lowStockOnly) {
      filter.$expr = { $lt: ['$stockQuantity', '$minThreshold'] };
    }

    const queryText = String(query || '').trim();
    const explicitSearch = queryText.match(
      /(?:named|called|sku|product)\s+["']?([a-z0-9._-]+(?:\s+[a-z0-9._-]+){0,3})/i,
    );
    if (!sku && explicitSearch && !lowStockOnly) {
      const escaped = explicitSearch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { sku: { $regex: escaped, $options: 'i' } },
      ];
    }

    return Product.find(filter)
      .select(
        'name sku category stockQuantity minThreshold unit sellingPrice isActive updatedAt',
      )
      .sort({ stockQuantity: 1, name: 1 })
      .limit(limit)
      .lean();
  },

  async operationsSummary() {
    const lowStockFilter = {
      isActive: true,
      $expr: { $lt: ['$stockQuantity', '$minThreshold'] },
    };
    const [activeProducts, lowStockProducts, totalOrders, orderStatuses] =
      await Promise.all([
        Product.countDocuments({ isActive: true }),
        Product.countDocuments(lowStockFilter),
        Order.countDocuments(context.account_id ? { customerId: context.account_id } : {}),
        Order.aggregate([
          ...(context.account_id ? [{ $match: { customerId: new mongoose.Types.ObjectId(context.account_id) } }] : []),
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
      ]);

    return {
      active_products: activeProducts,
      low_stock_products: lowStockProducts,
      total_orders: totalOrders,
      orders_by_status: Object.fromEntries(
        orderStatuses.map((item) => [item._id, item.count]),
      ),
    };
  },

  async order(orderNumber) {
    const filter = { orderNumber: String(orderNumber).trim() };
    if (context.account_id) {
      filter.customerId = context.account_id;
    }
    return Order.findOne(filter)
      .select(
        'orderNumber status totalAmount items tracking.placedAt tracking.dispatchedAt tracking.deliveredAt createdAt updatedAt',
      )
      .lean();
  },
});

const requireEnvelope = (envelope) => {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new TypeError('SETU requires a Mitra dispatch envelope');
  }
  for (const field of [
    'dispatch_id',
    'correlation_id',
    'product_id',
    'capability_id',
    'intent_id',
    'payload',
  ]) {
    if (envelope[field] === undefined || envelope[field] === null) {
      throw new TypeError(`Missing Mitra envelope field: ${field}`);
    }
  }
  if (
    typeof envelope.payload !== 'object' ||
    Array.isArray(envelope.payload)
  ) {
    throw new TypeError('Mitra envelope payload must be an object');
  }
};

export const executeMitraProduct = async (
  envelope,
  repositoryFactory = createMongoSetuRepository,
) => {
  requireEnvelope(envelope);

  // Extract account/store context scoping
  const context = { account_id: envelope.context?.account_id || envelope.tenant_id };
  const repository = repositoryFactory(context);

  const payload = envelope.payload;
  const query = String(payload.query || '').trim();
  const base = {
    status: 'completed',
    success: true,
    trace_id: envelope.correlation_id,
    dispatch_id: envelope.dispatch_id,
    product_id: envelope.product_id,
    capability_id: envelope.capability_id,
    intent_id: envelope.intent_id,
    metadata: {
      source: 'setu-ai-crm',
      storage_backend: 'mongodb',
      read_only: true,
    },
  };

  if (envelope.intent_id === INTENTS.INVENTORY_LOOKUP) {
    const lowStockOnly =
      payload.low_stock_only === true ||
      /\b(low|short|shortage|restock|below threshold)\b/i.test(query);
    const products = await repository.inventory({
      query,
      sku: payload.sku,
      lowStockOnly,
      limit: clampLimit(payload.limit),
    });
    return {
      ...base,
      operation: 'inventory_lookup',
      data: {
        count: products.length,
        low_stock_only: lowStockOnly,
        products,
      },
    };
  }

  if (envelope.intent_id === INTENTS.OPERATIONS_SUMMARY) {
    return {
      ...base,
      operation: 'operations_summary',
      data: await repository.operationsSummary(),
    };
  }

  if (envelope.intent_id === INTENTS.ORDER_LOOKUP) {
    const orderNumber = String(payload.order_number || '').trim();
    if (!orderNumber) {
      throw new TypeError('order_number is required for SETU order lookup');
    }
    const order = await repository.order(orderNumber);
    return {
      ...base,
      operation: 'order_lookup',
      data: {
        found: Boolean(order),
        order: order || null,
      },
    };
  }

  const error = new Error(`Unsupported SETU intent: ${envelope.intent_id}`);
  error.code = 'UNSUPPORTED_SETU_INTENT';
  throw error;
};

export { INTENTS };
