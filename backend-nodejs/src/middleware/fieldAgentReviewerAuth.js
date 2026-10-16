import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { USER_ROLES, HTTP_STATUS } from '../config/constants.js';

/**
 * Strict authentication for Field Agent proof reviewers.
 * Requires a real, active MongoDB user with admin or manager role.
 * Never uses the standalone administrator fallback.
 */
export const fieldAgentReviewerAuth = async (req, res, next) => {
  const unauthorized = (message) =>
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message,
    });

  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return unauthorized('Authentication required.');
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return unauthorized('Authentication token is missing.');
    }

    if (!process.env.JWT_SECRET) {
      return res.status(503).json({
        success: false,
        message: 'Authentication service is not configured.',
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Authentication database is unavailable.',
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return unauthorized('Invalid or expired authentication token.');
    }

    if (!decoded?.id || !mongoose.isValidObjectId(decoded.id)) {
      return unauthorized('Invalid authentication token.');
    }

    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      return unauthorized('Account is unavailable or inactive.');
    }

    if (
      user.role !== USER_ROLES.ADMIN &&
      user.role !== USER_ROLES.MANAGER
    ) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Administrator or manager access is required.',
      });
    }

    if (
      typeof user.tenant_id !== 'string' ||
      !user.tenant_id.trim()
    ) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'A valid tenant assignment is required.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error(
      'Field Agent reviewer authentication failed:',
      error.message,
    );

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Unable to authenticate request.',
    });
  }
};