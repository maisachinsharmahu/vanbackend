import express from 'express';
const router = express.Router();
import multer from 'multer';
import {
    getPosts,
    getPostById,
    getUserPosts,
    createPost,
    editPost,
    deletePost,
    likePost,
    bookmarkPost,
    getBookmarkedPosts,
    commentPost,
    deleteComment,
    editComment,
} from '../controllers/postController.js';
import { protect } from '../middleware/authMiddleware.js';

const upload = multer({ storage: multer.memoryStorage() });

router.route('/').get(getPosts).post(protect, upload.single('image'), createPost);
router.route('/bookmarked').get(protect, getBookmarkedPosts);
router.route('/user/:userId').get(protect, getUserPosts);
router.route('/:id').get(getPostById).put(protect, editPost).delete(protect, deletePost);
router.route('/:id/like').put(protect, likePost);
router.route('/:id/bookmark').put(protect, bookmarkPost);
router.route('/:id/comment').post(protect, commentPost);
router.route('/:id/comment/:commentId').put(protect, editComment).delete(protect, deleteComment);

export default router;
