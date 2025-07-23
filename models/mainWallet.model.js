import mongoose from 'mongoose';

const mainWalletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
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
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
      default: 'credit'
    },
    description: {
      type: String,
      default: ''
    },
    beforeAmount: {
      type: Number,
      required: true
    },
    afterAmount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'success'
    }
  },
  {
    timestamps: true
  }
);

const MainWalletTransaction = mongoose.model('MainWalletTransaction', mainWalletTransactionSchema);
export default MainWalletTransaction;
