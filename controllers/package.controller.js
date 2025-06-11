import CommissionPackage from '../models/package.model.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';

// Create or Update a Commission Package
export const upsertCommissionPackage = catchAsync(async (req, res, next) => {
  const { packageName, packageInfo, payInCharges, payOutCharges, isActive } = req.body;

  const updated = await CommissionPackage.findOneAndUpdate(
    { packageName },
    { packageInfo, payInCharges, payOutCharges, isActive },
    { upsert: true, new: true, runValidators: true }
  );

  res.status(200).json({ success: true, data: updated });
});

// Get all commission packages
export const getAllCommissionPackages = catchAsync(async (req, res, next) => {
  const data = await CommissionPackage.find();
  res.status(200).json({ success: true, data });
});

// Get single package by ID
export const getCommissionPackageById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const data = await CommissionPackage.findById(id);
  if (!data) return next(new AppError("Commission package not found", 404));
  res.status(200).json({ success: true, data });
});

// Delete a package
export const deleteCommissionPackage = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const deleted = await CommissionPackage.findByIdAndDelete(id);
  if (!deleted) return next(new AppError("Commission package not found", 404));
  res.status(200).json({ success: true, message: 'Commission package deleted' });
});
