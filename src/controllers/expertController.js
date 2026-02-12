import Expert from '../models/Expert.js';

// @desc    Get all experts (with optional skill filter)
// @route   GET /api/experts?skill=Solar
// @access  Private
const getExperts = async (req, res) => {
  try {
    const { skill } = req.query;
    const filter = skill ? { skills: { $in: [skill] } } : {};
    const experts = await Expert.find(filter)
      .populate('user', 'name photos location bio')
      .sort({ rating: -1, createdAt: -1 })
      .lean();
    res.json(experts);
  } catch (err) {
    console.error('getExperts error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get expert by ID
// @route   GET /api/experts/:id
// @access  Private
const getExpertById = async (req, res) => {
  try {
    const expert = await Expert.findById(req.params.id)
      .populate('user', 'name photos location bio')
      .lean();
    if (!expert) {
      return res.status(404).json({ message: 'Expert not found' });
    }
    res.json(expert);
  } catch (err) {
    console.error('getExpertById error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get current user's expert/builder profile
// @route   GET /api/experts/me/profile
// @access  Private
const getMyExpertProfile = async (req, res) => {
  try {
    const expert = await Expert.findOne({ user: req.user._id })
      .populate('user', 'name photos location bio')
      .lean();
    if (!expert) {
      return res.json(null); // Not a builder yet — that's fine
    }
    res.json(expert);
  } catch (err) {
    console.error('getMyExpertProfile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Register as expert/builder
// @route   POST /api/experts/register
// @access  Private
const registerAsExpert = async (req, res) => {
  try {
    // Check if already registered
    const existing = await Expert.findOne({ user: req.user._id });
    if (existing) {
      return res.status(400).json({ message: 'Already registered as a builder' });
    }

    const { title, description, skills, hourlyRate, yearsExperience, availability } = req.body;

    if (!skills || skills.length === 0) {
      return res.status(400).json({ message: 'At least one skill is required' });
    }

    const expert = await Expert.create({
      user: req.user._id,
      title: title || '',
      description: description || '',
      skills,
      hourlyRate: hourlyRate || 0,
      yearsExperience: yearsExperience || 0,
      availability: availability || 'Available',
    });

    const populated = await Expert.findById(expert._id)
      .populate('user', 'name photos location bio')
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    console.error('registerAsExpert error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Already registered as a builder' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update expert/builder profile
// @route   PUT /api/experts/me/profile
// @access  Private
const updateExpertProfile = async (req, res) => {
  try {
    const expert = await Expert.findOne({ user: req.user._id });
    if (!expert) {
      return res.status(404).json({ message: 'Builder profile not found' });
    }

    const { title, description, skills, hourlyRate, yearsExperience, availability, portfolio } = req.body;

    if (title !== undefined) expert.title = title;
    if (description !== undefined) expert.description = description;
    if (skills !== undefined) expert.skills = skills;
    if (hourlyRate !== undefined) expert.hourlyRate = hourlyRate;
    if (yearsExperience !== undefined) expert.yearsExperience = yearsExperience;
    if (availability !== undefined) expert.availability = availability;
    if (portfolio !== undefined) expert.portfolio = portfolio;

    await expert.save();

    const populated = await Expert.findById(expert._id)
      .populate('user', 'name photos location bio')
      .lean();

    res.json(populated);
  } catch (err) {
    console.error('updateExpertProfile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export { getExperts, getExpertById, getMyExpertProfile, registerAsExpert, updateExpertProfile };
