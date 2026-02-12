import Expert from '../models/Expert.js';

// @desc    Get all experts
// @route   GET /api/experts
// @access  Private
const getExperts = async (req, res) => {
  const experts = await Expert.find({}).populate('user', 'name photos location');
  res.json(experts);
};

// @desc    Get expert by ID
// @route   GET /api/experts/:id
// @access  Private
const getExpertById = async (req, res) => {
  // Use 'name photos bio' without 'id' if it causes issues, but _id is default
  const expert = await Expert.findById(req.params.id).populate('user', 'name photos bio');

  if (expert) {
    res.json(expert);
  } else {
    res.status(404).json({ message: 'Expert not found' });
  }
};

export { getExperts, getExpertById };
