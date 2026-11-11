import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { HTTP_STATUS } from '../config/constants.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      if (mongoose.connection.readyState === 1) {
        req.user = await User.findById(decoded.id).select('-password');
      }

      if (!req.user) {
        if (mongoose.connection.readyState === 1) {
          // DB is live but the account no longer exists → reject the token.
          // (Never fabricate a privileged user for a deleted/unknown account.)
          return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Not authorized to access this route'
          });
        }
        // Standalone mode (database offline): same fallback identity the
        // offline login flow mints tokens for.
        req.user = {
          _id: decoded.id || 'usr_standalone_001',
          name: 'System Administrator',
          email: 'admin@company.com',
          role: 'admin',
          tenant_id: 'tenant_sampada_001',
          isActive: true,
          toPublicJSON: function() {
            return {
              _id: this._id,
              name: this.name,
              email: this.email,
              role: this.role,
              tenant_id: this.tenant_id,
              isActive: this.isActive
            };
          }
        };
      }

      if (!req.user.isActive) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'User account is deactivated'
        });
      }

      next();
    } catch (error) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Generate JWT Token
export const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};
