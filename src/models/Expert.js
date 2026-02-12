import mongoose from 'mongoose';

const expertSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true // One expert profile per user
    },
    title: { type: String, default: '' }, // e.g., "Solar & Electrical Specialist"
    description: { type: String, default: '' }, // Long bio about their expertise
    skills: [{ type: String }], // e.g., 'Solar', 'Plumbing', 'Carpentry'
    hourlyRate: { type: Number, default: 0 },
    rating: { type: Number, default: 5.0 },
    reviewsCount: { type: Number, default: 0 },
    portfolio: [{ type: String }], // URLs to images of past work
    isVerified: { type: Boolean, default: false },
    availability: { type: String, default: 'Available' },
    yearsExperience: { type: Number, default: 0 },

    createdAt: { type: Date, default: Date.now }
});

const Expert = mongoose.model('Expert', expertSchema);
export default Expert;
