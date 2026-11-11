import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const PRIMARY_URI = process.env.MONGODB_URL;
const LOCAL_URI = 'mongodb://127.0.0.1:27017/ai_crm_logistics';

// Atlas cold connections from a dev machine routinely take several seconds;
// the old 2500ms budget was short enough that one slow handshake dumped the
// whole server into "no database" mode permanently until a manual restart.
const PRIMARY_OPTIONS = { serverSelectionTimeoutMS: 15000, socketTimeoutMS: 30000 };
const LOCAL_OPTIONS = { serverSelectionTimeoutMS: 3000, socketTimeoutMS: 30000 };

let listenersAttached = false;
let backgroundTimer = null;
let reconnectInFlight = false;

const attachConnectionListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('error', (err) => {
    console.warn('⚠️ MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
    // Re-allow query buffering now that a connection exists again.
    mongoose.set('bufferCommands', true);
  });
};

/**
 * While the server sits in fallback/no-DB mode, keep trying the primary Atlas
 * URI in the background so a transient network/whitelist blip recovers on its
 * own instead of requiring a full server restart.
 */
const startBackgroundReconnect = () => {
  if (backgroundTimer || !PRIMARY_URI) return;
  console.log('🔁 Automatic Atlas reconnection enabled (every 15s).');
  backgroundTimer = setInterval(async () => {
    if (reconnectInFlight) return;
    if (mongoose.connection.readyState === 1) {
      clearInterval(backgroundTimer);
      backgroundTimer = null;
      return;
    }
    reconnectInFlight = true;
    try {
      await mongoose.connect(PRIMARY_URI, PRIMARY_OPTIONS);
      mongoose.set('bufferCommands', true);
      console.log('✅ MongoDB recovered: reconnected to primary Atlas');
      clearInterval(backgroundTimer);
      backgroundTimer = null;
    } catch {
      // keep retrying quietly
    } finally {
      reconnectInFlight = false;
    }
  }, 15000);
  if (typeof backgroundTimer.unref === 'function') backgroundTimer.unref();
};

const connectDatabase = async () => {
  attachConnectionListeners();

  // 1) Primary (Atlas) with retries — transient DNS/TLS/network jitter is
  //    normal on dev machines, so one failed handshake must not be fatal.
  if (PRIMARY_URI) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (attempt === 1) console.log('🔗 Connecting to primary MongoDB (Atlas)...');
        await mongoose.connect(PRIMARY_URI, PRIMARY_OPTIONS);
        console.log('✅ MongoDB Connected Successfully');
        console.log(`📊 Database: ${mongoose.connection.name}`);
        return;
      } catch (error) {
        console.warn(`⚠️ Primary MongoDB attempt ${attempt}/3 failed:`, (error.message || '').slice(0, 180));
        if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  // 2) Local MongoDB fallback (kept for offline/dev setups that run mongod locally).
  console.log('🔄 Attempting fallback to local MongoDB (mongodb://127.0.0.1:27017/ai_crm_logistics)...');
  try {
    await mongoose.connect(LOCAL_URI, LOCAL_OPTIONS);
    console.log('✅ Fallback Local MongoDB Connected Successfully');
    return;
  } catch {
    console.log('ℹ️ SETU Standalone / In-Memory Mode active — automatic Atlas reconnection enabled.');
  }

  // 3) Last resort: no reachable database. Stop queries from hanging on the
  //    missing connection, and keep retrying Atlas in the background so the
  //    server heals itself when the network comes back.
  mongoose.set('bufferCommands', false);
  startBackgroundReconnect();
};

export default connectDatabase;
