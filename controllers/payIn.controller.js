import PayinGenerationRecord from "../models/payinRequests.model.js";
import axios from "axios";
import User from "../models/user.model.js";
import payinModel from "../models/payin.model.js";
import { Mutex } from 'async-mutex';
import EwalletTransaction from "../models/ewallet.model.js";
import userMetaModel from "../models/userMeta.model.js";
import mongoose from "mongoose";
import crypto from "crypto";
import qs from 'qs';

const PAYU_KEY = 'yCoqIU';
const PAYU_SALT = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCzUfM25c2bd55Lh010CPoG47YNBlvGeqxVnUNLiPJDx3k+0xwmtfsXv478ec+eR4AytqvaSEQvEIfeXb0mIT2ENY+ijdjjmWrr6L1XMhjPNQiYDRrm5btf5wNOsd+EOfHQyjZLNq9fmM3eDqDymsq8HWaKspmEeFckHLQr/sjocgpQ0RtS60kYTPwMioLNaZeoRiVvVpuFWLv7ih+Gvkny4/sVdYluXkjdk0QsU7fiHucf9pOlc4uDGK+SEFNBudwuUE6afWHjKEeB5/kz0dTddqT25IpVX1G3jr3WLjYFaFT/8KHygCZvl1DILtxlujsch+eNDAO5TlnI0q1p3uEVAgMBAAECggEAR2pRTyFJd+u1RsY9ggNbNCg3JkvMfCj5/mTR2sDRH05PisY/9WjPdd9L/mAy4AoA0/GtUpMqWIYgXl59yLQ/UCqWqDoO0WIV05tO4O2qNMedwxShDKkcrS6PQiWT65C6LhmCcwT15kAwaQnxbn1YVX/uCTnk6v2UUuT9mnHvqKarlC/Iv5uiRcRRl1i9+tHt692MenQ86d+P/rOaG7uCDIEgJrcQqxPtJeBXbNCumZgFQwvFndq57Xo9N9wS6Qulo3Z5/SWlF1RQrIoutYs5DOlspp8bHy8zORA7/7o5ivdrRPx3x3U+yM0i+1xB+CfwocnpsScTe2YJAonB5rjXhwKBgQDPKho4KIt7+780x1I0aq9oIllp6jRx6P4Vg2x5/bU61BpJ+xGBz8Tle4CXSGiwL4Tf///OLCdWBrrK5wl/bDF9SvpZ/TVG5UeT0S3p3uUxVZkQcveXi5R8mCHUXuRzSQAQUCQvpHVgXL1b+Y7ap3xcdBHxYZN3r3twQjkvgP9xPwKBgQDdl4FwIC9C61cPQuHfbeeYbeAOj75sgHq0dAKWaaDVfKao/4Ya0BczgtFfwHmWuoGEuUBwgjmIAWTxhVNpmFBiJzFlUdXaD7hIOQ2OFNfH2Cu3hT9GwPY0mTb8U90MY5qWURVAHyiQWntUGB7oUi4mM7e+49Gtl7Wwf/x3pvbEqwKBgCsVuIpBdHD+tI+HfMNGBOEFc88hVHL0YBOdV6wvZcesYSNNwiBbU7nea6oK9yrdVyc3GL6KVEwB7ktQrZsAp3JFa7fXf4MVIEPP11qybrxJ7yGKp4+vCdy3zyFZ8u0/G3JJGJ2H+Jln8EH2rw0ulCCuSyUGhCL6LhP00evdSkMFAoGBAIDcHPJ2VOWGc881JqLGh9pVcukk4Ci6oiCUIfkUHepoHYbDaVnoTsWuulEDXfGwLadgD0AeCpSzst7cmIAcigo6Hnh8GW9Amvqs6twH9N+LLwj+3KgpiENYIeikYDRXK8tkBYaPWAhyBawGhtq1B49BngXM998KDSdBljCCkJgXAoGAcoUmi95+7WSP2acvsu5GcxTGJrW9hvNykZZMrqUI2HVDzfZKzNxGtNomweTBRZU+YPkx/NUVmjYNEPYJZLY16SoKX+6QBKRl+qmuPOBoEa0JP3bODrL+nLw20zpTyCOdIvyM7u+mkFczIfKVsvyAHbPRNCRGMjfuiTj75rEooGU=";

function sha512(data) {
    return crypto.createHash("sha512").update(data, "utf8").digest("hex");
}

