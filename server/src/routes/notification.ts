import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notification';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getNotifications);
router.patch('/read-all', authenticate, markAllAsRead);
router.patch('/:id/read', authenticate, markAsRead);

export default router;
