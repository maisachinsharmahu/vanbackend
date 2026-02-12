import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    handle: { type: String, unique: true, sparse: true }, // @username
    password: { type: String, required: true },
    age: { type: Number },
    pronouns: { type: String },
    bio: { type: String },
    profilePhoto: { type: String }, // Main profile photo URL
    photos: [{ type: String }], // Array of all uploaded photos
    verificationTier: { type: Number, default: 1 }, // 1: Basic, 2: Verified, 3: Premium
    nomadCategory: { type: String, default: 'friends', enum: ['dating', 'friends', 'builder'] },

    // Location Data
    location: {
        lat: Number,
        lng: Number
    },
    nextStop: String,

    // Preferences
    lookingFor: {
        dating: { type: Boolean, default: false },
        friends: { type: Boolean, default: false },
        community: { type: Boolean, default: false },
        hiddenSpots: { type: Boolean, default: false }
    },

    // Van Details
    vanInfo: {
        make: String,
        model: String,
        year: String,
        photoUrl: String,
        rigType: { type: String, enum: ['Van', 'Bus', 'RV', 'Car', 'Truck', 'Other'] } // Valid rig types
    },

    profileIcon: { type: Number, default: 0 }, // ID of selected avatar icon

    myInviteCode: { type: String, unique: true },
    inviteCode: { type: String }, // Code used to sign up

    hasCompletedOnboarding: { type: Boolean, default: false }, // Track onboarding completion
    interests: [{ type: String }], // User interests from onboarding

    // Privacy & Safety
    isPrivateProfile: { type: Boolean, default: false }, // Privacy mode for solo travelers
    privacySettings: {
        hideLocation: { type: Boolean, default: false },
        hideStats: { type: Boolean, default: false },
        hidePhotos: { type: Boolean, default: false },
        allowMessages: { type: Boolean, default: true }
    },

    // Premium / Subscription
    isPremium: { type: Boolean, default: false },
    premiumSince: { type: Date },
    subscriptionTier: { type: String, enum: ['free', 'premium'], default: 'free' },
    premiumExpiresAt: { type: Date },

    // Daily swipe tracking (reset daily for free users)
    dailySwipes: { type: Number, default: 0 },
    lastSwipeDate: { type: String }, // "YYYY-MM-DD"

    // Post count tracking for free tier limit
    totalPostCount: { type: Number, default: 0 },

    // Social
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    createdAt: { type: Date, default: Date.now }
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);
export default User;
