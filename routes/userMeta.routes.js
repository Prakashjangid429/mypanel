import express from 'express';
import {
    upsertUserMeta,
    getUserMeta,
    getMetaByUserId,
    updateWhitelistedIPs,
    deleteUserMeta,
} from '../controllers/userMeta.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { celebrate, Joi } from 'celebrate';

const router = express.Router();

// User Routes
router.use(protect);

router.post('/upsert', celebrate({
    body: Joi.object({
        payInCallbackUrl: Joi.string()
            .uri()
            .allow('', null)
            .messages({
                'string.uri': 'payInCallbackUrl must be a valid URL',
            }),
        payOutCallbackUrl: Joi.string()
            .uri()
            .allow('', null)
            .messages({
                'string.uri': 'payOutCallbackUrl must be a valid URL',
            }),
        meta: Joi.object().optional(),
    })
}), upsertUserMeta);

router.get('/me', getUserMeta);

// Admin Routes
router.get('/:userId',restrictTo('Admin'), getMetaByUserId);
router.put('/whitelist',restrictTo('Admin'), updateWhitelistedIPs);
router.delete('/:userId',restrictTo('Admin'), deleteUserMeta);

export default router;
