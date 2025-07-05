import { Schema, model, Types } from 'mongoose';

const userMetaSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    clientId: {
      type: String,
      required: true,
      unique: true
    },
    payInCallbackUrl: {
      type: String,
      default: null,
    },
    payOutCallbackUrl: {
      type: String,
      default: null,
    },
    whitelistedIPs: {
      type: [String],
      default: [],
      validate: {
        validator: function (ips) {
          return ips.every(ip => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip));
        },
        message: 'One or more IP addresses are invalid',
      },
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export default model('UserMeta', userMetaSchema);
