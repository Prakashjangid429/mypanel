import { isCelebrateError } from 'celebrate';
import AppError from '../utils/appError.js';

const handleCastErrorDB = err => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = err => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];

  const message = `Duplicate field value: "${value}" for "${field}". Please use another value!`;
  return new AppError(message, 400);
};


const handleValidationErrorDB = err => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () => new AppError('Invalid token !', 401);

const handleJWTExpiredError = () => new AppError('Your token has expired !', 401);


const sendErrorProd = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    status_code: err.statusCode,
    message: err.message
  });
};

export default (err, req, res, next) => {
  // if (isCelebrateError(err)) {
  //   const validationErrors = [];
  //   for (const [segment, joiError] of err.details.entries()) {
  //     validationErrors.push(joiError.message);
  //   }
  //   return res.status(400).json({
  //     status: 'fail',
  //     statusCode: 400,
  //     message: 'Validation error',
  //     errors: validationErrors,
  //   }); 
  // }
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = { ...err };
  error.message = err.message;
  if (error.name === 'CastError') error = handleCastErrorDB(error);
  if (error.code === 11000) error = handleDuplicateFieldsDB(error);
  if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
  if (error.name === 'JsonWebTokenError') error = handleJWTError();
  if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

  sendErrorProd(error, res);
};