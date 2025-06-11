import { Schema, model } from "mongoose";

const settlementRequestSchema = new Schema(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "user",
            required: [true, "User ID is required."],
        },
        amount: {
            type: Number,
            required: [true, "Settlement amount is required."],
            min: [1, "Amount must be greater than zero."],
        },
        gatewayCharge: {
            type: Number,
            min: [0, "Gateway charge must be non-negative."],
        },
        finalAmount: {
            type: Number,
            required: [true, "Final amount after charges is required."],
        },
        settlementMode: {
            type: String,
            enum: ["BANK", "UPI", "Main Wallet","Cash"],
            required: true,
        },
        bankDetails: {
            accountHolderName: {
                type: String,
                required: true,
                trim: true,
            },
            accountNumber: {
                type: String,
                required: true,
                trim: true,
            },
            ifscCode: {
                type: String,
                required: true,
                trim: true,
            },
            bankName: {
                type: String,
                trim: true,
            },
            upiId: {
                type: String,
                trim: true,
            },
        },
        trxId: {
            type: String,
            required: [true, "Transaction ID is required."],
            unique: true,
            index: true,
            trim: true,
        },
        utr: {
            type: String,
            trim: true,
        },
        remarks: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: ["Requested", "Processing", "Settled", "Failed"],
            default: "Requested",
        },
        settledAt: {
            type: Date,
        }
    },
    { timestamps: true }
);

settlementRequestSchema.index({ trxId: 1 }, { unique: true });

export default model("SettlementRequest", settlementRequestSchema);
