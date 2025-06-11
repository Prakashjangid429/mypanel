import PayinGenerationRecord from "../models/payinRequests.model.js";
import axios from "axios";
import User from "../models/user.model.js";
import payinModel from "../models/payin.model.js";
import { Mutex } from 'async-mutex';
import EwalletTransaction from "../models/ewallet.model.js";

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
        next(error)
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
            if (status === 'success') {
                const netAmount = paymentRecord.amount - paymentRecord.chargeAmount;

                const user = await User.findOneAndUpdate(
                    { _id: paymentRecord.user_id },
                    { $inc: { eWalletBalance: netAmount } },
                    { new: true }
                );

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
                console.log(user.eWalletBalance)
                const walletTransaction = {
                    userId: paymentRecord.user_id,
                    amount:  paymentRecord.amount,
                    charges: paymentRecord.chargeAmount,
                    type: 'credit',
                    afterAmount: user.eWalletBalance,
                    description: `PayIn successful for txnId ${paymentRecord.txnId}`,
                    status: 'success',
                };

                await Promise.all([
                    payinModel.create(payinSuccess),
                    EwalletTransaction.create(walletTransaction)
                ]);
            }
        });

        return res.status(200).json({
            status: 'Success',
            status_code: 200,
            message: 'Payment status updated successfully',
        });
    } catch (error) {
        next(error);
    }
};


import Redis from 'ioredis';
import Redlock from 'redlock';
import mongoose from "mongoose";

// Redis connection
const redis = new Redis({
  host: '127.0.0.1', // Update if needed
  port: 6379,
});

const redlock = new Redlock([redis], {
  retryCount: 2,
  retryDelay: 1000,
  retryJitter: 500,
});

export const payinCallbackwithRedis = async (req, res, next) => {
  const session = await mongoose.startSession();
  const { txnId, utr, status, refId, message } = req.body;

  try {
    const paymentRecord = await PayinGenerationRecord.findOne({ txnId });

    if (!paymentRecord || paymentRecord.status !== 'Pending') {
      return res.status(404).json({
        status: 'Failed',
        status_code: 404,
        message: 'Transaction not found or already processed',
      });
    }

    const userId = paymentRecord.user_id.toString();
    const lockKey = `locks:user:${userId}`;

    // Redlock usage
    await redlock.using([lockKey], 8000, async () => {
      session.startTransaction();

      try {
        if (status === 'success') {
          const netAmount = paymentRecord.amount - paymentRecord.chargeAmount;

          // Update wallet
          const updatedUser = await User.findOneAndUpdate(
            { _id: paymentRecord.user_id },
            { $inc: { eWalletBalance: netAmount } },
            { new: true, session }
          );

          // Update Payin Record
          paymentRecord.status = 'Success';
          paymentRecord.utr = utr;
          paymentRecord.refId = refId;
          await paymentRecord.save({ session });

          // Create success logs
          const payinSuccess = {
            user_id: updatedUser._id,
            txnId: paymentRecord.txnId,
            utr: paymentRecord.utr,
            referenceID: paymentRecord.refId,
            amount: paymentRecord.amount,
            chargeAmount: paymentRecord.chargeAmount,
            vpaId: 'abc@upi', // Adjust if dynamic
            payerName: paymentRecord.name,
            status: 'Success',
            description: `PayIn successful for txnId ${paymentRecord.txnId}`,
          };

          const walletTransaction = {
            userId: updatedUser._id,
            amount: netAmount,
            charges: paymentRecord.chargeAmount,
            type: 'credit',
            afterAmount: updatedUser.eWalletBalance,
            description: `PayIn successful for txnId ${paymentRecord.txnId}`,
            status: 'success',
          };

          await Promise.all([
            payinModel.create([payinSuccess], { session }),
            EwalletTransaction.create([walletTransaction], { session }),
          ]);
        } else if (status === 'failed') {
          paymentRecord.status = 'Failed';
          paymentRecord.failureReason = message || 'Payment failed';
          await paymentRecord.save({ session });
        } else {
          await session.abortTransaction();
          return res.status(400).json({
            status: 'Failed',
            status_code: 400,
            message: 'Invalid status provided',
          });
        }

        await session.commitTransaction();
      } catch (innerErr) {
        await session.abortTransaction();
        throw innerErr;
      }
    });

    return res.status(200).json({
      status: 'Success',
      status_code: 200,
      message: 'Payment status updated successfully',
    });
  } catch (error) {
    await session.abortTransaction().catch(() => { });

    // Proper Redlock error handling
    if (error?.name === 'ExecutionError') {
      return res.status(423).json({
        status: 'Failed',
        status_code: 423,
        message: 'Resource is currently locked. Please retry shortly.',
      });
    }

    console.error('Callback error:', error);
    return next(error);
  } finally {
    session.endSession();
  }
};





