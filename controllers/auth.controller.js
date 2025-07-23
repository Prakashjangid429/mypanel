import mongoose from 'mongoose';
import User from '../models/user.model.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';
import EwalletTransaction from '../models/ewallet.model.js';
import MainWalletTransaction from '../models/mainWallet.model.js';
import payoutRecordModel from '../models/payoutRecord.model.js';
import settlementModel from '../models/settlement.model.js';

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
      package: pkg,
      minWalletBalance,
      address
    } = req.body;

    // if (password !== passwordConfirm) {
    //   return next(new AppError('Passwords do not match', 400));
    // }

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
      minWalletBalance: Number(minWalletBalance),
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
    return next(error);
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
      // user: userData,
      accessToken,
      refreshToken
    });
  } catch (error) {
    return next(error);
  }
};

export const updateBankDetails = async (req, res, next) => {
  try {
    const allowedUpdates = [
      'bankName',
      'accountNumber',
      'accountHolderName',
      'ifscCode'
    ];

    const updates = Object.keys(req.body);
    const isValidUpdate = updates.every(update => allowedUpdates.includes(update));

    if (!isValidUpdate) {
      return next(new AppError('Invalid updates for bank details!', 400));
    }

    const requiredFields = ['accountNumber', 'ifscCode', 'accountHolderName'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      return next(new AppError(
        `Missing required fields: ${missingFields.join(', ')}`,
        400
      ));
    }

    if (!/^\d{9,18}$/.test(req.body.accountNumber)) {
      return next(new AppError(
        'Account number must be 9-18 digits long and contain only numbers',
        400
      ));
    }

    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(req.body.ifscCode)) {
      return next(new AppError(
        'IFSC code must be 11 characters in format: ABCD0123456',
        400
      ));
    }

    const bankDetailsUpdate = {};
    updates.forEach(update => {
      bankDetailsUpdate[`bankDetails.${update}`] = req.body[update].trim();
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: bankDetailsUpdate },
      {
        new: true,
        runValidators: true,
        select: '-password -__v' // Exclude sensitive fields
      }
    );

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Bank details updated successfully',
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern['bankDetails.accountNumber']) {
      return next(new AppError(
        'This account number is already registered',
        400
      ));
    }
    return next(error);
  }
};

export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-payInApi -payOutApi -package").lean();
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    return next(error);
  }
};

export const updateUserProfile = async (req, res, next) => {
  try {
    const allowedUpdates = ['fullName', 'mobileNumber', 'address'];
    const updates = Object.keys(req.body);
    console.log(updates)
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
    return next(error);
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
    return next(error);
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
    return next(error);
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
    return next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filters
    const matchStage = {};

    if (req.query.role) matchStage.role = req.query.role;
    if (req.query.isActive)
      matchStage.isActive = req.query.isActive == 'true';

    const sortField = req.query.sort || '-createdAt';
    const sortDirection = sortField.startsWith('-') ? -1 : 1;
    const sortKey = sortField.replace(/^-/, '');

    const sortStage = {};
    sortStage[sortKey] = sortDirection;

    // Build Aggregation Pipeline
    const pipeline = [];

    // Match Stage
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Lookup for Commission Package (example)
    pipeline.push({
      $lookup: {
        from: "commissionpackages", // collection name of CommissionPackage model
        localField: "package",
        foreignField: "_id",
        as: "packageInfo"
      }
    });

    // Unwind package info
    pipeline.push({
      $unwind: {
        path: "$packageInfo",
        preserveNullAndEmptyArrays: true
      }
    });

    // Lookup for PayIn Api (optional)
    pipeline.push({
      $lookup: {
        from: "payinapis", // collection name of PayInApi model
        localField: "payInApi",
        foreignField: "_id",
        as: "payInApiInfo"
      }
    });

    pipeline.push({
      $unwind: {
        path: "$payInApiInfo",
        preserveNullAndEmptyArrays: true
      }
    });

    // Lookup for Payout Api (optional)
    pipeline.push({
      $lookup: {
        from: "payoutapis", // collection name of PayoutApi model
        localField: "payOutApi",
        foreignField: "_id",
        as: "payOutApiInfo"
      }
    });

    pipeline.push({
      $unwind: {
        path: "$payOutApiInfo",
        preserveNullAndEmptyArrays: true
      }
    });

    // Add fullAddress from virtual
    pipeline.push({
      $addFields: {
        fullAddress: {
          $cond: [
            {
              $and: [
                { $ne: ["$address.street", null] },
                { $ne: ["$address.city", null] }
              ]
            },
            {
              $concat: [
                "$address.street", ", ",
                "$address.city", ", ",
                "$address.state", ", ",
                "$address.country", " - ",
                "$address.postalCode"
              ]
            },
            "N/A"
          ]
        }
      }
    });

    // Sort Stage
    pipeline.push({ $sort: sortStage });

    // Count Total Documents Before Pagination
    const totalPipeline = [...pipeline];
    totalPipeline.push({ $count: "total" });

    const totalCount = await User.aggregate(totalPipeline);
    const totalUsers = totalCount.length ? totalCount[0].total : 0;
    const totalPages = Math.ceil(totalUsers / limit);

    // Pagination Stage
    pipeline.push({ $skip: skip }, { $limit: limit });

    // Run Aggregation
    const users = await User.aggregate(pipeline);

    // Send Response
    return res.status(200).json({
      success: true,
      count: users.length,
      totalUsers,
      totalPages,
      currentPage: page,
      users
    });
  } catch (error) {
    return next(error);
  }
};

