import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

/**
 * /api/notifications — SETU operational inbox (orders, shipping, invoices).
 *
 * Read-mostly: every endpoint is scoped to the authenticated user, so one
 * customer can never enumerate another user's notifications. Staff users read
 * the fan-out rows they were addressed at creation time.
 */

const router = Router();
router.use(protect);

/** GET /api/notifications?page=&limit=&unreadOnly= */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const query = { userId: req.user._id };
    if (req.query.unreadOnly === 'true') query.read = false;

    const [items, total, unread] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId: req.user._id, read: false }),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
      unread_count: unread,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load notifications' });
  }
});

/** GET /api/notifications/unread-count */
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ success: true, data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to count notifications' });
  }
});

/** PUT /api/notifications/:id/read — only ever flips the caller's own row. */
router.put('/:id/read', async (req, res) => {
  try {
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    ).lean();
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update notification' });
  }
});

/** PUT /api/notifications/read-all */
router.put('/read-all', async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.json({ success: true, data: { modified: result.modifiedCount || 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update notifications' });
  }
});

export default router;
