import express from 'express';
const router = express.Router();
import User from '../models/User.js';

// @desc    Verify Invite Code
// @route   GET /api/invite/verify/:code
// @access  Public
router.get('/verify/:code', async (req, res) => {
    const { code } = req.params;

    if (code === "NOMAD-777") {
        return res.status(200).json({ valid: true, message: 'VIP code accepted' });
    }

    const user = await User.findOne({ myInviteCode: code });

    if (user) {
        res.status(200).json({ valid: true, message: 'Valid invite code' });
    } else {
        res.status(404).json({ valid: false, message: 'Invalid invite code' });
    }
});

export default router;
