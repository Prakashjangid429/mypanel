import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import logger from './config/logger.js';
import connectDB from './config/db.js';
import axios from 'axios';

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...');
  logger.error(err.name, err.message);
  process.exit(1);
});


function generateRandomTxnId() {
  const prefix = 'tyz';
  const randomNumber = Math.floor(Math.random() * 1e10); // 10-digit number
  return `${prefix}${randomNumber}`;
}

async function hitApi200TimesConcurrently(url, basePayload = {}, config = {}) {
  const requests = Array.from({ length: 100 }, () => {
    const payload = {
      ...basePayload,
      txnId: generateRandomTxnId() // unique txnId each time
    };
    return axios.post(url, payload, config);
  });

  try {
    const responses = await Promise.allSettled(requests);

    responses.forEach((result, index) => {
      if (result.status === "fulfilled") {
        console.log(`✅ Request ${index + 1} succeeded:`, result.value.data);
      } else {
        const err = result.reason;
        console.error(`❌ Request ${index + 1} failed with status: ${err.response?.status || "Unknown"}`);
        console.error(`   → Message: ${err.response?.data?.message || err.message || "No error message"}`);
        console.error(`   → Full Error Data:`, err.response?.data || {});
      }
    });
  } catch (error) {
    console.error("Unexpected error:", error.message);
  }
}



connectDB().then(() => {
  logger.info('Database connected successfully');
  // hitApi200TimesConcurrently(
  //   'http://localhost:3000/api/v1/payment/create',
  //   {
  //     "amount": 30,
  //     "name": "Prakash Doe",
  //     "email": "prakash@example.com",
  //     "mobileNumber": "8302845977"
  //   },
  //   {
  //     headers: {
  //       'authorization': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRJZCI6IlVJRC1NQjdVUDBVRi0yVzRKT1QiLCJ1c2VyTmFtZSI6InRlc3RpbmcifQ.QiBIYAnnpj3FuvPQB2MaE-orLoffcfFP2LOVipqQtq4',
  //     }
  //   }
  // );

})

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${port}`);
});

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...');
  logger.error(err);
  // server.close(() => {
  //   process.exit(1);
  // });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated!');
  });
});