import PayInReport from "../models/payin.model.js";
import PayinGenerationRecord from "../models/payinRequests.model.js";
import PayoutSucess from "../models/payout.model.js";
import PayoutReport from "../models/payoutRecord.model.js"
import EwalletTransaction from "../models/ewallet.model.js";
import MainWalletTransaction from "../models/mainWallet.model.js";

import json2csv from "json-2-csv";
import moment from "moment";
import mongoose from "mongoose";

export const getPayinRecords = async (req, res) => {
    try {
        const { query } = req;
        const {
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            order = -1,
            exportCsv = false,
            search = "",
            status,
            user_id,
            fromDate,
            toDate
        } = query;

        const pipeline = [];

        // Step 1: Match Filters
        const matchStage = {};

        if (status) matchStage.status = status;
        if (req?.user?.role === "Admin") {
            if (user_id) matchStage.user_id = new mongoose.Types.ObjectId(user_id);
        } else {
            matchStage.user_id = new mongoose.Types.ObjectId(req.user?._id);
        }

        // Default toDate to now if not provided
        const toDateTime = toDate ? new Date(toDate) : new Date();

        if (fromDate) {
            matchStage.createdAt = {
                $gte: new Date(fromDate),
                $lte: toDateTime
            };
        }

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        if (search.trim()) {
            pipeline.push(
                {
                    $addFields: {
                        searchableFields: {
                            $concat: [
                                "$txnId", " ",
                                "$refId", " ",
                                "$gateWayId", " ",
                                "$utr", " ",
                                "$name", " ",
                                "$email", " ",
                                "$mobileNumber"
                            ]
                        }
                    }
                },
                {
                    $match: {
                        searchableFields: { $regex: search.trim(), $options: "i" }
                    }
                }
            );
        }

        pipeline.push({
            $lookup: {
                from: "users", // MongoDB collection name of User model
                localField: "user_id",
                foreignField: "_id",
                as: "user"
            }
        });

        pipeline.push({
            $unwind: "$user"
        });

        pipeline.push({
            $project: {
                _id: 0,
                // user_id: 1,
                username: "$user.userName", // Include username
                txnId: 1,
                refId: 1,
                gateWayId: 1,
                amount: 1,
                chargeAmount: 1,
                utr: 1,
                name: 1,
                email: 1,
                mobileNumber: 1,
                qrData: 1,
                qrIntent: 1,
                status: 1,
                requestedAt: 1,
                failureReason: 1,
                createdAt: 1,
                updatedAt: 1
            }
        });

        if (exportCsv === "true") {
            const csvPipeline = [...pipeline].filter(stage =>
                !["$skip", "$limit", "$sort"].includes(Object.keys(stage)[0])
            );

            const csvData = await PayinGenerationRecord.aggregate(csvPipeline);

            const formattedData = csvData.map(record => ({
                ...record,
                createdAt: moment(record.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                updatedAt: moment(record.updatedAt).format("YYYY-MM-DD HH:mm:ss"),
            }));

            const csv = json2csv.json2csv(formattedData);

            res.header("Content-Type", "text/csv");
            res.header("Content-Disposition", `attachment; filename=payin_export_${moment().format("YYYYMMDD_HHmmss")}.csv`);
            return res.send(csv);
        }

        pipeline.push(
            { $sort: { [sortBy]: parseInt(order) } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        );

        const results = await PayinGenerationRecord.aggregate(pipeline);

        const countPipeline = [...pipeline].filter(stage =>
            !["$skip", "$limit", "$sort"].includes(Object.keys(stage)[0])
        );
        countPipeline.push({ $count: "total" });

        const countResult = await PayinGenerationRecord.aggregate(countPipeline);
        const total = countResult.length ? countResult[0].total : 0;

        return res.json({
            success: true,
            data: results,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error("[ERROR] Failed to fetch payin records:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching payin records."
        });
    }
};

export const getPayInSuccess = async (req, res) => {
    try {
        const { query } = req;
        const {
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            order = -1,
            exportCsv = false,
            user_id,
            fromDate,
            toDate,
            status,
            minAmount,
            maxAmount,
            search = "",
        } = query;

        const pipeline = [];

        // Step 1: Match filters
        const matchStage = {};

        if (req?.user?.role === "Admin") {
            if (user_id) matchStage.user_id = new mongoose.Types.ObjectId(user_id);
        } else {
            matchStage.user_id = new mongoose.Types.ObjectId(req.user?._id);
        }
        if (status) matchStage.isSuccess = status;

        if (fromDate && toDate) {
            matchStage.createdAt = {
                $gte: new Date(fromDate),
                $lte: new Date(toDate)
            };
        }

        if (minAmount || maxAmount) {
            matchStage.amount = {};
            if (minAmount) matchStage.amount.$gte = parseFloat(minAmount);
            if (maxAmount) matchStage.amount.$lte = parseFloat(maxAmount);
        }

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // Step 2: Search across fields
        if (search.trim()) {
            pipeline.push({
                $addFields: {
                    searchable: {
                        $concat: [
                            "$trxId", " ", "$payerName", " ",
                            "$bankRRN", " ", "$description"
                        ]
                    }
                }
            }, {
                $match: {
                    searchable: { $regex: search.trim(), $options: "i" }
                }
            });
        }

        // Step 3: Project only necessary fields
        pipeline.push({
            $project: {
                _id: 0,
                memberId: 1,
                payerName: 1,
                trxId: 1,
                amount: 1,
                chargeAmount: 1,
                finalAmount: 1,
                vpaId: 1,
                bankRRN: 1,
                description: 1,
                trxInItDate: 1,
                trxCompletionDate: 1,
                isSuccess: 1,
                createdAt: 1,
                updatedAt: 1
            }
        });

        // Step 4: CSV Export
        if (exportCsv === "true") {
            const csvData = await PayInReport.aggregate(pipeline);

            const formattedData = csvData.map(record => ({
                ...record,
                createdAt: moment(record.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                updatedAt: moment(record.updatedAt).format("YYYY-MM-DD HH:mm:ss")
            }));

            const csv = await json2csv.json2csv(formattedData);

            res.header("Content-Type", "text/csv");
            res.header("Content-Disposition", "attachment; filename=payin_reports.csv");
            return res.send(csv);
        }

        // Step 5: Sort, Paginate
        pipeline.push(
            { $sort: { [sortBy]: parseInt(order) } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        );

        const results = await PayInReport.aggregate(pipeline);

        // Step 6: Count Total
        const countPipeline = [...pipeline].filter(stage =>
            !["$skip", "$limit", "$sort"].includes(Object.keys(stage)[0])
        );
        countPipeline.push({ $count: "total" });

        const countResult = await PayInReport.aggregate(countPipeline);
        const total = countResult.length ? countResult[0].total : 0;

        return res.json({
            success: true,
            data: results,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error("[ERROR] PayIn report fetch failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching PayIn reports."
        });
    }
};

export const getPayoutReports = async (req, res) => {
    try {
        const { query } = req;
        const {
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            order = -1,
            exportCsv = false,
            user_id,
            fromDate,
            toDate,
            status,
            minAmount,
            maxAmount,
            search = "",
        } = query;

        const pipeline = [];

        // Step 1: Match Filters
        const matchStage = {};

        if (req?.user?.role === "Admin") {
            if (user_id) matchStage.user_id = new mongoose.Types.ObjectId(user_id);
        } else {
            matchStage.user_id = new mongoose.Types.ObjectId(req.user?._id);
        }
        if (status) matchStage.status = status;

        if (fromDate && toDate) {
            matchStage.createdAt = {
                $gte: new Date(fromDate),
                $lte: new Date(toDate)
            };
        }

        if (minAmount || maxAmount) {
            matchStage.amount = {};
            if (minAmount) matchStage.amount.$gte = parseFloat(minAmount);
            if (maxAmount) matchStage.amount.$lte = parseFloat(maxAmount);
        }

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // Step 2: Add search capability
        if (search.trim()) {
            pipeline.push({
                $addFields: {
                    searchable: {
                        $concat: [
                            "$trxId", " ", "$accountHolderName", " ",
                            "$accountNumber", " ", "$utr", " ",
                            "$ifscCode", " ", "$gateWayId"
                        ]
                    }
                }
            }, {
                $match: {
                    searchable: { $regex: search.trim(), $options: "i" }
                }
            });
        }

        // Step 3: Lookup user information
        pipeline.push({
            $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user"
            }
        }, {
            $unwind: {
                path: "$user",
                preserveNullAndEmptyArrays: true
            }
        });

        // Step 4: Project fields including username
        pipeline.push({
            $project: {
                _id: 0,
                user_id: 1,
                userName: "$user.userName", // Add username from user lookup
                mobileNumber: 1,
                accountHolderName: 1,
                accountNumber: 1,
                utr: 1,
                ifscCode: 1,
                bankName: 1,
                upiId: 1,
                amount: 1,
                gatewayCharge: 1,
                afterChargeAmount: 1,
                trxId: 1,
                gateWayId: 1,
                status: 1,
                failureReason: 1,
                createdAt: 1,
                updatedAt: 1
            }
        });

        // Step 5: CSV Export
        if (exportCsv === "true") {
            const csvData = await PayoutReport.aggregate(pipeline);

            const formattedData = csvData.map(record => ({
                "Transaction ID": record.trxId || "N/A",
                "Username": record.userName || "N/A", // Include username in CSV
                "Mobile Number": record.mobileNumber || "N/A",
                "Account Holder": record.accountHolderName || "N/A",
                "Account Number": `${record.accountNumber}` || "N/A",
                "UTR": record.utr || "N/A",
                "IFSC Code": record.ifscCode || "N/A",
                "Bank Name": record.bankName || "N/A",
                "UPI ID": record.upiId || "N/A",
                "Amount": `₹${(record.amount || 0).toFixed(2)}`,
                "Gateway Charge": `₹${(record.gatewayCharge || 0).toFixed(2)}`,
                "Net Amount": `₹${(record.afterChargeAmount || 0).toFixed(2)}`,
                "Gateway ID": record.gateWayId || "N/A",
                "Status": record.status ? record.status.toUpperCase() : "N/A",
                "Failure Reason": record.failureReason || "N/A",
                "Created At": moment(record.createdAt).format("DD-MM-YYYY HH:mm:ss"),
                "Updated At": moment(record.updatedAt).format("DD-MM-YYYY HH:mm:ss")
            }));

            // Define explicit field order for CSV
            const fields = [
                "Transaction ID",
                "Username",
                "Mobile Number",
                "Account Holder",
                "Account Number",
                "IFSC Code",
                "Bank Name",
                "UPI ID",
                "Amount",
                "Gateway Charge",
                "Net Amount",
                "Gateway ID",
                "UTR",
                "Status",
                "Failure Reason",
                "Created At",
                "Updated At"
            ];

            const csvOptions = {
                fields,
                excelStrings: true,
                withBOM: true,
                delimiter: ","
            };

            const csv = json2csv.json2csv(formattedData, csvOptions);

            res.header("Content-Type", "text/csv");
            res.header("Content-Disposition", `attachment; filename=payout_reports_${moment().format('YYYYMMDD_HHmmss')}.csv`);
            return res.send(csv);
        }

        // Step 6: Sort & Paginate
        pipeline.push(
            { $sort: { [sortBy]: parseInt(order) } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        );

        const results = await PayoutReport.aggregate(pipeline);

        // Step 7: Count total documents
        const countPipeline = [...pipeline].filter(stage =>
            !["$skip", "$limit", "$sort"].includes(Object.keys(stage)[0])
        );
        countPipeline.push({ $count: "total" });

        const countResult = await PayoutReport.aggregate(countPipeline);
        const total = countResult.length ? countResult[0].total : 0;

        return res.json({
            success: true,
            data: results,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error("[ERROR] Failed to fetch payout reports:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching payout reports."
        });
    }
};

export const getPayoutStats = async (req, res) => {
    try {
        const { query } = req;
        const { fromDate, toDate } = query;

        const pipeline = [];

        // Match date range
        if (fromDate && toDate) {
            pipeline.push({
                $match: {
                    createdAt: {
                        $gte: new Date(fromDate),
                        $lte: new Date(toDate)
                    }
                }
            });
        }

        // Group by status and calculate totals
        pipeline.push({
            $group: {
                _id: "$status",
                count: { $sum: 1 },
                totalAmount: { $sum: "$amount" },
                totalGatewayCharge: { $sum: "$gatewayCharge" },
                totalAfterChargeAmount: { $sum: "$afterChargeAmount" }
            }
        });

        const result = await PayoutReport.aggregate(pipeline);

        const stats = {
            totalPayouts: 0,
            totalAmount: 0,
            totalGatewayCharge: 0,
            totalAfterChargeAmount: 0,
            breakdown: {}
        };

        result.forEach(stat => {
            stats.breakdown[stat._id] = {
                count: stat.count,
                totalAmount: stat.totalAmount,
                totalGatewayCharge: stat.totalGatewayCharge,
                totalAfterChargeAmount: stat.totalAfterChargeAmount
            };
            stats.totalPayouts += stat.count;
            stats.totalAmount += stat.totalAmount;
            stats.totalGatewayCharge += stat.totalGatewayCharge;
            stats.totalAfterChargeAmount += stat.totalAfterChargeAmount;
        });

        return res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error("[ERROR] Failed to fetch payout stats:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching payout stats."
        });
    }
};

export const getPayOutSuccess = async (req, res) => {
    try {
        const { query } = req;
        const {
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            order = -1,
            exportCsv = false,
            user_id,
            fromDate,
            toDate,
            status,
            minAmount,
            maxAmount,
            search = "",
        } = query;

        const pipeline = [];

        // Step 1: Match Filters
        const matchStage = {};
        if (req?.user?.role === "Admin") {
            if (user_id) matchStage.user_id = new mongoose.Types.ObjectId(user_id);
        } else {
            matchStage.user_id = new mongoose.Types.ObjectId(req.user?._id);
        }
        if (status) matchStage.isSuccess = status;

        if (fromDate && toDate) {
            matchStage.createdAt = {
                $gte: new Date(fromDate),
                $lte: new Date(toDate)
            };
        }

        if (minAmount || maxAmount) {
            matchStage.amount = {};
            if (minAmount) matchStage.amount.$gte = parseFloat(minAmount);
            if (maxAmount) matchStage.amount.$lte = parseFloat(maxAmount);
        }

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // Step 2: Add search capability
        if (search.trim()) {
            pipeline.push({
                $addFields: {
                    searchable: {
                        $concat: [
                            "$trxId", " ", "$utr", " ",
                            "$referenceID"
                        ]
                    }
                }
            }, {
                $match: {
                    searchable: { $regex: search.trim(), $options: "i" }
                }
            });
        }

        // Step 3: Project only necessary fields
        pipeline.push({
            $project: {
                _id: 0,
                user_id: 1,
                utr: 1,
                trxId: 1,
                amount: 1,
                chargeAmount: 1,
                finalAmount: 1,
                referenceID: 1,
                isSuccess: 1,
                createdAt: 1,
                updatedAt: 1
            }
        });

        // Step 4: CSV Export
        if (exportCsv === "true") {
            const csvData = await PayOutReport.aggregate(pipeline);

            const formattedData = csvData.map(record => ({
                ...record,
                createdAt: moment(record.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                updatedAt: moment(record.updatedAt).format("YYYY-MM-DD HH:mm:ss")
            }));

            const csv = await json2csv.json2csvAsync(formattedData);

            res.header("Content-Type", "text/csv");
            res.header("Content-Disposition", "attachment; filename=payout_reports.csv");
            return res.send(csv);
        }

        // Step 5: Sort & Paginate
        pipeline.push(
            { $sort: { [sortBy]: parseInt(order) } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        );

        const results = await PayOutReport.aggregate(pipeline);

        // Step 6: Count total documents
        const countPipeline = [...pipeline].filter(stage =>
            !["$skip", "$limit", "$sort"].includes(Object.keys(stage)[0])
        );
        countPipeline.push({ $count: "total" });

        const countResult = await PayOutReport.aggregate(countPipeline);
        const total = countResult.length ? countResult[0].total : 0;

        return res.json({
            success: true,
            data: results,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error("[ERROR] Failed to fetch payout reports:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching payout reports."
        });
    }
};

export const getPayOutSuccessStats = async (req, res) => {
    try {
        const { query } = req;
        const { fromDate, toDate } = query;

        const pipeline = [];

        // Match date range
        if (fromDate && toDate) {
            pipeline.push({
                $match: {
                    createdAt: {
                        $gte: new Date(fromDate),
                        $lte: new Date(toDate)
                    }
                }
            });
        }

        // Group by status and calculate totals
        pipeline.push({
            $group: {
                _id: "$isSuccess",
                count: { $sum: 1 },
                totalAmount: { $sum: "$amount" },
                totalChargeAmount: { $sum: "$chargeAmount" },
                totalFinalAmount: { $sum: "$finalAmount" }
            }
        });

        const result = await PayOutReport.aggregate(pipeline);

        const stats = {
            totalPayouts: 0,
            totalAmount: 0,
            totalChargeAmount: 0,
            totalFinalAmount: 0,
            breakdown: {}
        };

        result.forEach(stat => {
            stats.breakdown[stat._id] = {
                count: stat.count,
                totalAmount: stat.totalAmount,
                totalChargeAmount: stat.totalChargeAmount,
                totalFinalAmount: stat.totalFinalAmount
            };
            stats.totalPayouts += stat.count;
            stats.totalAmount += stat.totalAmount;
            stats.totalChargeAmount += stat.totalChargeAmount;
            stats.totalFinalAmount += stat.totalFinalAmount;
        });

        return res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error("[ERROR] Failed to fetch payout stats:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching payout stats."
        });
    }
};

export const getEwalletTransactions = async (req, res) => {
    try {
        const { query } = req;
        const {
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            order = -1,
            exportCsv = false,
            userId,
            fromDate,
            toDate,
            type,
            status,
            minAmount,
            maxAmount,
            search = "",
        } = query;

        const pipeline = [];

        // Step 1: Match Filters
        const matchStage = {};
        if (req?.user?.role === "Admin") {
            if (userId) matchStage.userId = new mongoose.Types.ObjectId(userId);
        } else {
            matchStage.userId = new mongoose.Types.ObjectId(req.user?._id);
        }
        if (type) matchStage.type = type;
        if (status) matchStage.status = status;

        if (fromDate && toDate) {
            matchStage.createdAt = {
                $gte: new Date(fromDate),
                $lte: new Date(toDate)
            };
        }

        if (minAmount || maxAmount) {
            matchStage.amount = {};
            if (minAmount) matchStage.amount.$gte = parseFloat(minAmount);
            if (maxAmount) matchStage.amount.$lte = parseFloat(maxAmount);
        }

        if (search.trim()) {
            matchStage.description = { $regex: search.trim(), $options: "i" };
        }

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // Step 2: Lookup to get User details
        pipeline.push({
            $lookup: {
                from: "users", // MongoDB collection name of User model
                localField: "userId",
                foreignField: "_id",
                as: "user"
            }
        });

        // Step 3: Unwind the user array
        pipeline.push({
            $unwind: "$user"
        });

        // Step 4: Project only necessary fields including username
        pipeline.push({
            $project: {
                _id: 0,
                userId: 1,
                userName: "$user.userName", // Include username
                amount: 1,
                charges: 1,
                type: 1,
                description: 1,
                beforeAmount: 1,
                afterAmount: 1,
                status: 1,
                createdAt: 1,
                updatedAt: 1
            }
        });

        // Step 5: CSV Export
        if (exportCsv === "true") {
            const csvData = await EwalletTransaction.aggregate(pipeline);

            const formattedData = csvData.map(record => ({
                userName: record.userName,
                amount: record.amount,
                charges: record.charges,
                totalAmount: record.charges + record.amount,
                type: record.type,
                description: record.description.replace(/,/g, '') || '', // Remove commas to avoid CSV break
                beforeAmount: record.beforeAmount,
                afterAmount: record.afterAmount,
                status: record.status,
                createdAt: moment(record.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                updatedAt: moment(record.updatedAt).format("YYYY-MM-DD HH:mm:ss")
            }));

            const csv = await json2csv.json2csv(formattedData);

            res.header("Content-Type", "text/csv");
            res.header("Content-Disposition", "attachment; filename=ewallet_transactions.csv");
            return res.send(csv);
        }

        // Step 6: Sort & Paginate
        pipeline.push(
            { $sort: { [sortBy]: parseInt(order) } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        );

        const results = await EwalletTransaction.aggregate(pipeline);

        // Step 7: Count total documents
        const countPipeline = [...pipeline].filter(stage =>
            !["$skip", "$limit", "$sort"].includes(Object.keys(stage)[0])
        );
        countPipeline.push({ $count: "total" });

        const countResult = await EwalletTransaction.aggregate(countPipeline);
        const total = countResult.length ? countResult[0].total : 0;

        return res.json({
            success: true,
            data: results,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error("[ERROR] Failed to fetch eWallet transactions:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching eWallet transactions."
        });
    }
};

export const getEwalletStats = async (req, res) => {
    try {
        const { query } = req;
        const { fromDate, toDate } = query;

        const pipeline = [];

        // Match date range
        if (fromDate && toDate) {
            pipeline.push({
                $match: {
                    createdAt: {
                        $gte: new Date(fromDate),
                        $lte: new Date(toDate)
                    }
                }
            });
        }

        // Group by type and calculate totals
        pipeline.push({
            $group: {
                _id: "$type",
                count: { $sum: 1 },
                totalAmount: { $sum: "$amount" },
                totalCharges: { $sum: "$charges" },
                totalAfterAmount: { $sum: "$afterAmount" }
            }
        });

        const result = await EwalletTransaction.aggregate(pipeline);

        const stats = {
            totalTransactions: 0,
            totalCredit: 0,
            totalDebit: 0,
            totalCharges: 0,
            netBalance: 0,
            breakdown: {}
        };

        result.forEach(stat => {
            stats.breakdown[stat._id] = {
                count: stat.count,
                totalAmount: stat.totalAmount,
                totalCharges: stat.totalCharges,
                totalAfterAmount: stat.totalAfterAmount
            };
            stats.totalTransactions += stat.count;
            if (stat._id === "credit") {
                stats.totalCredit += stat.totalAfterAmount;
            } else if (stat._id === "debit") {
                stats.totalDebit += stat.totalAfterAmount;
            }
            stats.totalCharges += stat.totalCharges;
        });

        stats.netBalance = stats.totalCredit - stats.totalDebit;

        return res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error("[ERROR] Failed to fetch eWallet stats:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching eWallet stats."
        });
    }
};

export const getMainWalletTransactions = async (req, res) => {
    try {
        const { query } = req;
        const {
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            order = -1,
            exportCsv = false,
            userId,
            fromDate,
            toDate,
            type,
            status = 'success',
            minAmount,
            maxAmount,
            search = "",
        } = query;

        const pipeline = [];

        // Step 1: Match Filters
        const matchStage = {};

        if (req?.user?.role === "Admin") {
            if (userId) matchStage.userId = new mongoose.Types.ObjectId(userId);
        } else {
            matchStage.userId = new mongoose.Types.ObjectId(req.user?._id);
        }

        if (type) matchStage.type = type;
        if (status) matchStage.status = status;

        if (fromDate && toDate) {
            matchStage.createdAt = {
                $gte: new Date(fromDate),
                $lte: new Date(toDate)
            };
        }

        if (minAmount || maxAmount) {
            matchStage.amount = {};
            if (minAmount) matchStage.amount.$gte = parseFloat(minAmount);
            if (maxAmount) matchStage.amount.$lte = parseFloat(maxAmount);
        }

        if (search.trim()) {
            matchStage.description = { $regex: search.trim(), $options: "i" };
        }

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // Step 2: Lookup to get User details
        pipeline.push({
            $lookup: {
                from: "users", // Collection name of User model
                localField: "userId",
                foreignField: "_id",
                as: "user"
            }
        });

        // Unwind to flatten the user array
        pipeline.push({
            $unwind: "$user"
        });

        // Step 3: Project only necessary fields including username
        pipeline.push({
            $project: {
                _id: 0,
                userId: 1,
                userName: "$user.userName", // Include username
                amount: 1,
                charges: 1,
                totalAmount: 1,
                type: 1,
                description: 1,
                beforeAmount: 1,
                afterAmount: 1,
                status: 1,
                createdAt: 1,
                updatedAt: 1
            }
        });

        // Step 4: CSV Export
        if (exportCsv === "true") {
            const csvData = await MainWalletTransaction.aggregate(pipeline);

            const formattedData = csvData.map(record => ({
                userName: record.userName,
                amount: record.amount,
                charges: record.charges,
                totalAmount: record.totalAmount,
                type: record.type,
                description: record.description.replace(/,/g, '') || '', // Remove commas to avoid CSV break
                beforeAmount: record.beforeAmount,
                afterAmount: record.afterAmount,
                status: record.status,
                createdAt: moment(record.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                updatedAt: moment(record.updatedAt).format("YYYY-MM-DD HH:mm:ss")
            }));

            const csv = await json2csv.json2csv(formattedData);

            res.header("Content-Type", "text/csv");
            res.header("Content-Disposition", "attachment; filename=main_wallet_transactions.csv");
            return res.send(csv);
        }

        // Step 5: Sort & Paginate
        pipeline.push(
            { $sort: { [sortBy]: parseInt(order) } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        );

        const results = await MainWalletTransaction.aggregate(pipeline);

        // Step 6: Count total documents
        const countPipeline = [...pipeline].filter(stage =>
            !["$skip", "$limit", "$sort"].includes(Object.keys(stage)[0])
        );
        countPipeline.push({ $count: "total" });

        const countResult = await MainWalletTransaction.aggregate(countPipeline);
        const total = countResult.length ? countResult[0].total : 0;

        return res.json({
            success: true,
            data: results,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error("[ERROR] Failed to fetch main wallet transactions:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching main wallet transactions."
        });
    }
};

export const getMainWalletStats = async (req, res) => {
    try {
        const { query } = req;
        const { fromDate, toDate } = query;

        const pipeline = [];

        // Match date range
        if (fromDate && toDate) {
            pipeline.push({
                $match: {
                    createdAt: {
                        $gte: new Date(fromDate),
                        $lte: new Date(toDate)
                    }
                }
            });
        }

        // Group by type and calculate totals
        pipeline.push({
            $group: {
                _id: "$type",
                count: { $sum: 1 },
                totalAmount: { $sum: "$amount" },
                totalCharges: { $sum: "$charges" },
                totalAfterAmount: { $sum: "$afterAmount" }
            }
        });

        const result = await MainWalletTransaction.aggregate(pipeline);

        const stats = {
            totalTransactions: 0,
            totalCredit: 0,
            totalDebit: 0,
            totalCharges: 0,
            netBalance: 0,
            breakdown: {}
        };

        result.forEach(stat => {
            stats.breakdown[stat._id] = {
                count: stat.count,
                totalAmount: stat.totalAmount,
                totalCharges: stat.totalCharges,
                totalAfterAmount: stat.totalAfterAmount
            };
            stats.totalTransactions += stat.count;
            if (stat._id === "credit") {
                stats.totalCredit += stat.totalAfterAmount;
            } else if (stat._id === "debit") {
                stats.totalDebit += stat.totalAfterAmount;
            }
            stats.totalCharges += stat.totalCharges;
        });

        stats.netBalance = stats.totalCredit - stats.totalDebit;

        return res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error("[ERROR] Failed to fetch main wallet stats:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching main wallet stats."
        });
    }
};

async function createSampleTransactions(userId) {
    try {
        // Ensure userId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('Invalid userId');
        }

        const transactions = [];

        let currentBalance = Math.floor(Math.random() * 5000); // Random starting balance

        for (let i = 0; i < 50; i++) {
            // Random amount between 10 and 500
            const amount = Math.floor(Math.random() * 491) + 10;
            const charges = Math.random() < 0.3 ? Math.floor(Math.random() * 10) : 0; // Sometimes there are charges

            // Randomly choose credit or debit
            const type = 'debit';

            const beforeAmount = currentBalance;

            let totalAmount, afterAmount;

            if (type === 'credit') {
                totalAmount = amount + charges;
                afterAmount = beforeAmount + amount;
            } else {
                totalAmount = amount;
                afterAmount = beforeAmount - amount;
            }

            transactions.push({
                userId,
                amount,
                charges,
                totalAmount,
                type,
                description: `${type === 'credit' ? 'Added funds' : 'Deducted funds'} - Txn #${i + 1}`,
                beforeAmount,
                afterAmount,
                status: 'success',
            });

            // Update current balance for next transaction
            currentBalance = afterAmount;
        }

        // Insert all transactions
        await MainWalletTransaction.insertMany(transactions);

        console.log(`✅ Successfully inserted 50 transactions for userId: ${userId}`);
    } catch (error) {
        console.error('❌ Error creating transactions:', error.message);
    }
}

// seedPayoutReports('6836f0bb59332eedd863c35a')

async function seedPayoutReports(userId) {
    try {
        // Validate userId
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('Valid userId is required');
        }

        const payouts = [];

        // Sample static data
        const statusOptions = ['Pending', 'Failed', 'Success'];
        const accountHolders = [
            'John Doe', 'Jane Smith', 'Alice Johnson', 'Bob Williams',
            'Charlie Brown', 'Emily Davis', 'Michael Wilson', 'Sarah Miller'
        ];
        const banks = ['SBI', 'HDFC', 'ICICI', 'Axis Bank', 'Kotak Mahindra', 'PNB'];
        const failureReasons = [
            'Insufficient balance', 'Invalid account details', 'Bank server error',
            'Transaction timed out', 'User cancelled transaction'
        ];

        for (let i = 0; i < 50; i++) {
            const amount = Number((Math.random() * 4900 + 100).toFixed(2)); // Between 100 and 5000
            const gatewayCharge = Number((amount * 0.01).toFixed(2)); // 1% charge
            const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];

            const baseTrxId = `TXN${String(i + 1000).slice(-4)}`;
            const trxId = `${baseTrxId}${Math.floor(Math.random() * 10000)}`;

            payouts.push({
                user_id: new mongoose.Types.ObjectId(userId),
                mobileNumber: `98${Math.floor(10000000 + Math.random() * 90000000)}`, // 10-digit number
                accountHolderName: accountHolders[Math.floor(Math.random() * accountHolders.length)],
                accountNumber: `100000${Math.floor(100000 + Math.random() * 900000)}`,
                utr: status === 'Success' ? `UTR${Math.floor(10000000 + Math.random() * 90000000)}` : undefined,
                ifscCode: `HDFC000${Math.floor(1000 + Math.random() * 9000)}`,
                bankName: banks[Math.floor(Math.random() * banks.length)],
                upiId: status === 'Success' ? `user${Math.floor(Math.random() * 1000)}@upi` : undefined,
                amount,
                gatewayCharge,
                trxId,
                gateWayId: `GW${Math.floor(Math.random() * 100)}`,
                status,
                failureReason: status === 'Failed' ? failureReasons[Math.floor(Math.random() * failureReasons.length)] : undefined
            });
        }

        await PayoutReport.insertMany(payouts);
        console.log(`✅ Successfully inserted 50 payout reports for user ID: ${userId}`);
    } catch (error) {
        console.error(`❌ Error seeding payout reports: ${error.message}`);
    }
}