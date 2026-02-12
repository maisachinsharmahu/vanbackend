import express from 'express';
const router = express.Router();
import {
  getUserProfile,
  getPublicProfile,
  followUser,
  getFollowers,
  getFollowing,
  searchUsers,
  updateUserProfile,
  getUsersForMapFiltered,
  getNotifications,
  updateLocation,
  toggleLocationSharing
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);
router.route('/location').put(protect, updateLocation);
router.route('/share-location').put(protect, toggleLocationSharing);
router.route('/map').get(protect, getUsersForMapFiltered);
router.route('/notifications').get(protect, getNotifications);
router.route('/search').get(protect, searchUsers);
router.route('/:id').get(protect, getPublicProfile);
router.route('/:id/follow').put(protect, followUser);
router.route('/:id/followers').get(protect, getFollowers);
router.route('/:id/following').get(protect, getFollowing);

export default router;
