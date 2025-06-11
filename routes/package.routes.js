import express from 'express';
import {
  upsertCommissionPackage,
  getAllCommissionPackages,
  getCommissionPackageById,
  deleteCommissionPackage
} from '../controllers/package.controller.js';

import { protect, restrictTo } from '../middleware/auth.js';
import { celebrate } from 'celebrate';
import Joi from 'joi';

const chargeSchema = Joi.object({
  chargeType: Joi.string().valid('flat', 'percentage').required(),
  chargeValue: Joi.number().required()
});

const payDirectionSchema = Joi.object({
  limit: Joi.number().required(),
  lowerOrEqual: chargeSchema.required(),
  higher: chargeSchema.required()
});

const upsertCommissionPackageSchema = {
  body: Joi.object({
    packageName: Joi.string().trim().required(),
    packageInfo: Joi.string().allow('').optional(),
    isActive: Joi.boolean().optional(),
    payInCharges: payDirectionSchema.required(),
    payOutCharges: payDirectionSchema.required()
  })
};


const router = express.Router();

// Protect all routes and restrict to Admin only
router.use(protect);
router.use(restrictTo('Admin'));

// Routes
router.post('/', celebrate(upsertCommissionPackageSchema), upsertCommissionPackage);
router.get('/', getAllCommissionPackages);
router.get('/:id', getCommissionPackageById);
router.delete('/:id', deleteCommissionPackage);

export default router;