export const flatenUsers = async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('userName email _id') // Only return these fields
      .lean(); // Convert to plain JavaScript objects

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    return next(error);
  }
};

export const toggleUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // Expects boolean true/false

    if (typeof status != 'boolean') {
      return next(new AppError('Status must be a boolean value (true/false)', 400));
    }

    if (userId === req.user._id.toString()) {
      return next(new AppError('You cannot modify your own status', 403));
    }

    const user = await User.findOneAndUpdate(
      {
        _id: userId
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
    return next(error);
  }
};

export const updateUserByAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    const restrictedFields = [
      'password',
      'trxPassword',
      'refreshToken'
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
      { ...updates, payInApi: new mongoose.Types.ObjectId(updates.payInApi), payOutApi: new mongoose.Types.ObjectId(updates.payOutApi), package: new mongoose.Types.ObjectId(updates.package) },
      {
        new: true,
        runValidators: true
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
    return next(error);
  }
};

export const bulkSwitchApis = catchAsync(async (req, res, next) => {
  const { payInApi, payOutApi, applyToAll } = req.body;

  if (!payInApi && !payOutApi) {
    return next(new AppError('Please provide at least one API to update', 400));
  }

  const update = {};
  if (payInApi) update.payInApi = payInApi;
  if (payOutApi) update.payOutApi = payOutApi;

  const options = {
    new: true,
    runValidators: true
  };

  let result;
  let message = 'APIs updated for all existing users';

  if (applyToAll) {
    result = await User.updateMany({}, update, options);

    const userSchema = User.schema;
    if (payInApi) {
      userSchema.path('payInApi').default(payInApi);
    }
    if (payOutApi) {
      userSchema.path('payOutApi').default(payOutApi);
    }
    message = 'APIs updated for all existing users and set as default for new users';
  } else {
    result = await User.updateMany({}, update, options);
  }

  res.status(200).json({
    success: true,
    message
  });
});

export const switchUserApis = async (req, res, next) => {
  const { userId } = req.params;
  const { payInApi, payOutApi } = req.body;

  if (!payInApi && !payOutApi) {
    return next(new AppError('Please provide at least one API to update', 400));
  }
  try {

    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const update = {};
    if (payInApi) update.payInApi = payInApi;
    if (payOutApi) update.payOutApi = payOutApi;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      update,
      { new: true, runValidators: true }
    ).select('-password -trxPassword -refreshToken');

    res.status(200).json({
      success: true,
      message: 'User APIs updated successfully'
    });
  } catch (error) {
    return next(error);
  }
}

export const eWalletToMainWalletSettlement = async (req, res, next) => {
  try {
    const { userId, amount } = req.body;

    // Validate input
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid amount' });
    }
    // Get user with current balances
    const user = await User.findById(userId).select('+trxPassword eWalletBalance upiWalletBalance');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check sufficient balance
    if (user.eWalletBalance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient eWallet balance' });
    }

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update user balances
      const beforeEWalletBalance = user.eWalletBalance;
      const afterEWalletBalance = beforeEWalletBalance - amount;
      const beforeMainWalletBalance = user.upiWalletBalance;
      const afterMainWalletBalance = beforeMainWalletBalance + amount;

      user.eWalletBalance = afterEWalletBalance;
      user.upiWalletBalance = afterMainWalletBalance;
      await user.save({ session });

      // Create eWallet debit transaction
      const eWalletTransaction = new EwalletTransaction({
        userId,
        amount,
        type: 'debit',
        description: `Settlement to Main-Wallet`,
        beforeAmount: beforeEWalletBalance,
        afterAmount: afterEWalletBalance,
        status: 'success'
      });
      await eWalletTransaction.save({ session });

      // Create main wallet credit transaction
      const mainWalletTransaction = new MainWalletTransaction({
        userId,
        amount,
        type: 'credit',
        description: `Amount credit from settlement from E-Wallet`,
        beforeAmount: beforeMainWalletBalance,
        afterAmount: afterMainWalletBalance,
        status: 'success'
      });
      await mainWalletTransaction.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: 'Funds transferred successfully'
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    return next(error)
  }
};

