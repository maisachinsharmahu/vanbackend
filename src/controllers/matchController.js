import Match from '../models/Match.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { checkPremiumLimit, incrementSwipe } from './premiumController.js';

// @desc    Get match suggestions based on mode
// @route   GET /api/match/suggestions
// @access  Private
const getSuggestions = async (req, res) => {
  try {
    const { mode } = req.query; // 'dating' or 'friends'

    // Exclude users already swiped on
    const swipedMatches = await Match.find({ users: req.user._id });
    const swipedUserIds = swipedMatches.flatMap(m =>
      m.users.filter(u => u.toString() !== req.user._id.toString()).map(u => u.toString())
    );

    // Build filter: only completed onboarding, not current user, not already swiped
    const filter = {
      _id: { $nin: [...swipedUserIds, req.user._id] },
      hasCompletedOnboarding: true,
    };

    // For dating mode, require at least one photo or a profile photo
    if (mode === 'dating') {
      filter.$or = [
        { photos: { $exists: true, $not: { $size: 0 } } },
        { profilePhoto: { $exists: true, $ne: null, $ne: '' } },
      ];
    }

    const suggestions = await User.find(filter)
      .select('name handle bio age photos profilePhoto profileIcon interests vanInfo isPremium hasCompletedOnboarding')
      .limit(20);

    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Swipe right (Like) or left (Dislike)
// @route   POST /api/match/swipe
// @access  Private
const swipe = async (req, res) => {
  const { targetUserId, action, mode } = req.body;

  // Check swipe limit for free users
  if (action === 'like') {
    const limitCheck = await checkPremiumLimit(req.user._id, 'swipe');
    if (!limitCheck.allowed) {
      return res.status(403).json({
        message: limitCheck.reason,
        isPremiumRequired: true,
        limit: limitCheck.limit,
        used: limitCheck.used,
      });
    }
  }

  // Check if a match record already exists between these two
  let match = await Match.findOne({
    users: { $all: [req.user._id, targetUserId] },
  });

  if (match) {
    if (match.isAccepted) {
      return res.json({ match: true, message: 'Already matched!' });
    }

    // Check if the other user already swiped Like
    const otherUserSwipe = match.swipes.find(
      (s) => s.user.toString() === targetUserId && s.action === 'like'
    );

    if (otherUserSwipe && action === 'like') {
      match.isAccepted = true;
      match.matchedAt = Date.now();
      match.swipes.push({ user: req.user._id, action });
      await match.save();

      // Notifications for BOTH users
      await Notification.create({
        recipient: targetUserId,
        sender: req.user._id,
        type: 'match',
        content: `It's a Match! You and ${req.user.name} are ready to connect.`,
        relatedId: match._id
      });

      await Notification.create({
        recipient: req.user._id,
        sender: targetUserId,
        type: 'match',
        content: `It's a Match! You and the nomadic traveler are ready to connect.`,
        relatedId: match._id
      });

      return res.json({ isMatch: true, message: "It's a Match!", matchId: match._id });
    } else {
      // Just update our swipe
      const mySwipeIndex = match.swipes.findIndex(s => s.user.toString() === req.user._id.toString());
      if (mySwipeIndex > -1) {
        match.swipes[mySwipeIndex].action = action;
      } else {
        match.swipes.push({ user: req.user._id, action });
      }
      await match.save();
    }
  } else {
    // Create new potential match record
    match = new Match({
      users: [req.user._id, targetUserId],
      matchMode: mode || 'dating',
      swipes: [{ user: req.user._id, action }],
    });
    await match.save();
  }

  // Increment swipe counter for free users
  if (action === 'like') {
    await incrementSwipe(req.user._id);
  }

  res.json({ isMatch: false });
};

// @desc    Get all accepted matches
// @route   GET /api/match
// @access  Private
const getMatches = async (req, res) => {
  const matches = await Match.find({
    users: req.user._id,
    isAccepted: true,
  }).populate('users', 'name photos nomadCategory location bio profilePhoto profileIcon handle');

  res.json(matches);
};

// @desc    Get my likes status (who I liked, who liked me, pending, accepted, rejected)
// @route   GET /api/match/likes
// @access  Private
const getMyLikes = async (req, res) => {
  try {
    const userId = req.user._id;

    // Matches where I swiped like
    const myLikes = await Match.find({
      'swipes.user': userId,
      'swipes': { $elemMatch: { user: userId, action: 'like' } }
    }).populate('users', 'name photos profilePhoto profileIcon handle bio age');

    // Categorize
    const accepted = [];
    const pending = [];
    const rejected = [];

    for (const match of myLikes) {
      const otherUser = match.users.find(u => u._id.toString() !== userId.toString());
      if (!otherUser) continue;

      const otherSwipe = match.swipes.find(s => s.user.toString() !== userId.toString());

      const entry = {
        matchId: match._id,
        user: otherUser,
        matchedAt: match.matchedAt,
        createdAt: match.createdAt,
      };

      if (match.isAccepted) {
        accepted.push(entry);
      } else if (otherSwipe && otherSwipe.action === 'dislike') {
        rejected.push(entry);
      } else {
        pending.push(entry);
      }
    }

    res.json({ accepted, pending, rejected });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get who liked me (incoming likes)
// @route   GET /api/match/incoming
// @access  Private
const getIncomingLikes = async (req, res) => {
  try {
    const userId = req.user._id;

    // Matches where OTHER user swiped like on me, and I haven't responded yet
    const incoming = await Match.find({
      users: userId,
      isAccepted: false,
      'swipes': {
        $elemMatch: { user: { $ne: userId }, action: 'like' }
      }
    }).populate('users', 'name photos profilePhoto profileIcon handle bio age');

    const results = [];
    for (const match of incoming) {
      // Check if I already swiped
      const mySwipe = match.swipes.find(s => s.user.toString() === userId.toString());
      if (mySwipe) continue; // I already responded

      const otherUser = match.users.find(u => u._id.toString() !== userId.toString());
      if (!otherUser) continue;

      results.push({
        matchId: match._id,
        user: otherUser,
        createdAt: match.createdAt,
      });
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Respond to an incoming like (accept or reject)
// @route   PUT /api/match/:matchId/respond
// @access  Private
const respondToLike = async (req, res) => {
  try {
    const { action } = req.body; // 'like' or 'dislike'
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });

    // Verify user is part of this match
    if (!match.users.some(u => u.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    match.swipes.push({ user: req.user._id, action });

    if (action === 'like') {
      match.isAccepted = true;
      match.matchedAt = Date.now();

      const otherUserId = match.users.find(u => u.toString() !== req.user._id.toString());
      await Notification.create({
        recipient: otherUserId,
        sender: req.user._id,
        type: 'match',
        content: `It's a Match! You and ${req.user.name} are ready to connect.`,
        relatedId: match._id
      });
    }

    await match.save();

    res.json({
      isMatch: action === 'like',
      matchId: match._id,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get dating matches with chat info (for DateChat section)
// @route   GET /api/match/dating-chats
// @access  Private
const getDatingChats = async (req, res) => {
  try {
    const userId = req.user._id;

    const matches = await Match.find({
      users: userId,
      isAccepted: true,
      matchMode: 'dating',
    }).populate('users', 'name photos profilePhoto profileIcon handle bio age');

    // For each match, get the last message from dating room
    const Message = (await import('../models/Message.js')).default;
    const results = [];

    for (const match of matches) {
      const otherUser = match.users.find(u => u._id.toString() !== userId.toString());
      if (!otherUser) continue;

      const roomId = `date_${[userId.toString(), otherUser._id.toString()].sort().join('_')}`;

      const lastMessage = await Message.findOne({ chatRoomId: roomId })
        .sort({ createdAt: -1 });

      const unreadCount = await Message.countDocuments({
        chatRoomId: roomId,
        sender: { $ne: userId },
        isRead: false,
      });

      results.push({
        matchId: match._id,
        otherUser: {
          _id: otherUser._id,
          name: otherUser.name,
          handle: otherUser.handle,
          photos: otherUser.photos,
          profilePhoto: otherUser.profilePhoto,
          profileIcon: otherUser.profileIcon,
        },
        roomId,
        matchedAt: match.matchedAt,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          createdAt: lastMessage.createdAt,
          sender: lastMessage.sender,
        } : null,
        unreadCount,
      });
    }

    // Sort by last message or match date
    results.sort((a, b) => {
      const aDate = a.lastMessage?.createdAt || a.matchedAt;
      const bDate = b.lastMessage?.createdAt || b.matchedAt;
      return new Date(bDate) - new Date(aDate);
    });

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export { getSuggestions, swipe, getMatches, getMyLikes, getIncomingLikes, respondToLike, getDatingChats };
