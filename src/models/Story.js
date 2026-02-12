import mongoose from 'mongoose';

const storySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    imageUrl: {
        type: String,
        required: true,
    },
    caption: {
        type: String,
        default: '',
        maxlength: 200,
    },
    viewers: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        viewedAt: { type: Date, default: Date.now },
    }],
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
}, {
    timestamps: true,
});

// TTL index — MongoDB auto-deletes expired stories
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for efficient feed queries
storySchema.index({ user: 1, createdAt: -1 });

const Story = mongoose.model('Story', storySchema);
export default Story;
