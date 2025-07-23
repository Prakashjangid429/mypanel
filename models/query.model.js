import mongoose from "mongoose";

const querySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    category: {
      type: String,
      enum: ["technical", "billing", "account", "general", "other"],
      required: true,
    },
    resolutionNotes: {
      type: String,
      trim: true,
    },
    attachments:{
      type: [String], // Array of attachment URLs
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Query = mongoose.model("Query", querySchema);

export default Query;