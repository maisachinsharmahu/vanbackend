import express from 'express';
import multer from 'multer';
const router = express.Router();
import { authUser, registerUser, signupUser, googleAuth, checkHandle, completeOnboarding, getUserProfile, updateProfile, uploadProfilePhoto, updateProfilePhotoUrl, deleteProfilePhoto, updatePrivacy, deleteAccount } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

// Multer config - store in memory for direct GCS upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

router.post('/login', authUser);
router.post('/register', registerUser);
router.post('/signup', signupUser);
router.post('/google', googleAuth);
router.get('/check-handle/:handle', checkHandle);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateProfile);
router.put('/update-profile-photo', protect, updateProfilePhotoUrl);
router.put('/privacy', protect, updatePrivacy);
router.put('/complete-onboarding', protect, completeOnboarding);
router.post('/upload-photo', protect, upload.single('photo'), uploadProfilePhoto);
router.delete('/photo', protect, deleteProfilePhoto);
router.delete('/account', protect, deleteAccount);

export default router;
