import Adventure from '../models/Adventure.js';
import User from '../models/User.js';

// @desc    Create a new adventure
// @route   POST /api/adventures
// @access  Private
const createAdventure = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Free users: 1 adventure per month
        if (!user.isPremium) {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const count = await Adventure.countDocuments({
                creator: user._id,
                createdAt: { $gte: startOfMonth }
            });

            if (count >= 1) {
                return res.status(403).json({
                    message: 'Free users can create 1 adventure per month. Upgrade to Premium for unlimited!',
                    isPremiumRequired: true,
                    limit: 1,
                    used: count,
                });
            }
        }

        const { title, description, emoji, category, location, dateTime, maxParticipants } = req.body;

        const adventure = await Adventure.create({
            creator: req.user._id,
            title,
            description,
            emoji: emoji || '🏕️',
            category: category || 'Other',
            location: location || {},
            dateTime,
            maxParticipants: maxParticipants || 6,
            participants: [{ user: req.user._id }], // Creator auto-joins
        });

        const populated = await adventure.populate('creator', 'name handle photos profilePhoto profileIcon');
        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all adventures (with optional category filter)
// @route   GET /api/adventures
// @access  Private
const getAdventures = async (req, res) => {
    try {
        const { category } = req.query;
        const filter = { isActive: true, dateTime: { $gte: new Date() } };
        if (category && category !== 'All') {
            filter.category = category;
        }

        const adventures = await Adventure.find(filter)
            .populate('creator', 'name handle photos profilePhoto profileIcon')
            .populate('participants.user', 'name photos profilePhoto profileIcon')
            .sort({ dateTime: 1 });

        res.json(adventures);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get single adventure detail
// @route   GET /api/adventures/:id
// @access  Private
const getAdventure = async (req, res) => {
    try {
        const adventure = await Adventure.findById(req.params.id)
            .populate('creator', 'name handle photos profilePhoto profileIcon bio')
            .populate('participants.user', 'name handle photos profilePhoto profileIcon');

        if (!adventure) return res.status(404).json({ message: 'Adventure not found' });
        res.json(adventure);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Join an adventure
// @route   POST /api/adventures/:id/join
// @access  Private
const joinAdventure = async (req, res) => {
    try {
        const adventure = await Adventure.findById(req.params.id);
        if (!adventure) return res.status(404).json({ message: 'Adventure not found' });

        const activeParticipants = adventure.participants.filter(p => p.status === 'joined');

        // Check if already joined
        const alreadyJoined = activeParticipants.find(
            p => p.user.toString() === req.user._id.toString()
        );
        if (alreadyJoined) {
            return res.status(400).json({ message: 'You have already joined this adventure' });
        }

        // Check capacity
        if (activeParticipants.length >= adventure.maxParticipants) {
            return res.status(400).json({ message: 'Adventure is full' });
        }

        adventure.participants.push({ user: req.user._id });
        await adventure.save();

        const populated = await adventure
            .populate('creator', 'name handle photos profilePhoto profileIcon')
            .then(a => a.populate('participants.user', 'name handle photos profilePhoto profileIcon'));

        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Leave an adventure
// @route   POST /api/adventures/:id/leave
// @access  Private
const leaveAdventure = async (req, res) => {
    try {
        const adventure = await Adventure.findById(req.params.id);
        if (!adventure) return res.status(404).json({ message: 'Adventure not found' });

        const participantIdx = adventure.participants.findIndex(
            p => p.user.toString() === req.user._id.toString() && p.status === 'joined'
        );
        if (participantIdx === -1) {
            return res.status(400).json({ message: 'You are not in this adventure' });
        }

        // Creator cannot leave
        if (adventure.creator.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: 'Creator cannot leave the adventure' });
        }

        adventure.participants[participantIdx].status = 'cancelled';
        await adventure.save();

        res.json({ message: 'Left adventure successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get my created adventures
// @route   GET /api/adventures/my
// @access  Private
const getMyAdventures = async (req, res) => {
    try {
        const adventures = await Adventure.find({ creator: req.user._id })
            .populate('participants.user', 'name handle photos profilePhoto profileIcon')
            .sort({ createdAt: -1 });

        res.json(adventures);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export { createAdventure, getAdventures, getAdventure, joinAdventure, leaveAdventure, getMyAdventures };
