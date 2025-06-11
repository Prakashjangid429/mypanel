import PayInReport from "../models/payin.model.js";
import PayinGenerationRecord from "../models/payinRequests.model.js";
import PayoutReport from "../models/payout.model.js";
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

        const matchStage = {};

        if (status) matchStage.status = status;
        if (user_id) matchStage.user_id = new mongoose.Types.ObjectId(user_id);
        if (fromDate && toDate) {
            matchStage.createdAt = {
                $gte: new Date(fromDate),
                $lte: new Date(toDate)
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
            $project: {
                _id: 0,
                user_id: 1,
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
            const csvData = await PayinGenerationRecord.aggregate(pipeline);

            const formattedData = csvData.map(record => ({
                ...record,
                createdAt: moment(record.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                requestedAt: moment(record.requestedAt).format("YYYY-MM-DD HH:mm:ss"),
                updatedAt: moment(record.updatedAt).format("YYYY-MM-DD HH:mm:ss")
            }));

            const csv = await json2csv.json2csvAsync(formattedData);

            res.header("Content-Type", "text/csv");
            res.header("Content-Disposition", "attachment; filename=payin_records.csv");
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

        if (user_id) matchStage.user_id = mongoose.Types.ObjectId(user_id);
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

            const csv = await json2csv.json2csvAsync(formattedData);

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

        if (user_id) matchStage.user_id = mongoose.Types.ObjectId(user_id);
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

        // Step 3: Project only necessary fields
        pipeline.push({
            $project: {
                _id: 0,
                user_id: 1,
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
                ipAddress: 1,
                failureReason: 1,
                createdAt: 1,
                updatedAt: 1
            }
        });

        // Step 4: CSV Export
        if (exportCsv === "true") {
            const csvData = await PayoutReport.aggregate(pipeline);

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

        const results = await PayoutReport.aggregate(pipeline);

        // Step 6: Count total documents
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

        if (user_id) matchStage.user_id = mongoose.Types.ObjectId(user_id);
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

        if (userId) matchStage.userId = mongoose.Types.ObjectId(userId);
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

        // Step 2: Project only necessary fields
        pipeline.push({
            $project: {
                _id: 0,
                userId: 1,
                amount: 1,
                charges: 1,
                totalAmount: 1,
                type: 1,
                description: 1,
                afterAmount: 1,
                status: 1,
                createdAt: 1,
                updatedAt: 1
            }
        });

        // Step 3: CSV Export
        if (exportCsv === "true") {
            const csvData = await EwalletTransaction.aggregate(pipeline);

            const formattedData = csvData.map(record => ({
                ...record,
                createdAt: moment(record.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                updatedAt: moment(record.updatedAt).format("YYYY-MM-DD HH:mm:ss")
            }));

            const csv = await json2csv.json2csvAsync(formattedData);

            res.header("Content-Type", "text/csv");
            res.header("Content-Disposition", "attachment; filename=ewallet_transactions.csv");
            return res.send(csv);
        }

        // Step 4: Sort & Paginate
        pipeline.push(
            { $sort: { [sortBy]: parseInt(order) } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        );

        const results = await EwalletTransaction.aggregate(pipeline);

        // Step 5: Count total documents
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
            status,
            minAmount,
            maxAmount,
            search = "",
        } = query;

        const pipeline = [];

        // Step 1: Match Filters
        const matchStage = {};

        if (userId) matchStage.userId = mongoose.Types.ObjectId(userId);
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

        // Step 2: Project only necessary fields
        pipeline.push({
            $project: {
                _id: 0,
                userId: 1,
                amount: 1,
                charges: 1,
                totalAmount: 1,
                type: 1,
                description: 1,
                afterAmount: 1,
                status: 1,
                createdAt: 1,
                updatedAt: 1
            }
        });

        // Step 3: CSV Export
        if (exportCsv === "true") {
            const csvData = await MainWalletTransaction.aggregate(pipeline);

            const formattedData = csvData.map(record => ({
                ...record,
                createdAt: moment(record.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                updatedAt: moment(record.updatedAt).format("YYYY-MM-DD HH:mm:ss")
            }));

            const csv = await json2csv.json2csvAsync(formattedData);

            res.header("Content-Type", "text/csv");
            res.header("Content-Disposition", "attachment; filename=main_wallet_transactions.csv");
            return res.send(csv);
        }

        // Step 4: Sort & Paginate
        pipeline.push(
            { $sort: { [sortBy]: parseInt(order) } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        );

        const results = await MainWalletTransaction.aggregate(pipeline);

        // Step 5: Count total documents
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