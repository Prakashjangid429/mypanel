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
  const prefix = 'ttttt';
  const randomNumber = Math.floor(Math.random() * 1e10); // 10-digit number
  return `${prefix}${randomNumber}`;
}

async function hitApi200TimesConcurrently(url, basePayload = {}, config = {}) {
  const requests = Array.from({ length: 100 }, () => {
    const payload = {
      ...basePayload,
      txnId: generateRandomTxnId()
    };
    return axios.post(url, payload, config);
  });

  try {
    const responses = await Promise.allSettled(requests);
    responses.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`✅ Request ${index + 1} succeeded:`, result?.value?.data || 'No data returned');
      } else {
        console.error(`❌ Request ${index + 1} failed:`, result?.data);
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}


connectDB().then(() => {
  logger.info('Database connected successfully');
  // hitApi200TimesConcurrently(
  //   'http://localhost:3000/api/v1/payment/create',
  //   {
  //     amount: 100,
  //     email: 'prakash@gmail.com',
  //     mobileNumber: '9992829898',
  //     name: 'prakash'
  //   },
  //   {
  //     headers: {
  //       'authorization': 'eyJhbGciOiJIUzM4NCIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfaWQiOiJVSUQtTUI3VVAwVUYtMlc0Sk9UIn0.r_QmH6s35gPNVPqMhXpwuKw86iFgEpQAn_SkbJFFbuEJbQaSFxB4lnYcUJZIRNk5',
  //       'client-id': 'UID-MB7UP0UF-2W4JOT'
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