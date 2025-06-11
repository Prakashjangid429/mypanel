import express from "express";
import {
    getPayinRecords,
    getPayInSuccess,
    getPayoutReports,
    getPayoutStats,
    getPayOutSuccess,
    getPayOutSuccessStats,
    getEwalletTransactions,
    getEwalletStats,
    getMainWalletTransactions,
    getMainWalletStats
} from "../controllers/allReports.controller.js";

const router = express.Router();

router.get("/payin/records", getPayinRecords);

router.get("/payin/success", getPayInSuccess);

router.get("/payout/reports", getPayoutReports);

router.get("/payout/stats", getPayoutStats);

router.get("/payout/success", getPayOutSuccess);

router.get("/payout/success-stats", getPayOutSuccessStats);

router.get("/ewallet/transactions", getEwalletTransactions);

router.get("/ewallet/stats", getEwalletStats);

router.get("/mainwallet/transactions", getMainWalletTransactions);

router.get("/mainwallet/stats", getMainWalletStats);

export default router;