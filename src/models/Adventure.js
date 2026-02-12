import mongoose from 'mongoose';

const adventureSchema = new mongoose.Schema({
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    emoji: { type: String, default: '🏕️' },
    category: {
        type: String,
        enum: ['Hiking', 'Surfing', 'Climbing', 'Photography', 'Fishing', 'Camping', 'Road Trip', 'Other'],
        default: 'Other'
    },
    location: {
        name: { type: String },
        lat: Number,
        lng: Number
    },
    dateTime: { type: Date, required: true },
    maxParticipants: { type: Number, default: 6 },
    participants: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        joinedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['joined', 'cancelled'], default: 'joined' }
    }],
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true
});

const Adventure = mongoose.model('Adventure', adventureSchema);
export default Adventure;