export const bankSettlement = async (req, res) => {
  try {
    const {
      userId,
      amount,
      gatewayCharge,
      accountHolderName,
      utr,
      accountNumber,
      ifscCode,
      bankName,
      upiId,
      mobileNumber
    } = req.body;

    // Validate input
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid amount' });
    }

    if (!accountHolderName || !accountNumber || !ifscCode) {
      return res.status(400).json({ success: false, message: 'Bank details are incomplete' });
    }

    const user = await User.findById(new mongoose.Types.ObjectId(userId)).select('+trxPassword eWalletBalance upiWalletBalance');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const totalDeduction = amount + gatewayCharge;

    if (user.eWalletBalance < totalDeduction) {
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance. Need ${totalDeduction}, available ${user.eWalletBalance}`
      });
    }

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update user balance
      const beforeMainWalletBalance = user.eWalletBalance;
      const afterMainWalletBalance = beforeMainWalletBalance - totalDeduction;
      user.eWalletBalance = afterMainWalletBalance;
      await user.save({ session });

      // Create main wallet debit transaction
      const WalletTransaction = new EwalletTransaction({
        userId: user._id,
        amount: amount,
        charges: gatewayCharge,
        type: 'debit',
        description: `Bank transfer to ${accountHolderName} (${accountNumber})`,
        beforeAmount: beforeMainWalletBalance,
        afterAmount: afterMainWalletBalance,
        status: 'success' // Will update to success when bank confirms
      });
      await WalletTransaction.save({ session });

      const trxId = `BANK-${Date.now()}`;

      const settlement = new settlementModel({
        user_id: user._id,
        amount,
        gatewayCharge,
        accountHolderName,
        accountNumber,
        ifscCode,
        bankName: bankName || 'N/A',
        upiId: upiId || '',
        mobileNumber: mobileNumber || user.mobileNumber,
        utr,
        trxId,
        status: 'Success'
      });
      await settlement.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: 'Bank transfer initiated successfully'
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error in bank settlement:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const mainWalletToEWalletSettlement = async (req, res, next) => {
  try {
    const { userId, amount } = req.body;

    // Validate input
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid amount'
      });
    }

    // Get user with current balances
    const user = await User.findById(userId)
      .select('+trxPassword eWalletBalance upiWalletBalance');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check sufficient balance in main wallet
    if (user.upiWalletBalance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient Main Wallet balance'
      });
    }

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update user balances
      const beforeMainWalletBalance = user.upiWalletBalance;
      const afterMainWalletBalance = beforeMainWalletBalance - amount;
      const beforeEWalletBalance = user.eWalletBalance;
      const afterEWalletBalance = beforeEWalletBalance + amount;

      user.upiWalletBalance = afterMainWalletBalance;
      user.eWalletBalance = afterEWalletBalance;
      await user.save({ session });

      // Create main wallet debit transaction
      const mainWalletTransaction = new MainWalletTransaction({
        userId,
        amount,
        type: 'debit',
        description: `Settlement to E-Wallet`,
        beforeAmount: beforeMainWalletBalance,
        afterAmount: afterMainWalletBalance,
        status: 'success'
      });
      await mainWalletTransaction.save({ session });

      // Create eWallet credit transaction
      const eWalletTransaction = new EwalletTransaction({
        userId,
        amount,
        charges:0,
        type: 'credit',
        description: `Amount credit from Main Wallet settlement`,
        beforeAmount: beforeEWalletBalance,
        afterAmount: afterEWalletBalance,
        status: 'success'
      });
      await eWalletTransaction.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: 'Funds transferred successfully',
        data: {
          newMainWalletBalance: afterMainWalletBalance,
          newEWalletBalance: afterEWalletBalance
        }
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    return next(error);
  }
};