import Chargeback from "../models/chargeBack.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";
import payInModel from "../models/payin.model.js";
import eWalletModel from "../models/ewallet.model.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";

export const getChargebackRecords = catchAsync(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        status,
        fromDate,
        toDate,
        search,
        user_id,
        sortField = 'createdAt',
        sortOrder = 'desc'
    } = req.query;

    // Base match conditions
    const matchConditions = [];

    if (req?.user?.role === "Admin") {
        if (user_id) matchStage.user_id = new mongoose.Types.ObjectId(user_id);
    } else {
        matchStage.user_id = new mongoose.Types.ObjectId(req.user?._id);
    }

    // Status filter
    if (status) {
        matchConditions.push({ $match: { status } });
    }

    // Date range filter
    if (fromDate || toDate) {
        const dateFilter = {};
        if (fromDate) dateFilter.$gte = new Date(fromDate);
        if (toDate) dateFilter.$lte = new Date(toDate);
        matchConditions.push({ $match: { createdAt: dateFilter } });
    }

    // Search filter (for payerName, txnId, or description)
    if (search) {
        matchConditions.push({
            $match: {
                $or: [
                    { payerName: { $regex: search, $options: 'i' } },
                    { txnId: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ]
            }
        });
    }

    // Aggregation pipeline
    const aggregationPipeline = [
        ...matchConditions,
        {
            $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user",
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            email: 1,
                            mobileNumber: 1
                        }
                    }
                ]
            }
        },
        { $unwind: "$user" },
        {
            $sort: {
                [sortField]: sortOrder === 'desc' ? -1 : 1
            }
        },
        {
            $facet: {
                metadata: [
                    { $count: "total" },
                    { $addFields: { page: Number(page), limit: Number(limit) } }
                ],
                data: [
                    { $skip: (Number(page) - 1) * Number(limit) },
                    { $limit: Number(limit) }
                ]
            }
        },
        {
            $project: {
                data: 1,
                metadata: { $arrayElemAt: ["$metadata", 0] }
            }
        }
    ];

    const result = await Chargeback.aggregate(aggregationPipeline);

    const response = {
        status: "success",
        message: "Chargeback records fetched successfully",
        data: result[0]?.data || [],
        pagination: {
            total: result[0]?.metadata?.total || 0,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil((result[0]?.metadata?.total || 0) / Number(limit))
        }
    };

    return res.status(200).json(response);
});

export const generateChargeBack = catchAsync(async (req, res) => {
    const { txnId, reason, charges } = req.body;

    // Validate input
    if (!txnId || !reason || charges === undefined) {
        return res.status(400).json({
            status: "Failed",
            message: "Missing required fields: txnId, reason, or charges"
        });
    }

    // Start session with transaction options
    const session = await mongoose.startSession();

    try {
        session.startTransaction();
        const opts = { session, new: true };

        // Find the payin transaction and check for existing chargeback in a single query
        const [payinData, existingChargeback] = await Promise.all([
            payInModel.findOne({ txnId }).session(session),
            Chargeback.findOne({ txnId }).session(session)
        ]);

        if (!payinData) {
            throw new AppError("Transaction not found", 404);
        }

        if (existingChargeback) {
            throw new AppError("Chargeback already exists for this transaction", 400);
        }

        // Prepare chargeback data
        const chargebackData = {
            user_id: payinData.user_id,
            txnId: payinData.txnId,
            reason,
            amount: payinData.amount,
            charges,
            payerName: payinData.payerName,
            description: `Chargeback for transaction ${payinData.txnId}`,
            utr: payinData.utr || `CB-${Date.now()}`,
            vpaId: payinData.vpaId
        };

        // Process user balance update
        const user = await User.findByIdAndUpdate(
            payinData.user_id,
            { $inc: { eWalletBalance: -(payinData.amount + charges) } },
            opts
        ).select("eWalletBalance");

        if (!user) {
            throw new AppError("User not found", 404);
        }

        // Verify the balance didn't go negative
        const updatedUser = await User.findById(payinData.user_id).session(session);
        if (updatedUser.eWalletBalance < 0) {
            throw new AppError("Insufficient balance for chargeback", 400);
        }

        // Create eWallet transaction record
        const eWalletTransaction = {
            userId: payinData.user_id,
            amount: payinData.amount,
            type: "debit",
            description: `Chargeback for transaction ${payinData.txnId}`,
            beforeAmount: user.eWalletBalance,
            afterAmount: updatedUser.eWalletBalance,
            status: "success"
        };

        // Execute all operations in parallel
        await Promise.all([
            Chargeback.create([chargebackData], opts),
            eWalletModel.create([eWalletTransaction], opts)
        ]);

        await session.commitTransaction();

        return res.status(200).json({
            status: "Success",
            message: "Chargeback processed successfully"
        });
    } catch (error) {
        await session.abortTransaction();

        // Handle known error types
        if (error instanceof AppError) {
            return res.status(error.statusCode || 500).json({
                status: "Failed",
                message: error.message
            });
        }

        // Handle other errors
        return res.status(500).json({
            status: "Failed",
            message: error.message || "An unexpected error occurred while processing chargeback"
        });
    } finally {
        session.endSession();
    }
});