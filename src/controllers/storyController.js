import Story from '../models/Story.js';
import User from '../models/User.js';
import { uploadToGCS, deleteFromGCS } from '../utils/gcsUpload.js';

// @desc    Create a story (image upload)
// @route   POST /api/stories
// @access  Private
const createStory = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Image is required' });
        }

        const imageUrl = await uploadToGCS(
            req.file.buffer,
            req.file.originalname,
            `stories/${req.user._id}`,
            req.file.mimetype
        );

        const story = await Story.create({
            user: req.user._id,
            imageUrl,
            caption: req.body.caption || '',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        const populated = await Story.findById(story._id)
            .populate('user', 'name handle photos profilePhoto profileIcon verificationTier isPremium');

        // Emit real-time event
        req.app.get('io').emit('new_story', {
            storyId: populated._id,
            userId: req.user._id,
            userName: req.user.name,
        });

        res.status(201).json(populated);
    } catch (error) {
        console.error('Create story error:', error);
        res.status(500).json({ message: 'Failed to create story', error: error.message });
    }
};

// @desc    Get all active stories (grouped by user, sorted: own first, then recent)
// @route   GET /api/stories
// @access  Private
const getStories = async (req, res) => {
    try {
        const now = new Date();

        // Fetch all non-expired stories, newest first
        const stories = await Story.find({ expiresAt: { $gt: now } })
            .populate('user', 'name handle photos profilePhoto profileIcon verificationTier isPremium')
            .sort({ createdAt: -1 });

        // Group by user
        const grouped = {};
        for (const story of stories) {
            const userId = story.user._id.toString();
            if (!grouped[userId]) {
                grouped[userId] = {
                    user: story.user,
                    stories: [],
                    latestAt: story.createdAt,
                    hasUnviewed: false,
                };
            }
            grouped[userId].stories.push(story);

            // Check if current user has viewed this story
            const viewed = story.viewers.some(
                v => v.user.toString() === req.user._id.toString()
            );
            if (!viewed) {
                grouped[userId].hasUnviewed = true;
            }
        }

        // Convert to array and sort: own stories first, then by latest story time
        const currentUserId = req.user._id.toString();
        const result = Object.values(grouped).sort((a, b) => {
            const aIsMe = a.user._id.toString() === currentUserId ? -1 : 0;
            const bIsMe = b.user._id.toString() === currentUserId ? -1 : 0;
            if (aIsMe !== bIsMe) return aIsMe - bIsMe;
            // Unviewed stories first
            if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
            return new Date(b.latestAt) - new Date(a.latestAt);
        });

        res.json(result);
    } catch (error) {
        console.error('Get stories error:', error);
        res.status(500).json({ message: 'Failed to fetch stories', error: error.message });
    }
};

// @desc    Get stories for a specific user
// @route   GET /api/stories/user/:userId
// @access  Private
const getUserStories = async (req, res) => {
    try {
        const now = new Date();
        const stories = await Story.find({
            user: req.params.userId,
            expiresAt: { $gt: now },
        })
            .populate('user', 'name handle photos profilePhoto profileIcon verificationTier isPremium')
            .sort({ createdAt: -1 });

        res.json(stories);
    } catch (error) {
        res.status(500).json({ message: 'Failed to get user stories', error: error.message });
    }
};

// @desc    Mark a story as viewed
// @route   PUT /api/stories/:id/view
// @access  Private
const viewStory = async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);
        if (!story) {
            return res.status(404).json({ message: 'Story not found' });
        }

        // Don't add duplicate view
        const alreadyViewed = story.viewers.some(
            v => v.user.toString() === req.user._id.toString()
        );
        if (!alreadyViewed) {
            story.viewers.push({ user: req.user._id });
            await story.save();
        }

        res.json({ viewCount: story.viewers.length });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark view', error: error.message });
    }
};

// @desc    Delete own story
// @route   DELETE /api/stories/:id
// @access  Private
const deleteStory = async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);
        if (!story) {
            return res.status(404).json({ message: 'Story not found' });
        }
        if (story.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Delete image from GCS
        if (story.imageUrl) {
            await deleteFromGCS(story.imageUrl);
        }

        await Story.findByIdAndDelete(req.params.id);
        res.json({ message: 'Story deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete story', error: error.message });
    }
};

// @desc    Get viewers of a story (own stories only)
// @route   GET /api/stories/:id/viewers
// @access  Private
const getStoryViewers = async (req, res) => {
    try {
        const story = await Story.findById(req.params.id)
            .populate('viewers.user', 'name handle photos profilePhoto profileIcon verificationTier');

        if (!story) {
            return res.status(404).json({ message: 'Story not found' });
        }
        if (story.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json({
            viewCount: story.viewers.length,
            viewers: story.viewers,
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to get viewers', error: error.message });
    }
};

export {
    createStory,
    getStories,
    getUserStories,
    viewStory,
    deleteStory,
    getStoryViewers,
};
