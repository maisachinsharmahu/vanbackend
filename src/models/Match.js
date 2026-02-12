import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }], // Contains exactly two users
    isAccepted: { type: Boolean, default: false }, // if matched

    // Track who swiped (for non-mutual state)
    swipes: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        action: { type: String, enum: ['like', 'dislike'] } // 'superlike'?
    }],

    // Is this a Dating match or Friends match?
    matchMode: {
        type: String,
        enum: ['dating', 'friends'],
        default: 'friends'
    },

    // Created when BOTH match
    matchedAt: { type: Date }
}, {
    timestamps: true
});

const Match = mongoose.model('Match', matchSchema);
export default Match;
