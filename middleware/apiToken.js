import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const clientId = req.headers['client-id'];

  if (!authHeader || !clientId) {
    return res.status(401).json({
      status: 'Failed',
      status_code: 401,
      message: 'Authorization header and client ID are required',
    });
  }

  try {
    const user = await User.findOne({ clientId, isActive: true })
      .select('+clientSecret -password -trxPassword -refreshToken -address')
      .populate([
        { path: 'payInApi', select: '-meta -createdAt -updatedAt -__v' },
        { path: 'package', select: '-createdAt -updatedAt -__v' }
      ])
      .lean();

    if (!user) {
      return res.status(401).json({
        status: 'Failed',
        status_code: 401,
        message: 'Invalid client ID or Account is inactive',
      });
    }

    const decoded = jwt.verify(authHeader, user.clientSecret, {
      algorithms: ['HS384'],
    });

    req.user = user;
    next();

  } catch (err) {
    next(err);
  }
};

