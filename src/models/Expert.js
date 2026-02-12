import mongoose from 'mongoose';

const expertSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true // One expert profile per user
    },
    skills: [{ type: String }], // e.g., 'Solar', 'Plumbing', 'Carpentry'
    hourlyRate: { type: Number, required: true },
    rating: { type: Number, default: 5.0 },
    reviewsCount: { type: Number, default: 0 },
    portfolio: [{ type: String }], // URLs to images of past work
    isVerified: { type: Boolean, default: false },
    availability: { type: String, default: 'Weekdays' },

    // Contact Info (Protected by Paywall on Frontend)
    email: String,
    phone: String,
    website: String,

    createdAt: { type: Date, default: Date.now }
});

const Expert = mongoose.model('Expert', expertSchema);
export default Expert;
