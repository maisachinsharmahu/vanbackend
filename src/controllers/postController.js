import Post from '../models/Post.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { uploadToGCS } from '../utils/gcsUpload.js';
import { checkPremiumLimit } from './premiumController.js';

// @desc    Get all posts (feed) - premium posts shown first
// @route   GET /api/posts
// @access  Public
const getPosts = async (req, res) => {
  try {
    const pageSize = 10;
    const page = Number(req.query.pageNumber) || 1;

    const count = await Post.countDocuments({});

    // Get all premium user IDs for priority sorting
    const premiumUsers = await User.find({ isPremium: true }).select('_id');
    const premiumIds = premiumUsers.map(u => u._id);

    // Fetch posts with premium priority: premium authors first, then by date
    const posts = await Post.aggregate([
      {
        $addFields: {
          isPremiumAuthor: { $cond: { if: { $in: ['$author', premiumIds] }, then: 1, else: 0 } }
        }
      },
      { $sort: { isPremiumAuthor: -1, createdAt: -1 } },
      { $skip: pageSize * (page - 1) },
      { $limit: pageSize },
    ]);

    // Populate the aggregated results
    const populatedPosts = await Post.populate(posts, [
      { path: 'author', select: 'name handle photos profilePhoto verificationTier profileIcon isPremium' },
      { path: 'comments.user', select: 'name handle photos profilePhoto profileIcon verificationTier isPremium' },
    ]);

    // Sort comments: premium users' comments first within each post
    for (const post of populatedPosts) {
      if (post.comments && post.comments.length > 0) {
        post.comments.sort((a, b) => {
          const aIsPremium = a.user?.isPremium ? 1 : 0;
          const bIsPremium = b.user?.isPremium ? 1 : 0;
          if (bIsPremium !== aIsPremium) return bIsPremium - aIsPremium;
          return new Date(b.postedAt) - new Date(a.postedAt);
        });
      }
    }

    res.json({ posts: populatedPosts, page, pages: Math.ceil(count / pageSize) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single post by ID
// @route   GET /api/posts/:id
// @access  Public
const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'name handle photos profilePhoto verificationTier profileIcon')
      .populate('comments.user', 'name handle photos profilePhoto profileIcon');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get posts by user ID (free users see max 3 on profiles)
// @route   GET /api/posts/user/:userId
// @access  Public
const getUserPosts = async (req, res) => {
  try {
    const pageSize = 10;
    const page = Number(req.query.pageNumber) || 1;

    // Check if requesting user is premium
    let viewerIsPremium = false;
    if (req.user) {
      const viewer = await User.findById(req.user._id).select('isPremium');
      viewerIsPremium = viewer?.isPremium || false;
    }

    const count = await Post.countDocuments({ author: req.params.userId });

    // Free users can only see 3 posts on other user profiles
    const effectiveLimit = viewerIsPremium ? pageSize : Math.min(3, pageSize);

    const posts = await Post.find({ author: req.params.userId })
      .populate('author', 'name handle photos profilePhoto verificationTier profileIcon isPremium')
      .populate('comments.user', 'name handle photos profilePhoto profileIcon verificationTier isPremium')
      .sort({ createdAt: -1 })
      .limit(effectiveLimit)
      .skip(viewerIsPremium ? pageSize * (page - 1) : 0);

    res.json({
      posts,
      page,
      pages: Math.ceil(count / (viewerIsPremium ? pageSize : 3)),
      totalCount: count,
      limitedView: !viewerIsPremium && count > 3,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create a post (with optional image upload)
// @route   POST /api/posts
// @access  Private
const createPost = async (req, res) => {
  try {
    // Check post limit for free users
    const limitCheck = await checkPremiumLimit(req.user._id, 'create_post');
    if (!limitCheck.allowed) {
      return res.status(403).json({
        message: limitCheck.reason,
        isPremiumRequired: true,
        limit: limitCheck.limit,
        used: limitCheck.used,
      });
    }

    const { content, imageUrl, location } = req.body;

    let finalImageUrl = imageUrl;

    // If file was uploaded via multer
    if (req.file) {
      finalImageUrl = await uploadToGCS(
        req.file.buffer,
        req.file.originalname,
        `posts/${req.user._id}`,
        req.file.mimetype
      );
    }

    const post = new Post({
      author: req.user._id,
      content,
      imageUrl: finalImageUrl,
      location,
    });

    const createdPost = await post.save();

    // Populate author before returning
    const populatedPost = await Post.findById(createdPost._id)
      .populate('author', 'name handle photos profilePhoto verificationTier profileIcon');

    // Increment user's post count
    await User.findByIdAndUpdate(req.user._id, { $inc: { totalPostCount: 1 } });

    res.status(201).json(populatedPost);
  } catch (error) {
    res.status(500).json({ message: 'Create post failed', error: error.message });
  }
};

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to delete this post' });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Delete failed', error: error.message });
  }
};

// @desc    Like/unlike a post
// @route   PUT /api/posts/:id/like
// @access  Private
const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const isLiked = post.likes.includes(req.user._id);

    if (isLiked) {
      post.likes = post.likes.filter(
        (id) => id.toString() !== req.user._id.toString()
      );
    } else {
      post.likes.push(req.user._id);

      // Create notification for post owner
      if (post.author.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: post.author,
          sender: req.user._id,
          type: 'like',
          content: `liked your post`,
          relatedId: post._id
        });
      }
    }
    await post.save();

    // Emit real-time like update via socket
    if (req.app.get('io')) {
      req.app.get('io').emit('post_like_update', {
        postId: post._id,
        likes: post.likes,
        userId: req.user._id,
        action: isLiked ? 'unlike' : 'like',
      });
    }

    res.json({ likes: post.likes, isLiked: !isLiked });
  } catch (error) {
    res.status(500).json({ message: 'Like failed', error: error.message });
  }
};

