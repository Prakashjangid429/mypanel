import { Schema, model } from "mongoose";

const chargebackSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    trxId: {
      type: String,
      required: true,
      index: true,
      unique: true
    },
    reason: {
      type: String,
      required: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Requested", "Approved", "Rejected"],
      default: "Requested",
    },
    reviewedAt: Date,
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
    adminRemarks: {
      type: String,
    },
  },
  { timestamps: true }
);

// chargebackSchema.index({ trxId: 1 });

export default model("ChargebackRequest", chargebackSchema);
