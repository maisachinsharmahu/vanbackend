import mongoose from 'mongoose';

const nomadLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    date: {
        type: String, // "YYYY-MM-DD"
        required: true,
    },
    title: { type: String, default: '' },
    notes: { type: String, default: '' },
    location: {
        name: { type: String, default: '' },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
    },
    createdAt: { type: Date, default: Date.now },
});

// One log per user per day
nomadLogSchema.index({ user: 1, date: 1 }, { unique: true });

const NomadLog = mongoose.model('NomadLog', nomadLogSchema);
export default NomadLog;
