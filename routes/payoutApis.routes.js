import express from "express";
import { celebrate } from "celebrate";

import {
  createPayoutApi,
  getAllPayoutApis,
  getPayoutApiById,
  updatePayoutApi,
  deletePayoutApi,
  togglePayoutApiStatus
} from "../controllers/payoutApis.controller.js";
import Joi from 'joi';

const createPayoutApiSchema = {
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

const updatePayoutApiSchema = {
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
  celebrate(createPayoutApiSchema),
  createPayoutApi
);

router.get(
  "/",
  getAllPayoutApis
);

router.get(
  "/:id",
  getPayoutApiById
);

router.put(
  "/:id",
  celebrate(updatePayoutApiSchema),
  updatePayoutApi
);

router.patch("/:id/toggle-status", togglePayoutApiStatus);

router.delete(
  "/:id",
  deletePayoutApi
);

export default router;
