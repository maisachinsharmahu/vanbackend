import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: { type: String, required: true },
    imageUrl: { type: String }, // Single Image for MVP
    location: { type: String }, // "Big Sur, CA" - location tag

    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    comments: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: String,
        postedAt: { type: Date, default: Date.now }
    }],
}, {
    timestamps: true // adds createdAt, updatedAt
});

const Post = mongoose.model('Post', postSchema);
export default Post;
