import PayInApi from "../models/payInApis.model.js";
import AppError from "../utils/appError.js";
import catchAsync from "../utils/catchAsync.js";

export const createPayInApi = catchAsync(async (req, res, next) => {
  const newApi = await PayInApi.create(req.body);
  res.status(201).json(newApi);
});

export const getAllPayInApis = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    isActive,
    search,
    provider
  } = req.query;

  const matchStage = {};

  if (isActive) {
    matchStage.isActive = isActive == "true";
  }

  if (provider) {
    matchStage.provider = { $regex: provider, $options: "i" };
  }

  if (search) {
    matchStage.$or = [
      { name: { $regex: search, $options: "i" } },
      { baseUrl: { $regex: search, $options: "i" } },
      { provider: { $regex: search, $options: "i" } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const pipeline = [
    { $match: matchStage },
    {
      $facet: {
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: parseInt(limit) }
        ],
        totalCount: [
          { $count: "count" }
        ]
      }
    }
  ];

  const result = await PayInApi.aggregate(pipeline);

  const data = result[0].data;
  const totalCount = result[0].totalCount[0]?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  res.status(200).json({
    data,
    page: parseInt(page),
    totalPages,
    totalCount
  });
});

export const getPayInApiById = catchAsync(async (req, res, next) => {
  const api = await PayInApi.findById(req.params.id);
  if (!api) return next(new AppError("API not found", 404));
  res.status(200).json(api);
});

export const togglePayInApiStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const api = await PayInApi.findById(id);
  if (!api) return next(new AppError("API not found", 404));

  api.isActive = !api.isActive;
  await api.save();

  res.status(200).json({
    message: `API is now ${api.isActive ? "active" : "inactive"}`,
    isActive: api.isActive,
  });
});

export const updatePayInApi = catchAsync(async (req, res, next) => {
  const updated = await PayInApi.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!updated) return next(new AppError("API not found", 404));
  res.status(200).json(updated);
});

export const deletePayInApi = catchAsync(async (req, res, next) => {
  const deleted = await PayInApi.findByIdAndDelete(req.params.id);
  if (!deleted) return next(new AppError("API not found", 404));
  res.status(200).json({ message: "API deleted successfully" });
});
