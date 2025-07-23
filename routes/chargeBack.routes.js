import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import { generateChargeBack, getChargebackRecords } from '../controllers/chargeBack.controller.js';

const router = express.Router();

// Routes
router.post('/', protect, restrictTo('Admin'), generateChargeBack);
router.get('/', protect, getChargebackRecords);

export default router;
