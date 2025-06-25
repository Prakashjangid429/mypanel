import express from "express";
import {
  createQuery,
  getQueries,
  getQueryById,
  updateQuery,
  deleteQuery,
} from "../controllers/queries.controller.js";
import { protect, restrictTo } from "../middleware/auth.js";
import { celebrate, Joi } from "celebrate";

const router = express.Router();

// Validation schema
const queryValidation = {
  body: Joi.object({
    subject: Joi.string().required().max(100),
    message: Joi.string().required().max(2000),
    category: Joi.string().valid("technical", "billing", "account", "general", "other").required(),
    priority: Joi.string().valid("low", "medium", "high", "critical"),
    attachments: Joi.array().items(
      Joi.object({
        url: Joi.string().uri().required(),
        name: Joi.string().required(),
        size: Joi.number().required(),
      })
    ),
  }),
};

// User routes
router.use(protect);

router.post("/", celebrate(queryValidation), createQuery);
router.get("/my-queries", getQueries);

// Admin routes
router.use(restrictTo("Admin", "Support"));

router.get("/", getQueries);
router.get("/:id", getQueryById);
router.put("/:id", celebrate(queryValidation), updateQuery);
router.delete("/:id", deleteQuery);

export default router;