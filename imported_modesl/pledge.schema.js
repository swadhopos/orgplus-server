const mongoose = require("mongoose");

/**
 * Pledge Sub-Schema
 * Reusable embedded schema for pledges inside Event and Fundraiser.
 * References your existing pledger/committer model via committerId.
 */

const pledgeSchema = new mongoose.Schema(
  {
    committerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Committer",
      required: [true, "Committer ID is required"]
    },
    committerName: {
      type: String,
      trim: true,
      maxlength: [200, "Committer name cannot exceed 200 characters"],
      default: null
    },
    pledgedAmount: {
      type: Number,
      required: [true, "Pledged amount is required"],
      min: [0.01, "Pledged amount must be greater than 0"]
    },
    receivedAmount: {
      type: Number,
      default: 0,
      min: [0, "Received amount cannot be negative"]
    },
    pledgeDate: { type: Date, default: Date.now },
    dueDate: { type: Date, default: null },
    fulfilledDate: { type: Date, default: null },
    status: {
      type: String,
      enum: {
        values: ["pledged", "partially_fulfilled", "fulfilled", "cancelled", "defaulted"],
        message: "{VALUE} is not a valid pledge status"
      },
      default: "pledged"
    },
    notes: { type: String, trim: true, maxlength: [500, "Notes cannot exceed 500 characters"], default: null },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    recordedByUserId: { type: String, required: [true, "Recorded by user ID is required"] },
    recordedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

module.exports = pledgeSchema;