// @desc    Comment on a post
// @route   POST /api/posts/:id/comment
// @access  Private
const commentPost = async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = {
      text,
      user: req.user._id,
      postedAt: Date.now(),
    };

    post.comments.push(comment);
    await post.save();

    // Populate the comments with user info before returning
    const updatedPost = await Post.findById(post._id)
      .populate('comments.user', 'name handle photos profilePhoto profileIcon');

    // Emit real-time comment update via socket
    if (req.app.get('io')) {
      req.app.get('io').emit('post_comment_update', {
        postId: post._id,
        comments: updatedPost.comments,
      });
    }

    // Create notification for post owner
    if (post.author.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: post.author,
        sender: req.user._id,
        type: 'comment',
        content: `commented on your post`,
        relatedId: post._id
      });
    }

    res.status(201).json(updatedPost.comments);
  } catch (error) {
    res.status(500).json({ message: 'Comment failed', error: error.message });
  }
};

// @desc    Delete a comment
// @route   DELETE /api/posts/:id/comment/:commentId
// @access  Private
const deleteComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Only comment author or post author can delete
    if (comment.user.toString() !== req.user._id.toString() &&
      post.author.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    post.comments.pull(req.params.commentId);
    await post.save();

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Delete comment failed', error: error.message });
  }
};

// @desc    Edit a comment
// @route   PUT /api/posts/:id/comment/:commentId
// @access  Private
const editComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Only comment author can edit
    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to edit this comment' });
    }

    comment.text = req.body.text;
    await post.save();

    res.json({ message: 'Comment updated', comment });
  } catch (error) {
    res.status(500).json({ message: 'Edit comment failed', error: error.message });
  }
};

// @desc    Edit a post
// @route   PUT /api/posts/:id
// @access  Private
const editPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to edit this post' });
    }

    const { content, location } = req.body;
    if (content !== undefined) post.content = content;
    if (location !== undefined) post.location = location;

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate('author', 'name handle photos profilePhoto verificationTier profileIcon isPremium')
      .populate('comments.user', 'name handle photos profilePhoto profileIcon verificationTier isPremium');

    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: 'Edit post failed', error: error.message });
  }
};

// @desc    Bookmark/unbookmark a post
// @route   PUT /api/posts/:id/bookmark
// @access  Private
const bookmarkPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (!post.bookmarks) post.bookmarks = [];

    const isBookmarked = post.bookmarks.includes(req.user._id);
    if (isBookmarked) {
      post.bookmarks = post.bookmarks.filter(
        (id) => id.toString() !== req.user._id.toString()
      );
    } else {
      post.bookmarks.push(req.user._id);
    }
    await post.save();
    res.json({ bookmarks: post.bookmarks, isBookmarked: !isBookmarked });
  } catch (error) {
    res.status(500).json({ message: 'Bookmark failed', error: error.message });
  }
};

// @desc    Get bookmarked posts for current user
// @route   GET /api/posts/bookmarked
// @access  Private
const getBookmarkedPosts = async (req, res) => {
  try {
    const posts = await Post.find({ bookmarks: req.user._id })
      .populate('author', 'name handle photos profilePhoto verificationTier profileIcon isPremium')
      .populate('comments.user', 'name handle photos profilePhoto profileIcon verificationTier isPremium')
      .sort({ createdAt: -1 });

    res.json({ posts });
  } catch (error) {
    res.status(500).json({ message: 'Get bookmarks failed', error: error.message });
  }
};

export { getPosts, getPostById, getUserPosts, createPost, editPost, deletePost, likePost, bookmarkPost, getBookmarkedPosts, commentPost, deleteComment, editComment };
