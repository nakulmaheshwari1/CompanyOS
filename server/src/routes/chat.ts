import { Router } from 'express';
import multer from 'multer';
import {
  getChannels,
  createGroupChannel,
  startDMChannel,
  getChannelById,
  getChannelMessages,
  sendMessage,
  editMessage,
  deleteMessage
} from '../controllers/chat';
import { authenticate } from '../middleware/auth';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for chat attachments
});

router.get('/', authenticate, getChannels);
router.post('/', authenticate, createGroupChannel);
router.post('/dm', authenticate, startDMChannel);

router.patch('/messages/:id', authenticate, editMessage);
router.delete('/messages/:id', authenticate, deleteMessage);

router.get('/:id', authenticate, getChannelById);
router.get('/:id/messages', authenticate, getChannelMessages);
router.post('/:id/messages', authenticate, upload.array('attachments'), sendMessage);

export default router;
