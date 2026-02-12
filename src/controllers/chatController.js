import Message from '../models/Message.js';
import Match from '../models/Match.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { checkPremiumLimit } from './premiumController.js';

// @desc    Get messages for a conversation
// @route   GET /api/chat/:roomId
// @access  Private
const getMessages = async (req, res) => {
  try {
    const pageSize = 30;
    const page = Number(req.query.pageNumber) || 1;

    const messages = await Message.find({ chatRoomId: req.params.roomId })
      .populate('sender', 'name photos profilePhoto profileIcon handle')
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    res.json(messages.reverse()); // Return chronological order
  } catch (error) {
    console.error('getMessages error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Send a message
// @route   POST /api/chat
// @access  Private
const sendMessage = async (req, res) => {
  // Check if free user is trying to message
  const senderUser = await User.findById(req.user._id).select('isPremium');
  if (!senderUser?.isPremium) {
    return res.status(403).json({
      message: 'Messaging is a Premium feature. Upgrade to connect with other nomads!',
      isPremiumRequired: true,
    });
  }

  const { chatRoomId, content, type, receiverId } = req.body;

  const message = await Message.create({
    chatRoomId,
    sender: req.user._id,
    content,
    type: type || 'text',
  });

  if (message) {
    const populated = await message.populate('sender', 'name photos profilePhoto profileIcon handle');

    if (receiverId) {
      await Notification.create({
        recipient: receiverId,
        sender: req.user._id,
        type: 'message',
        content: `New message from ${req.user.name}`,
        relatedId: message._id,
      });
    }

    res.status(201).json(populated);
  } else {
    res.status(400).json({ message: 'Invalid message data' });
  }
};

// @desc    Get all chat threads for the user
// @route   GET /api/chat/threads
// @access  Private
const getChatThreads = async (req, res) => {
  try {
    const userId = req.user._id;

    // ── Auto-fix: migrate messages with empty chatRoomId ──
    // These were created before the room-ID generation fix.
    const orphanMessages = await Message.find({
      sender: userId,
      $or: [{ chatRoomId: '' }, { chatRoomId: { $exists: false } }],
    }).select('_id sender createdAt');

    if (orphanMessages.length > 0) {
      // Find all messages in the same time-frame to figure out the receiver
      for (const om of orphanMessages) {
        // Try to find a notification that references this message to get the receiver
        const notif = await Notification.findOne({ relatedId: om._id, type: 'message' });
        if (notif && notif.recipient) {
          const ids = [userId.toString(), notif.recipient.toString()].sort();
          const correctRoomId = `dm_${ids[0]}_${ids[1]}`;
          await Message.updateOne({ _id: om._id }, { chatRoomId: correctRoomId });
        }
      }
    }

    // Find all unique chatRoomIds where user sent or received messages
    const sentRooms = await Message.find({ sender: userId }).distinct('chatRoomId');

    // Also find rooms where user is in the chatRoomId (format: `dm_<id1>_<id2>`)
    const allMessages = await Message.find({
      chatRoomId: { $regex: userId.toString() },
    }).distinct('chatRoomId');

    // Merge & filter out empty/invalid room IDs
    const allRoomIds = [...new Set([...sentRooms, ...allMessages])]
      .filter(id => id && id.startsWith('dm_'));

    // For each room, get the last message and the other user
    const threads = [];
    for (const roomId of allRoomIds) {
      const lastMessage = await Message.findOne({ chatRoomId: roomId })
        .populate('sender', 'name photos profilePhoto profileIcon handle')
        .sort({ createdAt: -1 });

      if (!lastMessage) continue;

      // Skip if sender couldn't be populated (deleted user)
      if (!lastMessage.sender) continue;

      // Extract other user ID from room ID (format: dm_userId1_userId2)
      const parts = roomId.split('_');
      let otherUserId = null;
      for (const part of parts) {
        if (part !== 'dm' && part !== userId.toString()) {
          otherUserId = part;
          break;
        }
      }

      let otherUser = null;
      if (otherUserId) {
        otherUser = await User.findById(otherUserId).select('name handle photos profilePhoto profileIcon');
      }

      const unreadCount = await Message.countDocuments({
        chatRoomId: roomId,
        sender: { $ne: userId },
        isRead: false,
      });

      threads.push({
        roomId,
        otherUser: otherUser ? {
          _id: otherUser._id,
          name: otherUser.name,
          handle: otherUser.handle,
          profilePhoto: otherUser.profilePhoto,
          profileIcon: otherUser.profileIcon,
          photos: [...new Set(otherUser.photos || [])],
        } : null,
        lastMessage: {
          content: lastMessage.content,
          type: lastMessage.type,
          sender: lastMessage.sender._id,
          createdAt: lastMessage.createdAt,
        },
        unreadCount,
      });
    }

    // Sort by most recent message
    threads.sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    res.json(threads);
  } catch (error) {
    console.error('getChatThreads error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Mark messages as read
// @route   PUT /api/chat/:roomId/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    await Message.updateMany(
      { chatRoomId: req.params.roomId, sender: { $ne: req.user._id }, isRead: false },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export { getMessages, sendMessage, getChatThreads, markAsRead };
