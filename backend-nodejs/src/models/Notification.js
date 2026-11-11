import mongoose from 'mongoose';

/**
 * Notification — SETU-side, per-user inbox entries.
 *
 * Distinct from ARTHA's financial notifications (those are proxied from the
 * accounting system through /api/financial/notifications). This collection
 * carries the operational events of the SETU flow: order placed, dispatched,
 * dealer pickup, out for delivery, delivered, invoice generated.
 *
 * Writes are fan-out helpers so route code stays one-liners. Nothing here is
 * security-sensitive: readers can only ever see their own rows.
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['order', 'shipment', 'invoice', 'payment', 'system'],
      default: 'system',
    },
    level: {
      type: String,
      enum: ['info', 'success', 'warning', 'error'],
      default: 'info',
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: '', trim: true },
    data: {
      orderId: { type: String, default: null },
      orderNumber: { type: String, default: null },
      shipmentId: { type: String, default: null },
      trackingNumber: { type: String, default: null },
      status: { type: String, default: null },
    },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

/** Create the same notification for several users (fan-out). Never throws. */
notificationSchema.statics.notifyUsers = async function notifyUsers(userIds, payload) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean))];
  if (ids.length === 0) return null;
  try {
    const docs = ids.map((userId) => ({ ...payload, userId }));
    return await this.create(docs);
  } catch (err) {
    console.warn('Notification fan-out failed:', err.message);
    return null;
  }
};

const Notification = mongoose.models.Notification
  || mongoose.model('Notification', notificationSchema);

export default Notification;
