import express from 'express';
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  changeTrxPassword,
  getAllUsers,
  toggleUserStatus,
  updateUserByAdmin,
  updateBankDetails,
  flatenUsers,
  switchUserApis,
  bulkSwitchApis,
  bankSettlement,
  eWalletToMainWalletSettlement,
  mainWalletToEWalletSettlement
} from '../controllers/auth.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', loginUser);

router.use(protect);

router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.put('/bank_details', updateBankDetails)
router.put('/change-password', changePassword);
router.put('/change-trx-password', changeTrxPassword);

router.use(restrictTo('Admin'))

router.post('/register', registerUser);
router.get('/users', getAllUsers);
router.get('/flatens', flatenUsers);
router.put('/status/:userId', toggleUserStatus);
router.post('/:userId', updateUserByAdmin);

router.put('/switch/:userId', switchUserApis);
router.put('/bulk', bulkSwitchApis);
router.post('/settlement/bank',bankSettlement)
router.post("/settlement/wallet",eWalletToMainWalletSettlement)
router.post("/settlement/maintoEwallet",mainWalletToEWalletSettlement)

export default router;