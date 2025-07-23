import express from "express";
import { celebrate } from "celebrate";
import Joi from 'joi';
import { generatePayment, checkPaymentStatus, payinCallback, payinback } from "../controllers/payIn.controller.js";
import { verifyToken } from "../middleware/apiToken.js";

const createPayInSchema = {
    body: Joi.object({
        txnId: Joi.string().min(8).max(21).required(),
        amount: Joi.number().required(),
        email: Joi.string().email().required(),
        mobileNumber: Joi.string().pattern(/^[0-9]+$/).required(),
        name: Joi.string().required()
    }),
    headers: Joi.object({
        'authorization': Joi.string().required()
    }).unknown(true)
};
const router = express.Router();

router.post(
    "/create",
    celebrate(createPayInSchema), verifyToken,
    generatePayment
);

router.get(
    "/status/:txnId",
    celebrate({
        params: Joi.object({
            txnId: Joi.string().required()
        }),
        headers: Joi.object({
            'authorization': Joi.string().required()
        }).unknown(true)
    }), verifyToken, checkPaymentStatus
);

router.post(
    "/callback", payinCallback
);

export default router;
