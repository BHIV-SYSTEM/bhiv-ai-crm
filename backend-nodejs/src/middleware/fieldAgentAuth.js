import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';

/**
 * Strict authentication for the Field Agent API.
 * Does not use the application's standalone-mode admin fallback.
 */
export const fieldAgentAuth = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is missing.',
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error('Field Agent API: JWT_SECRET is not configured.');

      return res.status(503).json({
        success: false,
        message: 'Authentication service is not configured.',
      });
    }

    // Never authenticate field agents using the standalone-mode fallback.
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
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token.',
      });
    }

    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token.',
      });
    }

    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is unavailable or inactive.',
      });
    }

    if (user.role !== 'field_agent') {
      return res.status(403).json({
        success: false,
        message: 'Field Agent access is required.',
      });
    }

    // Identity comes from the verified token and database, never the request body.
    req.user = user;
    next();
  } catch (error) {
    console.error('Field Agent authentication failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to authenticate request.',
    });
  }
};