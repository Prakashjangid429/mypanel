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
import multerConfig from "../middleware/multerConfig.js";

const router = express.Router();


// User routes
router.use(protect);

router.post("/", multerConfig.single('file'), createQuery);
router.get("/my-queries", getQueries);

// Admin routes
router.use(restrictTo("Admin", "Support"));

router.get("/", getQueries);
router.get("/:id", getQueryById);
router.put("/:id", updateQuery);
router.delete("/:id", deleteQuery);

export default router;