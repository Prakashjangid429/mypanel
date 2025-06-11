import express from "express";
import { generatePayOut } from "../controllers/payout.controller.js";

const router = express.Router();

router.post("/payout/generate", generatePayOut);

export default router;