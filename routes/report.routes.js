import express from "express";
import {
    getPayinRecords,
    getPayInSuccess,
    getPayoutReports,
    getPayOutSuccess,
    getEwalletTransactions,
    getMainWalletTransactions,
    getSettlementReports
} from "../controllers/allReports.controller.js";

const router = express.Router();

router.get("/payin/records", getPayinRecords);

router.get("/payin/success", getPayInSuccess);

router.get("/payout/reports", getPayoutReports);

router.get("/payout/success", getPayOutSuccess);

router.get("/ewallet/transactions", getEwalletTransactions);

router.get("/mainwallet/transactions", getMainWalletTransactions);

router.get("/settlements", getSettlementReports);

export default router;  