import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import AppError from '../utils/appError.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const currentUser = await User.findOne({ _id: decoded._id, isActive: true }, "-address -bankDetails -createdAt -updatedAt -__v");
    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists or Not Active.', 401));
    }
    req.user = currentUser;
    next();
  } catch (error) {
    console.error('Error in protect middleware:', error);
    return next(error);
  }
};
 
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next(); 
  };
};