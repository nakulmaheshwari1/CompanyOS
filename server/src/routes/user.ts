import { Router } from 'express';
import multer from 'multer';
import {
  getUsers,
  createUser,
  getUserById,
  updateUser,
  deactivateUser,
  getCurrentUser,
  updateProfile,
  uploadAvatar
} from '../controllers/user';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Authenticated user profile routes
router.get('/me', authenticate, getCurrentUser);
router.patch('/me', authenticate, updateProfile);
router.post('/me/avatar', authenticate, upload.single('avatar'), uploadAvatar);

// Admin-only user management routes
router.get('/', authenticate, getUsers);
router.post('/', authenticate, authorize(Role.SUPER_ADMIN), createUser);
router.get('/:id', authenticate, getUserById);
router.patch('/:id', authenticate, authorize(Role.SUPER_ADMIN), updateUser);
router.delete('/:id', authenticate, authorize(Role.SUPER_ADMIN), deactivateUser);

export default router;
