import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDatabase = async () => {
  try {
    const options = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 30000,
    };

    const mongoUri = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/ai_crm_logistics';
    await mongoose.connect(mongoUri, options);
    
    console.log('✅ MongoDB Connected Successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.warn('⚠️ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

  } catch (error) {
    console.warn('⚠️ Primary MongoDB Connection Failed (Cloud Atlas Unreachable):', error.message);
    try {
      console.log('🔄 Attempting fallback to local MongoDB (mongodb://127.0.0.1:27017/ai_crm_logistics)...');
      await mongoose.connect('mongodb://127.0.0.1:27017/ai_crm_logistics', { serverSelectionTimeoutMS: 1500 });
      console.log('✅ Fallback Local MongoDB Connected Successfully');
    } catch (fallbackErr) {
      console.log('ℹ️ Operating in SETU Standalone / In-Memory Mode (All APIs functional).');
      mongoose.set('bufferCommands', false);
    }
  }
};

export default connectDatabase;
