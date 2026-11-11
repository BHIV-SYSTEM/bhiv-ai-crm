import { USER_ROLES, HTTP_STATUS } from '../config/constants.js';

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`
      });
    }

    next();
  };
};

// Check if user is admin
export const isAdmin = authorize(USER_ROLES.ADMIN);

// Check if user is admin or manager
export const isAdminOrManager = authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER);

// Check if user is customer
export const isCustomer = authorize(USER_ROLES.CUSTOMER);

// Staff roles that run the shop floor (admin, manager, seller) — sellers may
// dispatch orders and drive shipments from the Seller Portal, but never get
// access to the admin-only product APIs (users, inventory, restock, EMS...).
export const isShopFloor = authorize(
  USER_ROLES.ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.SELLER
);

// Sellers only (e.g. seller-portal-specific endpoints)
export const isSeller = authorize(USER_ROLES.SELLER);

// Block customer-role callers from staff-wide data endpoints.
// (Customer portal privacy: no company-wide data through staff routes.)
export const denyCustomer = (req, res, next) => {
  if (!req.user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Not authenticated'
    });
  }
  if (req.user.role === USER_ROLES.CUSTOMER) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: `Role '${req.user.role}' is not authorized to access this route`
    });
  }
  next();
};

// Block portal roles (customer + seller) from staff-wide data endpoints.
// SETU's product surfaces (dashboard, suppliers, agents, RL, LLM, decisions)
// are admin/manager territory; sellers only get the Seller Portal APIs
// (orders, dispatch, delivery, notifications).
export const denyPortalRoles = (req, res, next) => {
  if (!req.user) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Not authenticated'
    });
  }
  if (
    req.user.role === USER_ROLES.CUSTOMER ||
    req.user.role === USER_ROLES.SELLER
  ) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: `Role '${req.user.role}' is not authorized to access this route`
    });
  }
  next();
};
