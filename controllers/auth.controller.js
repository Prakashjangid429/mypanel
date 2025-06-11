import mongoose from 'mongoose';
import User from '../models/user.model.js';
import AppError from '../utils/appError.js';

const generateTokens = (user) => {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  return { accessToken, refreshToken };
};

export const registerUser = async (req, res, next) => {
  try {
    const requiredFields = [
      'userName', 'role', 'fullName', 'email',
      'mobileNumber', 'password', 'trxPassword',
      'package', 'minWalletBalance', 'address'
    ];

    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      return next(new AppError(
        `Please provide all required fields: ${missingFields.join(', ')}`,
        400
      ));
    }

    const {
      userName,
      role,
      fullName,
      email,
      mobileNumber,
      password,
      passwordConfirm,
      trxPassword,
      trxPasswordConfirm,
      package: pkg,
      minWalletBalance,
      address
    } = req.body;

    if (password !== passwordConfirm) {
      return next(new AppError('Passwords do not match', 400));
    }

    if (trxPassword !== trxPasswordConfirm) {
      return next(new AppError('Transaction passwords do not match', 400));
    }

    const existingUser = await User.findOne({ $or: [{ email }, { userName }, { mobileNumber }] });
    if (existingUser) {
      return next(new AppError('User already exists with this email, username or mobile number', 400));
    }

    const user = await User.create({
      userName,
      role,
      fullName,
      email,
      mobileNumber,
      password,
      trxPassword,
      package: pkg,
      minWalletBalance,
      address,
      isActive: true
    });

    const { accessToken, refreshToken } = generateTokens(user);

    user.refreshToken = refreshToken;
    await user.save();

    const userData = user.toObject();
    delete userData.password;
    delete userData.trxPassword;
    delete userData.refreshToken;
    delete userData.secretToken;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: userData,
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.correctPassword(password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated', 403));
    }

    const { accessToken, refreshToken } = generateTokens(user);

    user.refreshToken = refreshToken;
    await user.save();

    const userData = user.toObject();
    delete userData.password;
    delete userData.trxPassword;
    delete userData.refreshToken;
    delete userData.secretToken;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: userData,
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
};

export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserProfile = async (req, res, next) => {
  try {
    const allowedUpdates = ['fullName', 'mobileNumber', 'address', 'minWalletBalance'];
    const updates = Object.keys(req.body);
    const isValidUpdate = updates.every(update => allowedUpdates.includes(update));

    if (!isValidUpdate) {
      return next(new AppError('Invalid updates!', 400));
    }

    const user = await User.findByIdAndUpdate(req.user._id, req.body, {
      new: true,
      runValidators: true
    });

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, newPasswordConfirm } = req.body;

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      return next(new AppError('Please provide current password, new password and confirmation', 400));
    }

    if (newPassword !== newPasswordConfirm) {
      return next(new AppError('New passwords do not match', 400));
    }
    if (currentPassword === newPassword) {
      return next(new AppError('New password cannot be the same as current password', 400));
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (!(await user.correctPassword(currentPassword))) {
      return next(new AppError('Your current password is wrong', 401));
    }
    user.password = newPassword;
    await user.save();
    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const changeTrxPassword = async (req, res, next) => {
  try {
    const { currentTrxPassword, newTrxPassword, newTrxPasswordConfirm } = req.body;

    if (!currentTrxPassword || !newTrxPassword || !newTrxPasswordConfirm) {
      return next(new AppError('Please provide current transaction password, new transaction password and confirmation', 400));
    }

    if (newTrxPassword !== newTrxPasswordConfirm) {
      return next(new AppError('New transaction passwords do not match', 400));
    }

    const user = await User.findById(req.user._id).select('+trxPassword');
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (!(await user.correctTrxPassword(currentTrxPassword))) {
      return next(new AppError('Your current transaction password is wrong', 401));
    }

    user.trxPassword = newTrxPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Transaction password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const logoutUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    user.refreshToken = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive) filter.isActive = req.query.isActive === 'true';

    const sort = req.query.sort || '-createdAt';

    const users = await User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('+password +trxPassword +secretToken'); // Exclude sensitive fields

    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);


    res.status(200).json({
      success: true,
      count: users.length,
      totalUsers,
      totalPages,
      currentPage: page,
      users: users.map(user => ({
        ...user.toObject()
      }))
    });
  } catch (error) {
    next(error);
  }
};

export const toggleUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // Expects boolean true/false

    if (typeof status !== 'boolean') {
      return next(new AppError('Status must be a boolean value (true/false)', 400));
    }
    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        _id: { $ne: req.user._id }
      },
      {
        $set: { 
          isActive: status
        }
      },
      { 
        new: true,
        runValidators: true 
      }
    );

    if (!user) {
      return next(new AppError('User not found or cannot modify your own status', 404));
    }
    const action = status ? 'activate' : 'deactivate';
    res.status(200).json({
      success: true,
      message: `User ${action}d successfully`
    });

  } catch (error) {
    next(error);
  }
};

export const updateUserByAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    const restrictedFields = [
      'password',
      'trxPassword',
      'refreshToken',
      'secretToken',
      'userIdentity'
    ];

    const invalidUpdates = Object.keys(updates).filter(update => 
      restrictedFields.includes(update)
    );

    if (invalidUpdates.length > 0) {
      return next(new AppError(
        `Security-sensitive fields cannot be updated through this endpoint. Use dedicated password change endpoints. Invalid fields: ${invalidUpdates.join(', ')}`,
        400
      ));
    }

    const user = await User.findByIdAndUpdate(
      new mongoose.Types.ObjectId(userId),
      updates,
      { 
        new: true,
        runValidators: true,
        context: 'query'
      }
    ).select('-password -trxPassword -refreshToken -secretToken');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const userData = user.toObject();
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: {
        ...userData,
        upiWalletBalance: user.upiWalletBalance,
        eWalletBalance: user.eWalletBalance,
        minWalletBalance: user.minWalletBalance
      }
    });

  } catch (error) {
    next(error);
  }
};

export const settlementTransfer = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId } = req.params;
    const { amount, trxPassword } = req.body;

    if (!amount || amount <= 0) {
      await session.abortTransaction();
      return next(new AppError('Please provide a valid positive amount', 400));
    }

    // if (!trxPassword) {
    //   await session.abortTransaction();
    //   return next(new AppError('Transaction password is required', 400));
    // }

    const user = await User.findById(userId)
      .session(session);

    if (!user) {
      await session.abortTransaction();
      return next(new AppError('User not found', 404));
    }

    // const isTrxPasswordValid = await user.correctTrxPassword(trxPassword);
    // if (!isTrxPasswordValid) {
    //   await session.abortTransaction();
    //   return next(new AppError('Invalid transaction password', 401));
    // }

    if (user.eWalletBalance < amount) {
      await session.abortTransaction();
      return next(new AppError('Insufficient e-wallet balance', 400));
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          eWalletBalance: -amount,
          upiWalletBalance: amount
        }
      },
      { 
        new: true,
        runValidators: true,
        session 
      }
    ).select('-password -trxPassword -refreshToken');

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Settlement transfer successful',
      newBalances: {
        eWalletBalance: updatedUser.eWalletBalance,
        upiWalletBalance: updatedUser.upiWalletBalance
      }
    });

  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};