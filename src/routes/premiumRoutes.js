import express from 'express';
const router = express.Router();
import { getPremiumStatus, activatePremium, deactivatePremium } from '../controllers/premiumController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/status').get(protect, getPremiumStatus);
router.route('/activate').post(protect, activatePremium);
router.route('/deactivate').post(protect, deactivatePremium);

export default router;
