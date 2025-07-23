import { Schema, model } from "mongoose";

const settlementSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [1, "Amount must be greater than zero"],
    },
    gatewayCharge: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Gateway charge must be non-negative"],
    },
    // Bank Details
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
      default: "N/A",
    },
    upiId: {
      type: String,
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },
    utr: {
      type: String,
      trim: true,
    },
    trxId: {
      type: String,
      required: true,
      index: true,
      unique: true,
      trim: true,
    },
    gateWayId: {
      type: String,
      default: "Settlement",
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
    description:{
        type: String,
        trim: true
    }
  },
  { timestamps: true }
);

// Indexes
settlementSchema.index({ user_id: 1 });

export default model("Settlement", settlementSchema);