import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function checkDatabase() {
  console.log('🔍 Checking MongoDB Database contents...');
  const mongoUri = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/ai_crm_logistics';
  
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log('✅ Connected to MongoDB:', mongoose.connection.name);

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📊 Collections found in MongoDB:', collections.map(c => c.name));

    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`\n📦 Collection "${col.name}": ${count} records`);
      if (count > 0) {
        const samples = await mongoose.connection.db.collection(col.name).find({}).limit(3).toArray();
        console.log(`  Sample records:`, JSON.stringify(samples, null, 2));
      }
    }
  } catch (err) {
    console.warn('⚠️ Could not connect to primary MongoDB:', err.message);
    try {
      console.log('🔄 Checking local MongoDB...');
      await mongoose.connect('mongodb://127.0.0.1:27017/ai_crm_logistics', { serverSelectionTimeoutMS: 1500 });
      console.log('✅ Connected to Local MongoDB:', mongoose.connection.name);
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('\n📊 Collections found in Local MongoDB:', collections.map(c => c.name));
      for (const col of collections) {
        const count = await mongoose.connection.db.collection(col.name).countDocuments();
        console.log(`\n📦 Collection "${col.name}": ${count} records`);
        if (count > 0) {
          const samples = await mongoose.connection.db.collection(col.name).find({}).limit(3).toArray();
          console.log(`  Sample records:`, JSON.stringify(samples, null, 2));
        }
      }
    } catch (localErr) {
      console.log('ℹ️ Offline/In-Memory Mode active.');
    }
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

checkDatabase();
