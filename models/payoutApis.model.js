import { Schema, model } from "mongoose";

const payoutApiSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "API name is required"],
      unique: true
    },
    baseUrl: {
      type: String,
      required: [true, "Base URL is required"]
    },
    apiKey: {
      type: String,
      required: [true, "API key is required"]
    },
    apiSecret: {
      type: String,
      required: [true, "API secret is required"]
    },
    provider: {
      type: String,
      default: "Generic"
    },
    isActive: {
      type: Boolean,
      default: true
    },
    meta: {
      type: Object,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

export default model("PayoutApi", payoutApiSchema);
