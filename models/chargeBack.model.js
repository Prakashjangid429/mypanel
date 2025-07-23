import { Schema, model } from "mongoose";

const chargebackSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    txnId: {
      type: String,
      required: true,
      index: true,
      unique: true
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Failed", "Success"],
      default: "Success",
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    charges: {
      type: Number,
      default: 0
    },
    payerName: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    utr: {
      type: String,
      required: true
    },
    vpaId: {
      type: String,
    }
  },
  { timestamps: true }
);

export default model("Chargebacks", chargebackSchema);
