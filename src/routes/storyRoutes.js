import express from 'express';
const router = express.Router();
import multer from 'multer';
import {
    createStory,
    getStories,
    getUserStories,
    viewStory,
    deleteStory,
    getStoryViewers,
} from '../controllers/storyController.js';
import { protect } from '../middleware/authMiddleware.js';

const upload = multer({ storage: multer.memoryStorage() });

// GET all active stories (grouped by user) | POST create story
router.route('/')
    .get(protect, getStories)
    .post(protect, upload.single('image'), createStory);

// GET stories for specific user
router.route('/user/:userId').get(protect, getUserStories);

// PUT mark story viewed
router.route('/:id/view').put(protect, viewStory);

// GET viewers of own story
router.route('/:id/viewers').get(protect, getStoryViewers);

// DELETE own story
router.route('/:id').delete(protect, deleteStory);

export default router;
