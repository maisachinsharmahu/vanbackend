import express from 'express';
const router = express.Router();
import { getExperts, getExpertById } from '../controllers/expertController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/').get(protect, getExperts);
router.route('/:id').get(protect, getExpertById);

export default router;
