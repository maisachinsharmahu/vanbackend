import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    chatRoomId: {
        type: String, // Or ObjectId of Match
        required: true,
        index: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    type: {
        type: String,
        enum: ['text', 'image', 'location'],
        default: 'text'
    },
    attachmentUrl: String,

}, {
    timestamps: true // createdAt => send time
});

const Message = mongoose.model('Message', messageSchema);
export default Message;