function makeInitiateHash({ key, txnid, amount, productinfo, firstname, email, salt }) {
    const hashStr = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}` +
        `|||||||||||${salt}`;
    return sha512(hashStr);
}

function getDeviceInfo(req) {
    const ip =
        req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "";
    const ua = req.headers["user-agent"] || "";
    return { s2s_client_ip: ip, s2s_device_info: ua };
}

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
            case "Payin001":
                const paymentRecor = await PayinGenerationRecord.create({
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

                    const hash = makeInitiateHash({
                        key: PAYU_KEY,
                        txnid: txnId,
                        amount: Number(amount).toFixed(2),
                        productinfo: "storefront",
                        firstname: name,
                        email,
                        salt: PAYU_SALT
                    });

                    const { s2s_client_ip, s2s_device_info } = getDeviceInfo(req);

                    const payload = {
                        key: PAYU_KEY,
                        txnid: txnId,
                        amount: Number(amount).toFixed(2),
                        productinfo: "storefront",
                        firstname: name,
                        email,
                        phone: mobileNumber,
                        pg: "UPI",
                        bankcode: "INTENT",
                        txn_s2s_flow: 4,
                        s2s_client_ip,
                        s2s_device_info,
                        upiAppName: 'genericintent', // enum above
                        hash,
                        surl: `https://mypanel-cmnj.onrender.com/api/v1/payment/callback`,
                        furl: `https://mypanel-cmnj.onrender.com/api/v1/payment/callback`,
                        curl: `https://mypanel-cmnj.onrender.com/api/v1/payment/callback`,
                    };

                    // IMPORTANT: PayU expects form-encoded request
                    const { data } = await axios.post(`https://test.payu.in/_payment`, qs.stringify(payload), {
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        timeout: 60000
                    });
                    if (data) {

                        return res.status(200).json({
                            data: data, payload
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

            case "Pipe001":
                const paymentRecords = await PayinGenerationRecord.create({
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
                    const payload = {
                        "key": "a8a4def1-4d92-4a0a-97ac-7a33c15ada65",
                        "client_txn_id": txnId,
                        "amount": `${amount}`,
                        "p_info": "dummy Product Name",
                        "customer_name": name,
                        "customer_email": email,
                        "customer_mobile": mobileNumber,
                        "redirect_url": "http://google.com"
                    }
                    let bank = await axios.post(user?.payInApi?.baseUrl, payload)
                    console.log(bank.data)
                    if (!bank?.data?.status) {
                        paymentRecords.status = "Failed";
                        paymentRecords.failureReason = bank?.data?.msg || "Payment gateway error";
                        await paymentRecords.save();
                        return res.status(400).json({ status: "Failed", status_code: 400, message: 'Banking Server Down' })
                    } else {
                        paymentRecords.qrData = "";
                        paymentRecords.qrIntent = bank?.data?.data?.upi_intent?.bhim_link;
                        paymentRecords.refId = bank?.data?.data?.order_id;
                        await paymentRecords.save();
                        return res.status(200).json({
                            status: "Success",
                            status_code: 200,
                            message: "intent generate successfully",
                            qr_intent: bank?.data?.data?.upi_intent?.bhim_link,
                            qr_image: "",
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
        console.log(error.message)
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

                    let userMeta = await userMetaModel.findOne({ userId: paymentRecord.user_id }).session(session);


                    if (status === 'success') {
                        const user = await User.findOneAndUpdate(
                            { _id: paymentRecord.user_id },
                            { $inc: { eWalletBalance: netAmount } },
                            { new: true, session }
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

                        const walletTransaction = {
                            userId: paymentRecord.user_id,
                            amount: paymentRecord.amount,
                            beforeAmount: user.eWalletBalance - netAmount,
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

export const upigateCallback = async (req, res, next) => {

    console.log(req.body)
    // {
    //   id: '124570188',
    //   customer_vpa: '',
    //   amount: '2',
    //   client_txn_id: 'tsx000001845',
    //   customer_name: 'rinku the bhai',
    //   customer_email: 'dummy@gamil.com',
    //   customer_mobile: '9887020429',
    //   p_info: 'dummy Product Name',
    //   upi_txn_id: '35435435',
    //   status: 'success',
    //   remark: 'Manual: cxcbcxb',
    //   udf1: '',
    //   udf2: '',
    //   udf3: '',
    //   redirect_url: 'http://google.com',
    //   ip: '182.68.124.229',
    //   txnAt: '2025-06-28',
    //   createdAt: '2025-06-28T07:23:33.000Z'
    // }
    return res.json({ msg: "success" })
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

import mongoMutex from '../utils/lockManager.js';

export const payinback = async (req, res, next) => {
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

        await mongoMutex.runExclusive(`user_${userId}`, async () => {
            const session = await mongoose.startSession();
            try {
                await session.withTransaction(async () => {
                    const netAmount = paymentRecord.amount - paymentRecord.chargeAmount;

                    let userMeta = await userMetaModel.findOne({ userId: paymentRecord.user_id }).session(session);

                    if (status === 'success') {
                        const user = await User.findOneAndUpdate(
                            { _id: paymentRecord.user_id },
                            { $inc: { eWalletBalance: netAmount } },
                            { new: true, session }
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

                        const walletTransaction = {
                            userId: paymentRecord.user_id,
                            amount: paymentRecord.amount,
                            beforeAmount: user.eWalletBalance - netAmount,
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
                });
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



