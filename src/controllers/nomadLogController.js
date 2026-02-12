import NomadLog from '../models/NomadLog.js';

// @desc    Get all nomad logs for current user (optionally by month)
// @route   GET /api/nomad-logs?month=2026-02
// @access  Private
const getMyLogs = async (req, res) => {
    try {
        const { month } = req.query; // "YYYY-MM"
        const filter = { user: req.user._id };
        if (month) {
            filter.date = { $regex: `^${month}` };
        }
        const logs = await NomadLog.find(filter).sort({ date: 1 }).lean();
        res.json(logs);
    } catch (err) {
        console.error('getMyLogs error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create or update a nomad log for a specific date
// @route   PUT /api/nomad-logs
// @access  Private
const upsertLog = async (req, res) => {
    try {
        const { date, title, notes, location } = req.body;
        if (!date || !location || location.lat == null || location.lng == null) {
            return res.status(400).json({ message: 'date and location (lat, lng) are required' });
        }

        const log = await NomadLog.findOneAndUpdate(
            { user: req.user._id, date },
            {
                user: req.user._id,
                date,
                title: title || '',
                notes: notes || '',
                location,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();

        res.json(log);
    } catch (err) {
        console.error('upsertLog error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Duplicate log for this date' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a nomad log
// @route   DELETE /api/nomad-logs/:id
// @access  Private
const deleteLog = async (req, res) => {
    try {
        const log = await NomadLog.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!log) {
            return res.status(404).json({ message: 'Log not found' });
        }
        res.json({ message: 'Log deleted' });
    } catch (err) {
        console.error('deleteLog error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

export { getMyLogs, upsertLog, deleteLog };
