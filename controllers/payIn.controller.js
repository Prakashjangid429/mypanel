import PayinGenerationRecord from "../models/payinRequests.model.js";
import axios from "axios";
import User from "../models/user.model.js";
import payinModel from "../models/payin.model.js";
import { Mutex } from 'async-mutex';
import EwalletTransaction from "../models/ewallet.model.js";
import userMetaModel from "../models/userMeta.model.js";
import mongoose from "mongoose";

export const generatePayment = async (req, res, next) => {
    try {
        const { txnId, amount, name, email, mobileNumber } = req.body;
        const user = req.user;

        const { payInCharges } = user.package;

        switch (user?.payInApi?.name) {
            case "TestPay":
                const paymentRecord = await PayinGenerationRecord.create({
                    user_id: user._id,
                    gateWayId: user.payInApi?.name,
                    txnId,
                    amount,
                    chargeAmount: payInCharges.limit < amount ? payInCharges.higher.chargeType == 'percentage' ? payInCharges.higher.chargeValue * amount / 100 : payInCharges.higher.chargeValue : payInCharges.lowerOrEqual.chargeType == 'percentage' ? payInCharges.lowerOrEqual.chargeValue * amount / 100 : payInCharges.lowerOrEqual.chargeValue,
                    name,
                    email,
                    mobileNumber
                });
                try {
                    let bank = await axios.post(user?.payInApi?.baseUrl, { txnId, amount, name, email, mobileNumber })

                    if (bank?.data?.status_code != 200) {
                        paymentRecord.status = "Failed";
                        paymentRecord.failureReason = bank?.data?.status_msg || "Payment gateway error";
                        await paymentRecord.save();
                        return res.status(400).json({ status: "Failed", status_code: 400, message: 'Banking Server Down' })
                    } else {
                        paymentRecord.qrData = bank?.data?.qr_image;
                        paymentRecord.qrIntent = bank?.data?.Intent;
                        paymentRecord.refId = bank?.data?.refId;
                        await paymentRecord.save();
                        return res.status(200).json({
                            status: "Success",
                            status_code: 200,
                            message: "intent generate successfully",
                            qr_intent: bank?.data?.Intent,
                            qr_image: bank?.data?.qr_image,
                            transaction_id: txnId
                        })
                    }
                } catch (error) {
                    if (error.code == 11000) {
                        return res.status(500).json({ status: "Failed", status_code: 500, message: "trx Id duplicate Find !" })
                    } else {
                        return res.status(500).json({ status: "Failed", status_code: 500, message: error.message || "Internel Server Error !" })
                    }
                }
                break;
            case "ServerMaintenance":
                let serverResp = {
                    status: "Failed",
                    status_code: 400,
                    message: "server under maintenance !"
                }
                return res.status(400).json(serverResp)
            default:
                return res.status(400).json({
                    status: "Failed",
                    status_code: 400,
                    message: "service is not active please contact to service provider"
                });
        }
    } catch (error) {
        console.log(error);
        return next(error);
    }
};

export const checkPaymentStatus = async (req, res, next) => {
    try {
        const { txnId } = req.params;

        if (!txnId) {
            return res.status(400).json({
                status: 'Failed',
                status_code: 400,
                message: "Transaction ID are required"
            });
        }

        const result = await PayinGenerationRecord.aggregate([
            {
                $match: {
                    txnId: txnId
                }
            },
            {
                $project: {
                    _id: 0,
                    status: 1,
                    amount: 1,
                    chargeAmount: 1,
                    totalAmount: { $add: ["$amount", "$chargeAmount"] },
                    txnId: 1,
                    utr: 1,
                    qrData: 1,
                    qrIntent: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    userDetails: {
                        name: "$name",
                        email: "$email",
                        mobile: "$mobileNumber"
                    }
                }
            },
            {
                $limit: 1
            }
        ]);
        if (result.length === 0) {
            return res.status(404).json({
                status: 'Failed',
                status_code: 404,
                message: "Transaction not found"
            });
        }
        const response = {
            status: 'Failed',
            status_code: 404,
            message: "Transaction Detail fetch successfully",
            data: result[0]
        };
        return res.status(200).json(response);

    } catch (error) {
        return next(error)
    }
};

