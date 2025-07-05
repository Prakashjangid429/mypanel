import express from "express";
import {
    getPayinRecords,
    getPayInSuccess,
    getPayoutReports,
    getPayoutStats,
    getPayOutSuccess,
    getPayOutSuccessStats,
    getEwalletTransactions,
    getMainWalletTransactions
} from "../controllers/allReports.controller.js";

const router = express.Router();

router.get("/payin/records", getPayinRecords);

router.get("/payin/success", getPayInSuccess);

router.get("/payout/reports", getPayoutReports);

router.get("/payout/stats", getPayoutStats);

router.get("/payout/success", getPayOutSuccess);

router.get("/payout/success-stats", getPayOutSuccessStats);

router.get("/ewallet/transactions", getEwalletTransactions);

router.get("/mainwallet/transactions", getMainWalletTransactions);

export default router;