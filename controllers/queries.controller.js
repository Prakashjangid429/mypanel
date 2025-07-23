import Query from "../models/query.model.js";
import AppError from "../utils/appError.js";

// Create a new query
export const createQuery = async (req, res, next) => {
  try {
    const { subject, message, category, priority } = req.body;

    const query = await Query.create({
      userId: req.user._id,
      userName: req.user.userName || req.user.email,
      email: req.user.email,
      subject,
      message,
      category,
      priority: priority || "medium",
      attachments: [`/uploads/${req.file.filename}`] || [],
    });

    res.status(201).json({
      success: true,
      data: query,
    });
  } catch (error) {
    next(error);
  }
};

// Get all queries (with filters)
export const getQueries = async (req, res, next) => {
  try {
    const {
      status,
      priority,
      category,
      search,
      assignedTo,
      userId,
      fromDate,
      toDate,
      sortBy = "createdAt",
      order = -1,
      page = 1,
      limit = 10
    } = req.query;

    // Build filter object
    const filter = {};

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (assignedTo) filter.assignedTo = assignedTo;

    // For regular users, only show their own queries
    if (req?.user?.role !== "Admin") {
      filter.userId = req.user._id;
    } else if (userId) {
      filter.userId = userId;
    }

    // Date range filter
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    // Search filter
    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (page - 1) * limit;

    const [queries, total] = await Promise.all([
      Query.find(filter)
        .sort({ [sortBy]: Number(order) })
        .skip(skip)
        .limit(limit),
      Query.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: queries,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single query
export const getQueryById = async (req, res, next) => {
  try {
    const query = await Query.findById(req.params.id)
      .populate("userId", "userName email");

    if (!query) {
      return next(new AppError("Query not found", 404));
    }

    res.status(200).json({
      success: true,
      data: query,
    });
  } catch (error) {
    next(error);
  }
};

// Update query
export const updateQuery = async (req, res, next) => {
  try {
    const { status, resolutionNotes, assignedTo } = req.body;

    const updateFields = {};
    if (status) updateFields.status = status;
    if (resolutionNotes) updateFields.resolutionNotes = resolutionNotes;
    if (assignedTo) updateFields.assignedTo = assignedTo;

    const query = await Query.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    );

    if (!query) {
      return next(new AppError("Query not found", 404));
    }

    res.status(200).json({
      success: true,
      data: query,
    });
  } catch (error) {
    next(error);
  }
};

// Delete query
export const deleteQuery = async (req, res, next) => {
  try {
    const query = await Query.findByIdAndDelete(req.params.id);

    if (!query) {
      return next(new AppError("Query not found", 404));
    }

    res.status(204).json({
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};