const userLocks = new Map();

function getUserMutex(userId) {
    if (!userLocks.has(userId)) {
        userLocks.set(userId, new Mutex());
    }
    return userLocks.get(userId);
}

export const payinCallback = async (req, res, next) => {
    try {
        const { txnId, utr, status, refId, message } = req.body;

        const paymentRecord = await PayinGenerationRecord.findOneAndUpdate(
            { txnId, status: 'Pending' },
            {
                $set: {
                    status: status === 'success' ? 'Success' : 'Failed',
                    ...(status === 'success' && { utr, refId }),
                    ...(status === 'failed' && { failureReason: message || 'Payment failed' }),
                },
            },
            { new: true }
        );

        if (!paymentRecord) {
            return res.status(404).json({
                status: 'Failed',
                status_code: 404,
                message: 'Transaction not found or already processed',
            });
        }

        const userId = paymentRecord.user_id.toString();
        const userMutex = getUserMutex(userId);

        await userMutex.runExclusive(async () => {
            const session = await mongoose.startSession();
            try {
                await session.withTransaction(async () => {
                    const netAmount = paymentRecord.amount - paymentRecord.chargeAmount;

                    const [user, userMeta] = await Promise.all([
                        User.findOneAndUpdate(
                            { _id: paymentRecord.user_id },
                            { $inc: { eWalletBalance: netAmount } },
                            { new: true, session }
                        ),
                        userMetaModel.findOne({ userId: paymentRecord.user_id }).session(session)
                    ]);

                    if (status === 'success') {
                        const payinSuccess = {
                            user_id: paymentRecord.user_id,
                            txnId: paymentRecord.txnId,
                            utr: paymentRecord.utr,
                            referenceID: paymentRecord.refId,
                            amount: paymentRecord.amount,
                            chargeAmount: paymentRecord.chargeAmount,
                            vpaId: 'abc@upi',
                            payerName: paymentRecord.name,
                            status: 'Success',
                            description: `PayIn successful for txnId ${paymentRecord.txnId}`,
                        };

                        const walletTransaction = {
                            userId: paymentRecord.user_id,
                            amount: paymentRecord.amount,
                            charges: paymentRecord.chargeAmount,
                            type: 'credit',
                            afterAmount: user.eWalletBalance,
                            description: `PayIn successful for txnId ${paymentRecord.txnId}`,
                            status: 'success',
                        };

                        await Promise.all([
                            payinModel.create([payinSuccess], { session }),
                            EwalletTransaction.create([walletTransaction], { session })
                        ]);

                        axios.post("http://localhost:3000/user-callback", {
                            event: 'payin_success',
                            txnId: paymentRecord.txnId,
                            status: 'Success',
                            status_code: 200,
                            amount: paymentRecord.amount,
                            gatwayCharge: paymentRecord.chargeAmount,
                            utr: paymentRecord.utr,
                            vpaId: 'abc@upi',
                            txnCompleteDate: new Date(),
                            txnStartDate: paymentRecord.createdAt,
                            message: 'Payment Received successfully',
                        });

                    } else if (status === 'failed') {
                        axios.post("http://localhost:3000/user-callback", {
                            event: 'payin_failed',
                            txnId: paymentRecord.txnId,
                            status: 'Failed',
                            status_code: 200,
                            amount: paymentRecord.amount,
                            utr: null,
                            vpaId: null,
                            txnStartDate: paymentRecord.createdAt,
                            message: 'Payment failed',
                        });
                        console.log("Payment failed for txnId:", txnId);
                    }
                })
            } finally {
                session.endSession();
            }
        });

        return res.status(200).json({
            status: 'Success',
            status_code: 200,
            message: 'Payment status updated successfully',
        });
    } catch (error) {
        return next(error);
    }
};



