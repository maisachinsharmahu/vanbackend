import express from 'express';
const router = express.Router();
import {
    createAdventure,
    getAdventures,
    getAdventure,
    joinAdventure,
    leaveAdventure,
    getMyAdventures,
} from '../controllers/adventureController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/').get(protect, getAdventures).post(protect, createAdventure);
router.route('/my').get(protect, getMyAdventures);
router.route('/:id').get(protect, getAdventure);
router.route('/:id/join').post(protect, joinAdventure);
router.route('/:id/leave').post(protect, leaveAdventure);

export default router;
