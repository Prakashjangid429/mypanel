import { Schema, model } from 'mongoose';

const chargeSchema = new Schema({
  chargeType: {
    type: String,
    enum: ['flat', 'percentage'],
    required: true
  },
  chargeValue: {
    type: Number,
    required: true
  }
}, { _id: false });

const payDirectionSchema = new Schema({
  limit: {
    type: Number,
    required: true,
    description: 'Boundary amount to apply lower/higher charges'
  },
  lowerOrEqual: {
    type: chargeSchema,
    required: true
  },
  higher: {
    type: chargeSchema,
    required: true
  }
}, { _id: false });

const commissionPackageSchema = new Schema({
  packageName: {
    type: String,
    required: [true, 'Package name is required'],
    unique: true,
    trim: true
  },
  packageInfo: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  payInCharges: {
    type: payDirectionSchema,
    required: true
  },
  payOutCharges: {
    type: payDirectionSchema,
    required: true
  }
}, { timestamps: true });

export default model('CommissionPackage', commissionPackageSchema);
