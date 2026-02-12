import express from 'express';
const router = express.Router();
import { getExperts, getExpertById, getMyExpertProfile, registerAsExpert, updateExpertProfile } from '../controllers/expertController.js';
import { protect } from '../middleware/authMiddleware.js';

// Order matters: /me/profile before /:id
router.route('/me/profile').get(protect, getMyExpertProfile).put(protect, updateExpertProfile);
router.route('/register').post(protect, registerAsExpert);
router.route('/').get(protect, getExperts);
router.route('/:id').get(protect, getExpertById);

export default router;
