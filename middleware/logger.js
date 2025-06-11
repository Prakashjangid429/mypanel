import mongoose from 'mongoose';
import Log from '../models/logModel.js';
import logger from '../config/logger.js';


export const logRequest = async (req, res, next) => {
  const originalEnd = res.end;

  const start = Date.now();

  const requestData = {
    body: req.body,  // Request body for POST, PUT, etc.
    params: req.params, // Request parameters (e.g., route params)
    query: req.query, // Query params
  };

  let responseData = null;

  res.end = function(chunk, encoding) {
    if (chunk) {
      responseData = chunk.toString(encoding || 'utf8');
    }
  
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: Date.now() - start,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user ? req.user._id : null,
      requestData,
      responseData
    };
  
    new Log(logData).save().catch(err => {
      logger.error(`Error saving log: ${err.message}`);
    });
  
    originalEnd.call(this, chunk, encoding);
  };
  next();
};
