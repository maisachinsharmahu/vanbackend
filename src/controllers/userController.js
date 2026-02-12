import User from '../models/User.js';
import Post from '../models/Post.js';
import Notification from '../models/Notification.js';

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      handle: user.handle,
      nomadCategory: user.nomadCategory,
      photos: user.photos,
      profilePhoto: user.profilePhoto,
      location: user.location,
      bio: user.bio,
      age: user.age,
      pronouns: user.pronouns,
      nextStop: user.nextStop,
      vanInfo: user.vanInfo,
      verificationTier: user.verificationTier,
      profileIcon: user.profileIcon,
      myInviteCode: user.myInviteCode,
      interests: user.interests,
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0,
      isPremium: user.isPremium || false,
      subscriptionTier: user.subscriptionTier || 'free',
    });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Get public user profile by ID
// @route   GET /api/users/:id
// @access  Private
const getPublicProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -email');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const postCount = await Post.countDocuments({ author: user._id });
    const isFollowing = user.followers ? user.followers.includes(req.user._id) : false;

    res.json({
      _id: user._id,
      name: user.name,
      handle: user.handle,
      bio: user.bio,
      age: user.age,
      pronouns: user.pronouns,
      nextStop: user.nextStop,
      photos: user.photos,
      profilePhoto: user.profilePhoto,
      profileIcon: user.profileIcon,
      vanInfo: user.vanInfo,
      verificationTier: user.verificationTier,
      interests: user.interests,
      nomadCategory: user.nomadCategory,
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0,
      postCount,
      isFollowing,
      isPrivateProfile: user.isPrivateProfile,
      isPremium: user.isPremium || false,
      subscriptionTier: user.subscriptionTier || 'free',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Follow a user
// @route   PUT /api/users/:id/follow
// @access  Private
const followUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!userToFollow || !currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!userToFollow.followers) userToFollow.followers = [];
    if (!currentUser.following) currentUser.following = [];

    const isAlreadyFollowing = userToFollow.followers.includes(req.user._id);

    if (isAlreadyFollowing) {
      // Unfollow
      userToFollow.followers = userToFollow.followers.filter(
        id => id.toString() !== req.user._id.toString()
      );
      currentUser.following = currentUser.following.filter(
        id => id.toString() !== req.params.id
      );
    } else {
      // Follow
      userToFollow.followers.push(req.user._id);
      currentUser.following.push(req.params.id);

      // Create notification
      await Notification.create({
        recipient: userToFollow._id,
        sender: req.user._id,
        type: 'system',
        content: `started following you`,
        relatedId: req.user._id,
      });
    }

    await userToFollow.save();
    await currentUser.save();

    res.json({
      isFollowing: !isAlreadyFollowing,
      followersCount: userToFollow.followers.length,
      followingCount: currentUser.following.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Follow failed', error: error.message });
  }
};

// @desc    Get followers list
// @route   GET /api/users/:id/followers
// @access  Private
const getFollowers = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('followers', 'name handle photos profilePhoto profileIcon verificationTier');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.followers || []);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get following list
// @route   GET /api/users/:id/following
// @access  Private
const getFollowing = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('following', 'name handle photos profilePhoto profileIcon verificationTier');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.following || []);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Search users
// @route   GET /api/users/search?q=query
// @access  Private
const searchUsers = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.json([]);
    }

    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { handle: { $regex: query, $options: 'i' } },
      ],
    })
      .select('name handle photos profilePhoto profileIcon verificationTier bio isPremium')
      .limit(20);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
};

// @desc    Get all users for the map
// @route   GET /api/users/map
// @access  Private
const getUsersForMap = async (req, res) => {
  const users = await User.find({
    'location.lat': { $ne: null }
  }).select('name handle photos profilePhoto location nomadCategory nextStop verificationTier profileIcon');
  res.json(users);
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    if (req.body.password) {
      user.password = req.body.password;
    }
    user.bio = req.body.bio || user.bio;
    user.location = req.body.location || user.location;
    user.nomadCategory = req.body.nomadCategory || user.nomadCategory;
    user.nextStop = req.body.nextStop || user.nextStop;
    user.vanInfo = req.body.vanInfo || user.vanInfo;

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      handle: updatedUser.handle,
      nomadCategory: updatedUser.nomadCategory,
      photos: updatedUser.photos,
      location: updatedUser.location,
      nextStop: updatedUser.nextStop,
      myInviteCode: updatedUser.myInviteCode
    });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Get notifications for the logged-in user
// @route   GET /api/users/notifications
// @access  Private
const getNotifications = async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .populate('sender', 'name handle photos profilePhoto profileIcon')
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(notifications);
};

// @desc    Update current user's location
// @route   PUT /api/users/location
// @access  Private
const updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) {
      return res.status(400).json({ message: 'lat and lng are required' });
    }
    await User.findByIdAndUpdate(req.user._id, { location: { lat, lng } });
    res.json({ message: 'Location updated' });
  } catch (err) {
    console.error('updateLocation error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Toggle location sharing with other nomads
// @route   PUT /api/users/share-location
// @access  Private
const toggleLocationSharing = async (req, res) => {
  try {
    const { shareLocation } = req.body;
    await User.findByIdAndUpdate(req.user._id, { shareLocation: !!shareLocation });
    res.json({ shareLocation: !!shareLocation });
  } catch (err) {
    console.error('toggleLocationSharing error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all users for map (only those who share location)
// @route   GET /api/users/map
// @access  Private
const getUsersForMapFiltered = async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user._id },
      'location.lat': { $ne: null },
      shareLocation: { $ne: false },
    }).select('name handle photos profilePhoto location nomadCategory nextStop verificationTier profileIcon bio');
    res.json(users);
  } catch (err) {
    console.error('getUsersForMapFiltered error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export { getUserProfile, getPublicProfile, followUser, getFollowers, getFollowing, searchUsers, updateUserProfile, getUsersForMap, getNotifications, updateLocation, toggleLocationSharing, getUsersForMapFiltered };
