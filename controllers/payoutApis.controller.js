import PayoutApi from "../models/payoutApis.model.js";
import AppError from "../utils/appError.js";
import catchAsync from "../utils/catchAsync.js";

export const createPayoutApi = catchAsync(async (req, res, next) => {
  const newApi = await PayoutApi.create(req.body);
  res.status(201).json(newApi);
});

export const getAllPayoutApis = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    isActive,
    search,
    provider
  } = req.query;

  const filters = {};

  if (isActive) {
    filters.isActive = isActive === "true";
  }

  if (provider) {
    filters.provider = { $regex: provider, $options: "i" };
  }

  if (search) {
    filters.$or = [
      { name: { $regex: search, $options: "i" } },
      { baseUrl: { $regex: search, $options: "i" } },
      { provider: { $regex: search, $options: "i" } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const data = await PayoutApi.aggregate([
    { $match: filters },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: parseInt(limit) }
  ]);

  const totalCount = await PayoutApi.countDocuments(filters);
  const totalPages = Math.ceil(totalCount / limit);

  res.status(200).json({
    data,
    page: parseInt(page),
    totalPages,
    totalCount
  });
});

export const togglePayoutApiStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const api = await PayoutApi.findById(id);
  if (!api) return next(new AppError("API not found", 404));

  api.isActive = !api.isActive;
  await api.save();

  res.status(200).json({
    message: `API is now ${api.isActive ? "active" : "inactive"}`,
    isActive: api.isActive,
  });
});

export const getPayoutApiById = catchAsync(async (req, res, next) => {
  const api = await PayoutApi.findById(req.params.id);
  if (!api) return next(new AppError("API not found", 404));
  res.status(200).json(api);
});

export const updatePayoutApi = catchAsync(async (req, res, next) => {
  const updated = await PayoutApi.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!updated) return next(new AppError("API not found", 404));
  res.status(200).json(updated);
});

export const deletePayoutApi = catchAsync(async (req, res, next) => {
  const deleted = await PayoutApi.findByIdAndDelete(req.params.id);
  if (!deleted) return next(new AppError("API not found", 404));
  res.status(200).json({ message: "API deleted successfully" });
});
