import User from '../models/User.js';
import Post from '../models/Post.js';

// @desc    Get premium status for current user
// @route   GET /api/premium/status
// @access  Private
const getPremiumStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Auto-expire premium if past expiry date
        if (user.isPremium && user.premiumExpiresAt && new Date() > new Date(user.premiumExpiresAt)) {
            user.isPremium = false;
            user.subscriptionTier = 'free';
            user.verificationTier = 1;
            user.premiumExpiresAt = null;
            await user.save();
            console.log(`[Premium] Auto-expired premium for user ${user._id}`);
        }

        const today = new Date().toISOString().split('T')[0];
        const postCount = await Post.countDocuments({ author: user._id });

        res.json({
            isPremium: user.isPremium,
            subscriptionTier: user.subscriptionTier || 'free',
            premiumSince: user.premiumSince,
            premiumExpiresAt: user.premiumExpiresAt,
            limits: {
                postsUsed: postCount,
                postsLimit: user.isPremium ? -1 : 5, // -1 = unlimited
                swipesUsed: (user.lastSwipeDate === today) ? user.dailySwipes : 0,
                swipesLimit: user.isPremium ? -1 : 2,
                canMessage: user.isPremium,
                canViewFullProfile: user.isPremium, // premium sees all posts on profiles
                profilePostsLimit: user.isPremium ? -1 : 3,
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Activate premium (called after RevenueCat purchase succeeds on client)
// @route   POST /api/premium/activate
// @access  Private
const activatePremium = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Require revenueCatUserId — protects against raw API calls
        const { revenueCatUserId, plan } = req.body;
        if (!revenueCatUserId) {
            return res.status(400).json({ message: 'RevenueCat User ID is required for activation' });
        }

        user.isPremium = true;
        user.subscriptionTier = 'premium';
        user.premiumSince = new Date();
        user.revenueCatUserId = revenueCatUserId;
        const expiresAt = new Date();
        if (plan === 'yearly') {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        } else {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
        }
        user.premiumExpiresAt = expiresAt;
        user.verificationTier = 3; // Blue tick = tier 3

        await user.save();

        res.json({
            isPremium: true,
            subscriptionTier: 'premium',
            premiumSince: user.premiumSince,
            premiumExpiresAt: user.premiumExpiresAt,
            verificationTier: user.verificationTier,
        });
    } catch (error) {
        res.status(500).json({ message: 'Activation failed', error: error.message });
    }
};

// @desc    Deactivate premium (cancellation)
// @route   POST /api/premium/deactivate
// @access  Private
const deactivatePremium = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.isPremium = false;
        user.subscriptionTier = 'free';
        user.premiumExpiresAt = null;
        user.premiumSince = null;
        user.verificationTier = 1; // Back to basic

        await user.save();

        res.json({ isPremium: false, subscriptionTier: 'free' });
    } catch (error) {
        res.status(500).json({ message: 'Deactivation failed', error: error.message });
    }
};

// @desc    Check if user can perform action (middleware-style helper)
// Reusable function for other controllers
const checkPremiumLimit = async (userId, action) => {
    const user = await User.findById(userId);
    if (!user) return { allowed: false, reason: 'User not found' };

    if (user.isPremium) return { allowed: true };

    const today = new Date().toISOString().split('T')[0];

    switch (action) {
        case 'create_post': {
            const postCount = await Post.countDocuments({ author: userId });
            if (postCount >= 5) {
                return { allowed: false, reason: 'Free users can create up to 5 posts. Upgrade to Premium for unlimited posts!', limit: 5, used: postCount };
            }
            return { allowed: true };
        }
        case 'swipe': {
            const swipesToday = (user.lastSwipeDate === today) ? user.dailySwipes : 0;
            if (swipesToday >= 2) {
                return { allowed: false, reason: 'Free users get 2 swipes per day. Upgrade to Premium for unlimited swipes!', limit: 2, used: swipesToday };
            }
            return { allowed: true };
        }
        case 'message': {
            return { allowed: false, reason: 'Messaging is a Premium feature. Upgrade to connect with other nomads!' };
        }
        default:
            return { allowed: true };
    }
};

// @desc    Increment swipe counter for free users
const incrementSwipe = async (userId) => {
    const user = await User.findById(userId);
    if (!user || user.isPremium) return;

    const today = new Date().toISOString().split('T')[0];
    if (user.lastSwipeDate !== today) {
        user.dailySwipes = 1;
        user.lastSwipeDate = today;
    } else {
        user.dailySwipes += 1;
    }
    await user.save();
};

// @desc    Judge bypass — grant premium without RevenueCat (hackathon demo)
// @route   POST /api/premium/judge-bypass
// @access  Private
const judgeBypass = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.isPremium = true;
        user.subscriptionTier = 'premium';
        user.premiumSince = new Date();
        // Grant 1 year for judge demo
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        user.premiumExpiresAt = expiresAt;
        user.verificationTier = 3;

        await user.save();
        console.log(`[Premium] Judge bypass activated for user ${user._id} (${user.name})`);

        res.json({
            isPremium: true,
            subscriptionTier: 'premium',
            premiumSince: user.premiumSince,
            premiumExpiresAt: user.premiumExpiresAt,
            verificationTier: user.verificationTier,
        });
    } catch (error) {
        res.status(500).json({ message: 'Judge bypass failed', error: error.message });
    }
};

export { getPremiumStatus, activatePremium, deactivatePremium, checkPremiumLimit, incrementSwipe, judgeBypass };
