import express from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { body } from 'express-validator';
import User from '../models/User.js';
import { generateToken, protect } from '../middleware/auth.js';
import { denyPortalRoles } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { getClientBridge, signBridgeToken, provisionArthaIdentity } from '../services/arthaBridge.service.js';
import { HTTP_STATUS, USER_ROLES } from '../config/constants.js';

const router = express.Router();

/**
 * Single sign-on handoff into ARTHA (the embedded "AI Artha" product).
 *
 * Step 1 (POST /sso/artha/ticket): staff exchange their SETU session for a
 * one-time, 60-second ticket. The ARTHA session token itself never touches
 * the browser URL — only the opaque ticket does.
 *
 * Step 2 (GET /sso/artha?ticket=…): the SETU iframe navigates here, we swap
 * the ticket for an ARTHA-compatible `blackhole_token` cookie (host-scoped,
 * so localhost:3000/5173/8000 all share it) and 302 to the ARTHA SPA, which
 * loads already signed in. Single login, no password re-entry.
 */
const ssoTickets = new Map();
const SSO_TICKET_TTL_MS = 60 * 1000;

/**
 * SETU role → ARTHA role for SSO identities. A SETU admin becomes the
 * company's ARTHA Admin (`sub_admin` — can create that company's accountants
 * and viewers from inside ARTHA); a manager becomes read-only `viewer`.
 * ARTHA's companyScope then isolates every account's data automatically.
 */
const ARTHA_ROLE_FOR_SETU = {
  [USER_ROLES.ADMIN]: 'sub_admin',
  [USER_ROLES.MANAGER]: 'viewer',
};

const pruneSsoTickets = () => {
  const now = Date.now();
  for (const [key, entry] of ssoTickets) {
    if (entry.expiresAt <= now) ssoTickets.delete(key);
  }
};

// @route   POST /api/auth/sso/artha/ticket
// @desc    Mint a one-time SSO ticket for the embedded ARTHA product
// @access  Private (staff only — customers and sellers have no ARTHA product)
router.post('/sso/artha/ticket', protect, denyPortalRoles, async (req, res) => {
  try {
    const bridge = getClientBridge(req.user?.tenant_id);
    if (!bridge) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'No ARTHA account is linked to this SETU account yet.',
        code: 'bridge_not_provisioned'
      });
    }

    // Per-user ARTHA identity: each staff member gets their OWN ARTHA account
    // in the tenant's company (admin → company Admin, manager → viewer), so
    // ARTHA enforces per-account data privacy. Falls back to the shared
    // integration account if provisioning is unavailable.
    let identity = bridge;
    const arthaRole = ARTHA_ROLE_FOR_SETU[req.user.role];
    if (arthaRole) {
      const userId = await provisionArthaIdentity({
        entry: bridge,
        email: req.user.email,
        name: req.user.name,
        role: arthaRole,
      });
      if (userId) {
        identity = { ...bridge, user_id: userId, email: req.user.email, name: req.user.name };
      } else {
        console.warn(
          `ARTHA identity provisioning failed for ${req.user.email} — using shared bridge account`
        );
      }
    }

    // Mint the ARTHA token server-side so it never appears in a URL.
    const arthaToken = signBridgeToken(identity);
    pruneSsoTickets();

    const ticket = randomUUID();
    ssoTickets.set(ticket, {
      token: arthaToken,
      expiresAt: Date.now() + SSO_TICKET_TTL_MS
    });

    res.json({
      success: true,
      data: { ticket, expiresIn: SSO_TICKET_TTL_MS / 1000 }
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      message: err.message || 'ARTHA sign-on is not available right now',
      code: err.code || 'sso_unavailable'
    });
  }
});

// @route   GET /api/auth/sso/artha
// @desc    Consume a ticket: set the ARTHA session cookie and redirect
// @access  Public (the one-time ticket is the credential)
router.get('/sso/artha', (req, res) => {
  const { ticket } = req.query;
  const entry = typeof ticket === 'string' ? ssoTickets.get(ticket) : undefined;
  if (typeof ticket === 'string') ssoTickets.delete(ticket); // one-time use

  if (!entry || entry.expiresAt <= Date.now()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).send(
      'This sign-on link expired. Close this tab and reopen the ARTHA page inside SETU.'
    );
  }

  const spaBase = (process.env.ARTHA_SPA_URL || 'http://localhost:5173').replace(/\/+$/, '');
  res.cookie('blackhole_token', entry.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.redirect(302, `${spaBase}/`);
});

// @route   POST /api/auth/register
// @desc    Register new user (Admin only can create users via separate endpoint)
// @access  Public (for first admin only)
router.post('/register', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').notEmpty().withMessage('Name is required')
], validate, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if this is the first user (will be admin)
    const userCount = await User.countDocuments();

    if (userCount > 0) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Registration is disabled. Contact admin to create an account.'
      });
    }

    // Create first admin user
    const user = await User.create({
      name,
      email,
      password,
      role: USER_ROLES.ADMIN
    });

    const token = generateToken(user._id);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Admin account created successfully',
      data: {
        user: user.toPublicJSON(),
        token
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], validate, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if database is offline or in Standalone mode
    if (mongoose.connection.readyState !== 1) {
      const role = email.includes('admin') ? 'admin' : email.includes('manager') ? 'manager' : 'customer';
      const fallbackUser = {
        _id: 'usr_standalone_001',
        name: email.includes('admin') ? 'System Administrator' : email.includes('manager') ? 'Operations Manager' : 'Customer Account',
        email,
        role,
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
      const token = generateToken(fallbackUser._id);
      return res.json({
        success: true,
        message: 'Login successful (Standalone Mode)',
        data: {
          user: fallbackUser.toPublicJSON(),
          token
        }
      });
    }

    // Find user with password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Account is deactivated. Contact administrator.'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toPublicJSON(),
        token
      }
    });
  } catch (error) {
    // If DB error occurs during findOne, fallback to Standalone login
    if (error.name === 'MongooseError' || error.message.includes('buffering timed out')) {
      const { email } = req.body;
      const role = email?.includes('admin') ? 'admin' : email?.includes('manager') ? 'manager' : 'customer';
      const fallbackUser = {
        _id: 'usr_standalone_001',
        name: email?.includes('admin') ? 'System Administrator' : 'Operations Manager',
        email: email || 'admin@company.com',
        role,
        tenant_id: 'tenant_sampada_001',
        isActive: true,
        toPublicJSON: function() { return { _id: this._id, name: this.name, email: this.email, role: this.role, tenant_id: this.tenant_id, isActive: this.isActive }; }
      };
      const token = generateToken(fallbackUser._id);
      return res.json({
        success: true,
        message: 'Login successful (Standalone Mode)',
        data: { user: fallbackUser.toPublicJSON(), token }
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user.toPublicJSON()
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
