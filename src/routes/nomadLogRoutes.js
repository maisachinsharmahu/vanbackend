import express from 'express';
const router = express.Router();
import { getMyLogs, upsertLog, deleteLog } from '../controllers/nomadLogController.js';
import { protect } from '../middleware/authMiddleware.js';

router.route('/').get(protect, getMyLogs).put(protect, upsertLog);
router.route('/:id').delete(protect, deleteLog);

export default router;
