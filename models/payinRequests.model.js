import { Schema, model } from "mongoose";

const qrGenerationSchema = new Schema(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "user",
            required: [true, "Please select a member ID."],
        },
        txnId: {
            type: String,
            trim: true,
            unique: true,
            required: [true, "Transaction ID is required."],
        },
        refId: {
            type: String,
            trim: true,
        },
        gateWayId: {
            type: String,
            trim: true,
            required: [true, "Gateway ID is required."],
        },
        amount: {
            type: Number,
            required: [true, "Amount is required."],
            min: [0, "Amount must be positive."],
        },
        chargeAmount: {
            type: Number,
            required: [true, "Payment gateway charge is required."],
            min: [0, "Charge amount cannot be negative."],
            default: 0
        },
        utr: {
            type: String,
            required: false
        },
        name: {
            type: String,
            trim: true,
            required: [true, "Name is required."],
        },
        email:{
            type: String,
            trim: true,
            validate: {
                validator: function (v) {
                    return /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(v);
                },
                message: props => `${props.value} is not a valid email!`
            }
        },
        mobileNumber: {
            type: String,
            trim: true,
            validate: {
                validator: function (v) {
                    return /^\d{10}$/.test(v);
                },
                message: props => `${props.value} is not a valid mobile number!`
            }
        },
        qrData: {
            type: String,
            trim: true,
        },
        qrIntent: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: ["Pending", "Failed", "Success"],
            default: "Pending",
        },
        failureReason: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

qrGenerationSchema.index({ createdAt: 1 });

export default model("PayinGenerationRecord", qrGenerationSchema);
