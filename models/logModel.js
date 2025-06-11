import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  },
  url: {
    type: String,
    required: true
  },
  status: {
    type: Number,
    required: true
  },
  responseTime: {
    type: Number,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to User collection
    index: true
  },
  requestData: {
    body: { type: mongoose.Schema.Types.Mixed }, 
    params: { type: mongoose.Schema.Types.Mixed }, 
    query: { type: mongoose.Schema.Types.Mixed },  
  },
  responseData: { 
    type: mongoose.Schema.Types.Mixed, 
  }
},{timestamps: true});

logSchema.index({ userId: 1, timestamp: -1 });
logSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Log = mongoose.model('Log', logSchema);

export default Log;