import mongoose from 'mongoose';

export const ARTHA_EVENT_TYPES = [
  'order.confirmed',
  'order.cancelled',
  'payment.received',
  'supplier.purchase-approved',
];

const arthaEventLogSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: ARTHA_EVENT_TYPES,
    },
    tenantId: {
      type: String,
      required: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SYNCED', 'FAILED'],
      default: 'PENDING',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    httpStatus: {
      type: Number,
    },
    lastError: {
      type: String,
    },
    response: {
      type: mongoose.Schema.Types.Mixed,
    },
    entity: {
      type: mongoose.Schema.Types.Mixed,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    restockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RestockRequest',
    },
  },
  { timestamps: true }
);

arthaEventLogSchema.index({ tenantId: 1, eventType: 1, idempotencyKey: 1 }, { unique: true });
arthaEventLogSchema.index({ orderId: 1, eventType: 1 });

const ArthaEventLog = mongoose.model('ArthaEventLog', arthaEventLogSchema);

export default ArthaEventLog;
