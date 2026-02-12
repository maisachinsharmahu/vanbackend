import express from 'express';
const router = express.Router();
import { getMessages, sendMessage, getChatThreads, markAsRead } from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/threads').get(protect, getChatThreads);
router.route('/:roomId/read').put(protect, markAsRead);
router.route('/:roomId').get(protect, getMessages);
router.route('/').post(protect, sendMessage);

export default router;
