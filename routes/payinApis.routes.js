import express from "express";
import { celebrate } from "celebrate";
import Joi from 'joi';
import {
    createPayInApi,
    getAllPayInApis,
    getPayInApiById,
    updatePayInApi,
    deletePayInApi,
    togglePayInApiStatus
} from "../controllers/payinApis.controller.js";

const createPayInApiSchema = {
    body: Joi.object({
        name: Joi.string().required(),
        baseUrl: Joi.string().uri().required(),
        apiKey: Joi.string().required(),
        apiSecret: Joi.string().required(),
        provider: Joi.string().optional(),
        isActive: Joi.boolean().optional(),
        meta: Joi.object().optional(),
    })
};

const updatePayInApiSchema = {
    body: Joi.object({
        name: Joi.string(),
        baseUrl: Joi.string().uri(),
        apiKey: Joi.string(),
        apiSecret: Joi.string(),
        provider: Joi.string(),
        isActive: Joi.boolean(),
        meta: Joi.object()
    })
};

const router = express.Router();


router.post(
    "/",
    celebrate(createPayInApiSchema),
    createPayInApi
);

router.get(
    "/",
    getAllPayInApis
);

router.get(
    "/:id",
    getPayInApiById
);

router.put(
    "/:id",
    celebrate(updatePayInApiSchema),
    updatePayInApi
);

router.patch("/:id/toggle-status", togglePayInApiStatus);

router.delete(
    "/:id",
    deletePayInApi
);

export default router;
