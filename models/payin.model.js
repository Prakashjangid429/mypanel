import { Schema, model } from "mongoose";

const payInSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: [true, "Please select a member ID."],
    },
    payerName: {
      type: String,
      trim: true,
    },
    txnId: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "Transaction ID is required."],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required."],
      min: [0, "Amount cannot be negative."],
    },
    chargeAmount: {
      type: Number,
      required: [true, "Payment gateway charge is required."],
      min: [0, "Charge amount cannot be negative."],
    },
    vpaId: {
      type: String,
      trim: true,
    },
    utr: {
      type: String,
      trim: true,
      required: [true, "Bank UTR is required."],
    },
    description: {
      type: String,
      trim: true,
      required: [true, "Description is required."],
    },
    referenceID: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Failed", "Success"],
      required: [true, "Status is required (Pending, Failed, or Success)."],
    },
  },
  { timestamps: true }
);

// Unique index for transaction ID
// payInSchema.index({ txnId: 1 }, { unique: true });

export default model("PayinRecord", payInSchema);
