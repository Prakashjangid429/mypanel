import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { logRequest } from './middleware/logger.js';
import errorMiddleware from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import userMetaRoutes from './routes/userMeta.routes.js';
import packageRoutes from "./routes/package.routes.js";
import payinApisRoutes from './routes/payinApis.routes.js';
import payoutApisRoutes from './routes/payoutApis.routes.js';
import payinRoutes from './routes/payin.routes.js';
import reportsRoutes from './routes/report.routes.js';
import queryRoutes from './routes/queris.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import chargeBackRoutes from './routes/chargeBack.routes.js'
import { protect, restrictTo } from './middleware/auth.js';
import { errors } from 'celebrate';
import axios from 'axios';
import { getWalletAnalytics } from './routes/utility.routes.js';

const app = express();

app.use(cors());

// app.use(morgan());
// app.use(xss());
// app.use(mongoSanitize());

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(compression({ threshold: 1024 }));


app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user-meta', userMetaRoutes);
app.use('/api/v1/package', logRequest, packageRoutes);
app.use('/api/v1/payIn', protect, restrictTo('Admin'), payinApisRoutes);
app.use('/api/v1/payOut', protect, restrictTo('Admin'), payoutApisRoutes);
app.use('/api/v1/payment',logRequest, payinRoutes);
app.use('/api/v1/report', protect, reportsRoutes)
app.use('/api/v1/query', protect, queryRoutes)
app.use('/api/v1/upload', protect, uploadRoutes);
app.get('/api/v1/analytics', protect, getWalletAnalytics)
app.use('/api/v1/chargebacks',chargeBackRoutes)

app.post('/dummy-gateway', async (req, res) => {
  const { txnId, amount, name, email, mobileNumber } = req.body;

  const isSuccess = false // 80% chance success
  const delay = Math.floor(Math.random() * 1000 + 1000); // delay between 1-4 seconds

  const callbackURL = "http://localhost:3000/api/v1/payment/callback"; // your callback receiver route

  const responsePayload = {
    txnId,
    status_code: isSuccess ? 200 : 400,
    status_msg: isSuccess ? "Transaction Initiated Successfully" : "Transaction Failed",
    qr_image: isSuccess ? `https://dummyimage.com/200x200/000/fff&text=QR+${txnId}` : null,
    Intent: isSuccess ? `upi://pay?pa=merchant@bank&pn=${name}&am=${amount}&tn=TestTxn` : null,
    refId: isSuccess ? `REF${txnId}` : null,
  };

  try {
    await axios.post(callbackURL, {
      txnId,
      status: isSuccess ? "success" : "failed",
      message: isSuccess ? "Payment completed successfully" : "Payment failed",
      refId: isSuccess ? `REF${txnId}` : null,
      utr: isSuccess ? `UTR${txnId}` : null,
    });
  } catch (callbackError) {
    console.error("Callback failed:", callbackError?.response);
  }

  res.json(responsePayload);
});

app.post("/user-callback", async (req, res) => {
  try {
    res.status(200).json({ status: "success", message: "Callback processed successfully" });
  } catch (error) {
    console.error("Error processing callback:", error);
    res.status(500).json({ status: "error", message: "Failed to process callback" });
  }
});


app.get('/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Server is healthy' });
});

app.use(errors());

app.all('*', (req, res, next) => {
  const err = new Error(`Can't find ${req.originalUrl} on this server!`);
  err.status = 'fail';
  err.statusCode = 404;
  next(err);
});

// Error handling middleware
app.use(errorMiddleware);

export default app;