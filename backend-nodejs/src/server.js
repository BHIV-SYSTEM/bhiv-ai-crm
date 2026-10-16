import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDatabase from './config/database.js';
import errorHandler from './middleware/errorHandler.js';
import { protect } from './middleware/auth.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import inventoryRoutes from './routes/inventory.js';
import restockRoutes from './routes/restock.js';
import dashboardRoutes from './routes/dashboard.js';
import supplierRoutes from './routes/suppliers.js';
import emsRoutes from './routes/ems.js';
import rlRoutes from './routes/rl.js';
import aiDecisionRoutes from './routes/aiDecisions.js';
import llmQueryRoutes from './routes/llmQuery.js';
import mitraRoutes from './routes/mitra.js';
import setuRoutes from './routes/setu.js';
import deliveryRoutes from './routes/delivery.js';
import agentRoutes from './routes/agents.js';
import fieldAgentRoutes from './routes/fieldAgent.js';
import fieldReviewsRoutes from './routes/fieldReviews.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDatabase();

// CORS configuration (MUST be before helmet and everything else to handle preflight)
const allowedOrigins = [
  'https://ai-crm-sigma-five.vercel.app',
  'https://setu.blackholeinfiverse.com',
  'https://niyantrankendra.blackholeinfiverse.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) || []),
];

// Universal CORS & Preflight middleware (runs first for all incoming requests)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, ngrok-skip-browser-warning');
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.endsWith('.blackholeinfiverse.com') || origin.endsWith('.vercel.app') || origin.includes('blackholeinfiverse')) return callback(null, true);
    const isDev = (process.env.NODE_ENV || 'development') !== 'production';
    if (isDev) {
      const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
      if (localhostPattern.test(origin)) return callback(null, true);
    }
    return callback(null, true); // Fallback allow to avoid dropping CORS headers
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'ngrok-skip-browser-warning'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));


// Security middleware (after CORS so preflight is not blocked)
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting (relaxed for development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Allow generous requests for local dev
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check handler
const healthHandler = (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  res.status(mongoReady ? 200 : 503).json({
    success: mongoReady,
    status: mongoReady ? 'healthy' : 'unhealthy',
    message: mongoReady ? 'Server is healthy' : 'MongoDB is not ready',
    timestamp: new Date().toISOString(),
    dependencies: {
      mongodb: mongoReady ? 'connected' : 'disconnected',
    },
    integrations: {
      mitra: process.env.SETU_MITRA_API_KEY ? 'configured' : 'not_configured',
    },
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/api/setu/health', healthHandler);
app.get('/setu/health', healthHandler);


// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/restock', restockRoutes);
app.use('/api/ems', emsRoutes);
app.use('/api/rl', rlRoutes);
app.use('/api/ai-decisions', aiDecisionRoutes);
app.use('/api/llm-query', llmQueryRoutes);
app.use('/api/mitra', mitraRoutes);
app.use('/api/field-agent', fieldAgentRoutes);
app.use('/api/field-reviews', fieldReviewsRoutes);
app.use('/setu', setuRoutes);
app.use('/api/setu', setuRoutes);
app.use('/v1/setu', setuRoutes);
app.use('/projects', setuRoutes);
app.use('/tasks', setuRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/delivery', deliveryRoutes);
app.use('/returns', deliveryRoutes);
app.use('/', agentRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'AI CRM Logistics API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      products: '/api/products',
      orders: '/api/orders',
      inventory: '/api/inventory',
      restock: '/api/restock',
      dashboard: '/api/dashboard',
      suppliers: '/api/suppliers'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 AI CRM Logistics Server Started');
  console.log('========================================');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📝 API URL: http://localhost:${PORT}`);
  console.log('========================================');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});

export default app;
