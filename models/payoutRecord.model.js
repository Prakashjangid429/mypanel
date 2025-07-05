import { Schema, model } from "mongoose";

const payoutReportSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },
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
    utr: {
      type: String,
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
    amount: {
      type: Number,
      required: true,
      min: [1, "Amount must be greater than zero."],
    },
    gatewayCharge: {
      type: Number,
      required: true,
      min: [0, "Gateway charge must be non-negative."],
    },
    trxId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    gateWayId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Failed", "Success"],
      default: "Pending",
      required: true,
    },
    failureReason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// payoutReportSchema.index({ trxId: 1 }, { unique: true });
payoutReportSchema.index({ user_id: 1, createdAt: 1 });
payoutReportSchema.index({ status: 1, createdAt: 1 });

export default model("PayoutReport", payoutReportSchema);