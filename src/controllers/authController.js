import User from '../models/User.js';
import Match from '../models/Match.js';
import Message from '../models/Message.js';
import Post from '../models/Post.js';
import Notification from '../models/Notification.js';
import generateToken from '../utils/generateToken.js';
import { uploadToGCS, deleteFromGCS } from '../utils/gcsUpload.js';

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                handle: user.handle,
                isAdmin: user.isAdmin,
                token: generateToken(user._id),
                usage: user.nomadCategory,
                myInviteCode: user.myInviteCode,
                hasCompletedOnboarding: user.hasCompletedOnboarding,
                profileIcon: user.profileIcon,
                isNewUser: false,
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Register a new user (full registration with profile)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password, inviteCode, handle, rigType, profileIcon } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400).json({ message: 'User already exists' });
        return;
    }

    if (handle) {
        const handleExists = await User.findOne({ handle: handle.toLowerCase() });
        if (handleExists) {
            res.status(400).json({ message: 'Handle already taken' });
            return;
        }
    }

    // Verify Invite Code (Allow "NOMAD-777" as universal code for now or check DB)
    if (inviteCode !== "NOMAD-777") {
        const inviter = await User.findOne({ myInviteCode: inviteCode });
        if (!inviter) {
            res.status(400).json({ message: 'Invalid invite code' });
            return;
        }
    }

    // Generate unique myInviteCode
    const myInviteCode = 'ATLAS-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    const user = await User.create({
        name,
        email,
        password,
        inviteCode,
        myInviteCode,
        handle: handle ? handle.toLowerCase() : undefined,
        profileIcon: profileIcon || 0,
        hasCompletedOnboarding: true, // Full registration means onboarding is complete
        vanInfo: {
            rigType: rigType || 'Van'
        }
    });

    if (user) {
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            handle: user.handle,
            myInviteCode: user.myInviteCode,
            profileIcon: user.profileIcon,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
            isNewUser: true,
            vanInfo: user.vanInfo,
            token: generateToken(user._id),
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};

