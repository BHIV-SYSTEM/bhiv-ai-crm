import mongoose from 'mongoose';

/**
 * Shipment model — the single source of truth for delivery tracking.
 *
 * Collection: `shipments` (same collection the delivery/logistics routes have
 * always used). Fields mirror the original inline schema in routes/delivery.js
 * so existing rows keep working unchanged.
 *
 * `order_id` stores the human-readable ORDER NUMBER (e.g. ORD-1712...-ABC123),
 * not the Mongo ObjectId — that is how logistics has always linked shipments
 * to orders.
 *
 * Dealer / delivery-worker flow (all fields optional, purely additive):
 *   PENDING_PICKUP -> PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED
 * `worker.startedAt` is stamped when the delivery worker begins the pickup leg
 * and `worker.endedAt` when the parcel is handed over to the customer.
 * `events` is the append-only audit trail rendered as the tracking timeline.
 */
const shipmentSchema = new mongoose.Schema({
  shipment_id: { type: String, required: true },
  tracking_number: { type: String, required: true },
  order_id: { type: String, required: true, index: true },
  courier_name: { type: String, default: 'BlueDart Express' },
  status: { type: String, default: 'IN_TRANSIT' },
  origin: { type: String, default: 'Mumbai Distribution Hub' },
  destination: { type: String, default: 'Customer Warehouse' },
  estimated_delivery: {
    type: String,
    default: () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  },

  /* -------- dealer / delivery-worker extension (additive) -------- */
  dealer_name: { type: String, default: null },
  pickup_at: { type: Date, default: null },
  out_for_delivery_at: { type: Date, default: null },
  delivered_at: { type: Date, default: null },
  worker: {
    _id: false,
    name: { type: String, default: null },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  events: [{
    _id: false,
    key: { type: String, required: true },
    label: { type: String, required: true },
    state: { type: String, default: 'done' },
    at: { type: Date, default: Date.now },
    actor: { type: String, default: null },
    note: { type: String, default: null },
  }],
}, { timestamps: true });

shipmentSchema.index({ tracking_number: 1 });

const Shipment = mongoose.models.Shipment || mongoose.model('Shipment', shipmentSchema);

export default Shipment;
