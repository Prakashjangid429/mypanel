import mongoose from "mongoose";
import userDB from "../models/User.js";
import walletModel from "../models/EwalletTransaction.js";
import payOutModel from "../models/PayOutModel.js";
import payOutModelGenerate from "../models/PayOutModelGenerate.js";
import AESUtils from "../utils/AESUtils.js";
import moment from "moment";

// Your existing asyncHandler wrapper or use try-catch
export const generatePayOut = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    const {
        userName,
        authToken,
        mobileNumber,
        accountHolderName,
        accountNumber,
        ifscCode,
        trxId,
        amount,
        bankName
    } = req.body;

    try {
        if (amount < 1) {
            throw new Error(`Amount must be at least 1. Received: ${amount}`);
        }

        // Step 1: Find user with aggregation pipeline
        const [user] = await userDB.aggregate([
            {
                $match: {
                    userName,
                    trxAuthToken: authToken,
                    isActive: true
                }
            },
            { $lookup: { from: "payoutswitches", localField: "payOutApi", foreignField: "_id", as: "payOutApi" } },
            { $unwind: "$payOutApi" },
            { $lookup: { from: "packages", localField: "package", foreignField: "_id", as: "package" } },
            { $unwind: "$package" },
            { $lookup: { from: "payoutpackages", localField: "package.packagePayOutCharge", foreignField: "_id", as: "packageCharge" } },
            { $unwind: "$packageCharge" },
            {
                $project: {
                    _id: 1,
                    userName: 1,
                    memberId: 1,
                    EwalletBalance: 1,
                    minWalletBalance: 1,
                    payOutApi: 1,
                    packageCharge: 1
                }
            }
        ]);

        if (!user) {
            throw new Error("Invalid Credentials or User Inactive!");
        }

        const { payOutApi, packageCharge, EwalletBalance, minWalletBalance } = user;

        if (payOutApi.apiName === "ServerMaintenance") {
            throw new Error("Server Under Maintenance!");
        }

        // Step 2: Calculate charge
        const chargeDetails = packageCharge.payOutChargeRange.find(
            value => value.lowerLimit <= amount && value.upperLimit > amount
        );

        if (!chargeDetails) {
            throw new Error("Invalid package!");
        }

        const chargeAmount = chargeDetails.chargeType === "Flat"
            ? chargeDetails.charge
            : (chargeDetails.charge / 100) * amount;

        const finalAmountDeduct = amount + chargeAmount;
        const usableBalance = EwalletBalance - minWalletBalance;

        if (finalAmountDeduct > usableBalance) {
            throw new Error(`Insufficient funds. Usable balance: ${usableBalance}`);
        }

        // Step 3: Create payout generation record
        const payOutModelGen = await payOutModelGenerate.create([{
            memberId: user._id,
            mobileNumber,
            accountHolderName,
            accountNumber,
            ifscCode,
            amount,
            gatwayCharge: chargeAmount,
            afterChargeAmount: finalAmountDeduct,
            trxId,
            pannelUse: payOutApi?.apiName
        }], { session });

        // Step 4: Deduct wallet balance
        const updatedUser = await userDB.findByIdAndUpdate(
            user._id,
            {
                $inc: { EwalletBalance: -finalAmountDeduct }
            },
            {
                new: true,
                session
            }
        );

        if (!updatedUser) {
            throw new Error("Failed to update wallet balance.");
        }

        // Step 5: Log e-wallet transaction
        await walletModel.create([{
            memberId: user._id,
            transactionType: "Dr.",
            transactionAmount: amount,
            beforeAmount: updatedUser.EwalletBalance + finalAmountDeduct,
            chargeAmount,
            afterAmount: updatedUser.EwalletBalance,
            description: `Successfully Dr. amount: ${finalAmountDeduct} with transaction Id: ${trxId}`,
            transactionStatus: "Success",
        }], { session });

        // Step 6: Commit transaction
        await session.commitTransaction();

        // Step 7: Call Payout API
        const apiResponse = await performPayoutApiCall(payOutApi, {
            accountHolderName,
            accountNumber,
            ifscCode,
            mobileNumber,
            amount,
            bankName,
            trxId,
            session
        }, user, chargeAmount, finalAmountDeduct);

        if (!apiResponse || apiResponse.status !== "Success") {
            // If API fails, rollback manually
            return handlePayoutFailure(user, chargeAmount, finalAmountDeduct, trxId, payOutModelGen[0], res);
        }

        // Step 8: On success, save payout model
        await payOutModel.create([{
            memberId: user._id,
            amount,
            chargeAmount,
            finalAmount: finalAmountDeduct,
            bankRRN: apiResponse.rrn || null,
            trxId,
            optxId: apiResponse.orderId || null,
            isSuccess: "Success"
        }]);

        // Send success response
        return res.json({
            success: true,
            data: {
                status: "Success",
                trxId,
                message: "Payout successful"
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("[ERROR] Payout failed:", error.message);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    } finally {
        session.endSession();
    }
};

const performPayoutApiCall = async (payOutApi, payload, user, chargeAmount, finalAmountDeduct) => {
    // Simulate calling different APIs based on `payOutApi.apiName`
    switch (payOutApi.apiName) {
        case "iServerEuApi":
            return callIServerEuApi(payload);
        case "ImpactPeekSoftwareApi":
            return callImpactPeekSoftwareApi(payload);
        case "waayupayPayOutApi":
            return callWaayupayPayOutApi(payload);
        case "iSmartPayPayoutApi":
            return callISmartPayPayoutApi(payload);
        case "flipzikPayoutApi":
            return callFlipzikPayoutApi(payload);
        case "proConceptPayoutApi":
            return callProConceptPayoutApi(payload);
        default:
            throw new Error("Unsupported payout API");
    }
};

const handlePayoutFailure = async (user, chargeAmount, finalAmountDeduct, trxId, payOutModelGen, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Refund wallet
        const updatedUser = await userDB.findByIdAndUpdate(
            user._id,
            { $inc: { EwalletBalance: finalAmountDeduct } },
            { new: true, session }
        );

        // Log refund transaction
        await walletModel.create([{
            memberId: user._id,
            transactionType: "Cr.",
            transactionAmount: chargeAmount,
            beforeAmount: updatedUser.EwalletBalance - finalAmountDeduct,
            chargeAmount,
            afterAmount: updatedUser.EwalletBalance,
            description: `Refunded amount: ${finalAmountDeduct} due to failed payout.`,
            transactionStatus: "Success"
        }], { session });

        // Update payout generation record
        payOutModelGen.isSuccess = "Failed";
        await payOutModelGen.save({ session });

        await session.commitTransaction();

        return res.status(400).json({
            success: false,
            data: {
                status: "Failed",
                trxId,
                message: "Payout failed. Balance has been refunded."
            }
        });

    } catch (err) {
        await session.abortTransaction();
        console.error("Error during payout failure handling:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to handle payout failure."
        });
    } finally {
        session.endSession();
    }
};