// @desc    Signup new user (minimal - just name, email, password)
// @route   POST /api/auth/signup
// @access  Public
const signupUser = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Please provide name, email and password' });
        }

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Generate unique myInviteCode
        const myInviteCode = 'ATLAS-' + Math.random().toString(36).substring(2, 7).toUpperCase();

        const user = await User.create({
            name,
            email,
            password,
            myInviteCode,
            hasCompletedOnboarding: false, // New signup needs to complete onboarding
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                myInviteCode: user.myInviteCode,
                hasCompletedOnboarding: false,
                isNewUser: true,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Google Auth
// @route   POST /api/auth/google
// @access  Public
const googleAuth = async (req, res) => {
    const { email, name, photoUrl, idToken } = req.body;

    try {
        let user = await User.findOne({ email });
        let isNewUser = false;

        if (user) {
            // Existing user - return login response
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                handle: user.handle,
                myInviteCode: user.myInviteCode,
                hasCompletedOnboarding: user.hasCompletedOnboarding,
                profileIcon: user.profileIcon,
                isNewUser: false,
                token: generateToken(user._id),
            });
        } else {
            // Create new user via Google
            isNewUser = true;
            const myInviteCode = 'ATLAS-' + Math.random().toString(36).substring(2, 7).toUpperCase();
            user = await User.create({
                name,
                email,
                password: Math.random().toString(36), // Random password for social login
                photos: [photoUrl],
                myInviteCode,
                hasCompletedOnboarding: false,
            });

            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                myInviteCode: user.myInviteCode,
                hasCompletedOnboarding: false,
                isNewUser: true,
                token: generateToken(user._id),
            });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Check Handle Availability
// @route   GET /api/auth/check-handle/:handle
// @access  Public
const checkHandle = async (req, res) => {
    const { handle } = req.params;
    const user = await User.findOne({ handle: handle.toLowerCase() });

    if (user) {
        res.status(400).json({ available: false, message: 'Handle already taken' });
    } else {
        res.json({ available: true, message: 'Handle available' });
    }
};

// @desc    Complete Onboarding
// @route   PUT /api/auth/complete-onboarding
// @access  Private
const completeOnboarding = async (req, res) => {
    const { userId, handle, rigType, profileIcon, interests, inviteCode } = req.body;

    try {
        // Use authenticated user ID if available, fall back to body userId
        const targetUserId = req.user?._id || userId;
        const user = await User.findById(targetUserId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check handle uniqueness if provided
        if (handle && handle !== user.handle) {
            const handleExists = await User.findOne({ handle: handle.toLowerCase(), _id: { $ne: targetUserId } });
            if (handleExists) {
                return res.status(400).json({ message: 'Handle already taken' });
            }
            user.handle = handle.toLowerCase();
        }

        // Update user profile with onboarding data
        if (rigType) user.vanInfo = { ...user.vanInfo, rigType };
        if (profileIcon !== undefined) user.profileIcon = profileIcon;
        if (interests) user.interests = interests;
        if (inviteCode) user.inviteCode = inviteCode;
        user.hasCompletedOnboarding = true;

        await user.save();

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            handle: user.handle,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
            profileIcon: user.profileIcon,
            vanInfo: user.vanInfo,
            interests: user.interests,
            message: 'Onboarding completed successfully',
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Remove duplicate photos
        if (user.photos && Array.isArray(user.photos)) {
            user.photos = [...new Set(user.photos)];
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            handle: user.handle,
            bio: user.bio,
            age: user.age,
            pronouns: user.pronouns,
            nextStop: user.nextStop,
            profilePhoto: user.profilePhoto,
            photos: user.photos,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
            profileIcon: user.profileIcon,
            vanInfo: user.vanInfo,
            interests: user.interests,
            myInviteCode: user.myInviteCode,
            isPremium: user.isPremium || false,
            subscriptionTier: user.subscriptionTier || 'free',
            premiumSince: user.premiumSince,
            verificationTier: user.verificationTier,
            createdAt: user.createdAt,
            isPrivateProfile: user.isPrivateProfile || false,
            privacySettings: user.privacySettings,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete user account (DEV ONLY)
// @route   DELETE /api/auth/account
// @access  Private
const deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        // Clean up all related data
        await Match.deleteMany({ users: userId });
        await Message.deleteMany({ sender: userId });
        await Post.deleteMany({ author: userId });
        await Notification.deleteMany({ $or: [{ recipient: userId }, { sender: userId }] });

        // Remove user from other posts' likes/comments
        await Post.updateMany({}, {
            $pull: {
                likes: userId,
                comments: { user: userId }
            }
        });

        // Delete user
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'Account and all related data deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const { name, handle, bio, age, pronouns, nextStop, rigType, vanMake, vanModel, vanYear, interests } = req.body;

        // Update basic fields
        if (name) user.name = name;
        if (bio !== undefined) user.bio = bio;
        if (age !== undefined) user.age = age;
        if (pronouns !== undefined) user.pronouns = pronouns;
        if (nextStop !== undefined) user.nextStop = nextStop;

        // Update handle (check uniqueness)
        if (handle && handle !== user.handle) {
            const handleExists = await User.findOne({ handle: handle.toLowerCase(), _id: { $ne: user._id } });
            if (handleExists) {
                return res.status(400).json({ message: 'Handle already taken' });
            }
            user.handle = handle.toLowerCase();
        }

        // Update van info
        if (rigType || vanMake || vanModel || vanYear) {
            user.vanInfo = {
                ...user.vanInfo,
                ...(rigType && { rigType }),
                ...(vanMake && { make: vanMake }),
                ...(vanModel && { model: vanModel }),
                ...(vanYear && { year: vanYear }),
            };
        }

        // Update interests
        if (interests) user.interests = interests;

        await user.save();

        // Remove duplicate photos
        if (user.photos && Array.isArray(user.photos)) {
            user.photos = [...new Set(user.photos)];
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            handle: user.handle,
            bio: user.bio,
            age: user.age,
            pronouns: user.pronouns,
            nextStop: user.nextStop,
            profileIcon: user.profileIcon,
            profilePhoto: user.profilePhoto,
            photos: user.photos,
            vanInfo: user.vanInfo,
            interests: user.interests,
            myInviteCode: user.myInviteCode,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Upload profile image to GCS
// @route   POST /api/auth/upload-photo
// @access  Private
const uploadProfilePhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Upload to Google Cloud Storage
        const imageUrl = await uploadToGCS(
            req.file.buffer,
            req.file.originalname,
            `users/${user._id}/photos`,
            req.file.mimetype
        );

        // Set as profile photo and add to photos array
        user.profilePhoto = imageUrl; // Main profile photo
        if (!user.photos) user.photos = [];
        // Only add if not already in photos array (prevent duplicates)
        if (!user.photos.includes(imageUrl)) {
            user.photos.unshift(imageUrl); // Add at beginning of photo gallery
        }

        await user.save();

        // Deduplicate photos before returning
        if (user.photos && Array.isArray(user.photos)) {
            user.photos = [...new Set(user.photos)];
        }

        res.json({
            imageUrl,
            profilePhoto: user.profilePhoto,
            photos: user.photos,
            message: 'Photo uploaded successfully',
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
};

// @desc    Update profile photo with existing photo URL
// @route   PUT /api/auth/update-profile-photo
// @access  Private
const updateProfilePhotoUrl = async (req, res) => {
    try {
        const { photoUrl } = req.body;

        if (!photoUrl) {
            return res.status(400).json({ message: 'Photo URL is required' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Set profile photo to the provided URL
        user.profilePhoto = photoUrl;
        // Also ensure it's in the photos array (and not duplicated)
        if (!user.photos) user.photos = [];
        if (!user.photos.includes(photoUrl)) {
            user.photos.unshift(photoUrl);
        }
        await user.save();

        // Deduplicate photos before returning
        if (user.photos && Array.isArray(user.photos)) {
            user.photos = [...new Set(user.photos)];
        }

        res.json({
            profilePhoto: user.profilePhoto,
            photos: user.photos,
            message: 'Profile photo updated successfully',
        });
    } catch (error) {
        console.error('Update profile photo error:', error);
        res.status(500).json({ message: 'Update failed', error: error.message });
    }
};

// @desc    Delete a photo from user profile
// @route   DELETE /api/auth/photo
// @access  Private
const deleteProfilePhoto = async (req, res) => {
    try {
        const { photoUrl } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Remove from GCS
        await deleteFromGCS(photoUrl);

        // Remove from user's photos array
        user.photos = user.photos.filter(p => p !== photoUrl);
        await user.save();

        res.json({ photos: user.photos, message: 'Photo deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Delete failed', error: error.message });
    }
};

// @desc    Update privacy settings
// @route   PUT /api/auth/privacy
// @access  Private
const updatePrivacy = async (req, res) => {
    try {
        const { isPrivateProfile, privacySettings } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update privacy settings
        if (isPrivateProfile !== undefined) {
            user.isPrivateProfile = isPrivateProfile;
        }

        if (privacySettings) {
            user.privacySettings = {
                hideLocation: privacySettings.hideLocation ?? user.privacySettings?.hideLocation ?? false,
                hideStats: privacySettings.hideStats ?? user.privacySettings?.hideStats ?? false,
                hidePhotos: privacySettings.hidePhotos ?? user.privacySettings?.hidePhotos ?? false,
                allowMessages: privacySettings.allowMessages ?? user.privacySettings?.allowMessages ?? true,
            };
        }

        await user.save();

        res.json({
            _id: user._id,
            name: user.name,
            handle: user.handle,
            isPrivateProfile: user.isPrivateProfile,
            privacySettings: user.privacySettings,
            message: 'Privacy settings updated'
        });
    } catch (error) {
        res.status(500).json({ message: 'Update failed', error: error.message });
    }
};

export { authUser, registerUser, signupUser, googleAuth, checkHandle, completeOnboarding, getUserProfile, updateProfile, uploadProfilePhoto, updateProfilePhotoUrl, deleteProfilePhoto, updatePrivacy, deleteAccount };
