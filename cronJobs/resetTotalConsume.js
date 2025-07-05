import cron from 'node-cron';
import moment from 'moment-timezone';
import UserMeta from './models/userMeta.model.js';

// Schedule the cron job to run every day at 00:00 IST
cron.schedule('0 0 * * *', async () => {
  const now = moment().tz('Asia/Kolkata');

  console.log(`[Cron] Running daily reset at IST: ${now.format('YYYY-MM-DD HH:mm:ss')}`);

  try {
    const result = await UserMeta.updateMany({}, { $set: { todayConsume: 0 } });
    console.log(`[Cron] Reset todayConsume for ${result.modifiedCount} users.`);
  } catch (error) {
    console.error('[Cron] Error resetting todayConsume:', error);
  }
}, {
  timezone: 'Asia/Kolkata'
});
