import { Schema, model } from "mongoose";

const payOutReportSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    utr: {
      type: String,
      required: true,
      trim: true,
    },
    trxId: {
      type: String,
      trim: true,
      index: true,
      unique: true,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Amount must be non-negative"],
    },
    chargeAmount: {
      type: Number,
      required: true,
      min: [0, "Charge amount must be non-negative"],
    },
    finalAmount: {
      type: Number,
      required: true,
      min: [0, "Final amount must be non-negative"],
    },
    referenceID: {
      type: String,
      trim: true,
    },
    isSuccess: {
      type: String,
      enum: ["Pending", "Failed", "Success"],
      default: "Pending",
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes
// payOutReportSchema.index({ trxId: 1 }, { unique: true });
payOutReportSchema.index({ user_id: 1, createdAt: 1 });
payOutReportSchema.index({ isSuccess: 1, createdAt: 1 });

export default model("PayOutReport", payOutReportSchema);