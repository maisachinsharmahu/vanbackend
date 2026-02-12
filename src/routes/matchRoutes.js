import express from 'express';
const router = express.Router();
import {
    getSuggestions,
    swipe,
    getMatches,
    getMyLikes,
    getIncomingLikes,
    respondToLike,
    getDatingChats,
} from '../controllers/matchController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/').get(protect, getMatches);
router.route('/swipe').post(protect, swipe);
router.route('/suggestions').get(protect, getSuggestions);
router.route('/likes').get(protect, getMyLikes);
router.route('/incoming').get(protect, getIncomingLikes);
router.route('/dating-chats').get(protect, getDatingChats);
router.route('/:matchId/respond').put(protect, respondToLike);

export default router;
