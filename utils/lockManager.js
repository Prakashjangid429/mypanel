import mongoose from "mongoose";

class MongoMutex {
  constructor() {
    this.lockCollectionPromise = this.initLockCollection();
    this.localQueues = new Map();
    this.instanceId = Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
  }

  async initLockCollection() {
    if (mongoose.connection.readyState !== 1) {
      await new Promise(resolve => {
        mongoose.connection.once('connected', resolve);
      });
    }

    const collection = mongoose.connection.db.collection('mutex_locks');

    try {
      await collection.createIndex({ resourceId: 1 }, { unique: true });
      await collection.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
    } catch (err) {
      if (err.code !== 85) { // Ignore index already exists error
        throw err;
      }
    }

    return collection;
  }

  async acquireLock(resourceId, ttl = 30000) {
    const lockCollection = await this.lockCollectionPromise;
    const now = new Date();
    const expireAt = new Date(now.getTime() + ttl);
    const leaseId = `${this.instanceId}:${Date.now()}`;

    try {
      const result = await lockCollection.findOneAndUpdate(
        {
          $or: [
            { resourceId, expireAt: { $lt: now } },
            { resourceId: { $exists: false } }
          ]
        },
        {
          $set: {
            resourceId,
            leaseId,
            expireAt,
            createdAt: now
          }
        },
        {
          upsert: true,
          returnDocument: 'after'
        }
      );

      return result.value && result.value.leaseId === leaseId ? leaseId : null;
    } catch (err) {
      if (err.code === 11000) return null; // Duplicate key error
      throw err;
    }
  }

  async releaseLock(resourceId, leaseId) {
    const lockCollection = await this.lockCollectionPromise;
    const result = await lockCollection.deleteOne({ resourceId, leaseId });
    return result.deletedCount === 1;
  }

  async runExclusive(resourceId, callback, options = {}) {
    const { ttl = 30000, maxRetries = 2 } = options;
    let leaseId = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        leaseId = await this.acquireLock(resourceId, ttl);
        if (leaseId) break;

        if (attempt < maxRetries) {
          await new Promise(resolve => {
            const queue = this.localQueues.get(resourceId) || [];
            queue.push(resolve);
            this.localQueues.set(resourceId, queue);
            
            // Set timeout to prevent hanging if notification never comes
            setTimeout(resolve, ttl / 2);
          });
        }
      } catch (err) {
        console.error('Lock acquisition error:', err);
      }
      attempt++;
    }

    if (!leaseId) {
      throw new Error(`Failed to acquire lock after ${maxRetries} retries`);
    }

    try {
      // Start lock renewal for long operations
      const renewalInterval = setInterval(async () => {
        try {
          const lockCollection = await this.lockCollectionPromise;
          await lockCollection.updateOne(
            { resourceId, leaseId, expireAt: { $gt: new Date() } },
            { $set: { expireAt: new Date(Date.now() + ttl) } }
          );
        } catch (err) {
          clearInterval(renewalInterval);
        }
      }, ttl / 3);

      const result = await callback();

      clearInterval(renewalInterval);
      return result;
    } finally {
      try {
        await this.releaseLock(resourceId, leaseId);
        // Notify next waiter if any
        const queue = this.localQueues.get(resourceId);
        if (queue && queue.length > 0) {
          const next = queue.shift();
          next();
          if (queue.length === 0) {
            this.localQueues.delete(resourceId);
          }
        }
      } catch (err) {
        console.error('Lock release error:', err);
      }
    }
  }
}

// Singleton instance
const mongoMutex = new MongoMutex();
export default mongoMutex;