import UserMeta from '../models/userMeta.model.js';
import AppError from '../utils/appError.js';

export const upsertUserMeta = async (req, res, next) => {
  try {
    const { payInCallbackUrl, payOutCallbackUrl, meta } = req.body;
    const updated = await UserMeta.findOneAndUpdate(
      { userId: req.user._id },
      { payInCallbackUrl, payOutCallbackUrl, meta, clientId: req.user.clientId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
};

// Get Meta by User ID (Self)
export const getUserMeta = async (req, res, next) => {
  try {
    const data = await UserMeta.findOne({ userId: req.user._id });

    if (!data) return next(new AppError('User meta not found', 400));

    res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Admin: Get Meta by any userId
export const getMetaByUserId = async (req, res, next) => {
  try {
    const data = await UserMeta.findOne({ userId: req.params.userId });

    if (!data) return next(new AppError('Meta not found', 404));

    res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Admin: Add or update whitelisted IPs
export const updateWhitelistedIPs = async (req, res, next) => {
  try {
    const { userId, whitelistedIPs } = req.body;

    if (!Array.isArray(whitelistedIPs)) {
      return next(new AppError('whitelistedIPs must be an array', 400));
    }

    const updated = await UserMeta.findOneAndUpdate(
      { userId },
      { whitelistedIPs, clientId: req.user.clientId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (!updated) return next(new AppError('User meta not found', 404));

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
};

// Admin: Delete Meta
export const deleteUserMeta = async (req, res, next) => {
  try {
    const result = await UserMeta.findOneAndDelete({ userId: req.params.userId });

    if (!result) {
      return res.status(404).json({ success: false, message: 'User meta not found' });
    }

    res.status(200).json({ success: true, message: 'User meta deleted' });
  } catch (error) {
    return next(error);
  }
};
