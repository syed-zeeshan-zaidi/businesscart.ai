import mongoose from 'mongoose';

// By moving the connection logic outside the handler, it can be cached across invocations.
let connectionPromise: Promise<void> | null = null;

export function connectDB(): Promise<void> {
  if (connectionPromise) {
    console.log('Using existing database connection promise');
    return connectionPromise;
  }

  console.log('Creating new database connection promise');
  connectionPromise = (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI!, {
        dbName: process.env.DB_NAME || 'company-service',
        serverSelectionTimeoutMS: 5000, // 5-second timeout
      });
      console.log('New database connection established');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      // Reset promise on failure to allow retry on next invocation
      connectionPromise = null; 
      throw new Error('Failed to connect to MongoDB');
    }
  })();

  return connectionPromise;
}