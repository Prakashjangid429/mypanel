import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import userMeta from '../models/userMeta.model.js';
import requestIp from "request-ip";


export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers['authorization'];

    if (!token) {
      return res.status(401).json({
        status: 'Failed',
        status_code: 401,
        message: 'Authorization token is required',
      });
    }

    let decodedToken;
    try {
      decodedToken = jwt.decode(token);
    } catch (decodeError) {
      return res.status(401).json({
        status: 'Failed',
        status_code: 401,
        message: 'Invalid token format',
      });
    }

    const clientId = decodedToken?.clientId;
    if (!clientId && !decodedToken.userName) {
      return res.status(401).json({
        status: 'Failed',
        status_code: 401,
        message: 'Client ID is required in token payload',
      });
    }

    const [user, userExtra] = await Promise.all([User.findOne({ userName: decodedToken.userName, clientId, isActive: true }, "-address -bankDetails -createdAt -updatedAt -__v")
      .populate([
        { path: 'payInApi', select: '-meta -createdAt -updatedAt -__v' },
        { path: 'package', select: '-createdAt -updatedAt -__v' }
      ])
      .lean(), userMeta.findOne({ clientId })]);

    if (!user) {
      return res.status(401).json({
        status: 'Failed',
        status_code: 401,
        message: 'Invalid client ID or Account is inactive',
      });
    }

    if (!userExtra || userExtra?.whitelistedIPs && userExtra?.whitelistedIPs?.length > 0) {
      const clientIP = requestIp.getClientIp(req);

      if (!userExtra?.whitelistedIPs.includes(clientIP)) {
        return res.status(403).json({
          status: 'Failed',
          status_code: 403, 
          message: `Access denied - IP not whitelisted - ${clientIP}`,
        }); 
      }
    }

    jwt.verify(token, user.clientSecret, { algorithms: ['HS256'] }, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          status: 'Failed',
          status_code: 401,
          message: 'Invalid or expired token',
          error: err.message,
        });
      }

      if (decoded.userName && decoded.userName !== user.userName) {
        return res.status(401).json({
          status: 'Failed',
          status_code: 401,
          message: 'Token user does not match',
        });
      }

      req.user = user;
      next();
    });

  } catch (err) {
    next(err);
  }
};