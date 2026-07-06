import { Router } from 'express';
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  assignUser,
  unassignUser,
  getComments,
  createComment,
  getTeamTasks,
  getKanbanBoard,
  getCalendarTasks
} from '../controllers/task';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

// General task routes
router.get('/', authenticate, getTasks);
router.post('/', authenticate, createTask);
router.get('/team', authenticate, authorize(Role.SUPER_ADMIN, Role.MANAGER), getTeamTasks);
router.get('/board', authenticate, getKanbanBoard);
router.get('/calendar', authenticate, getCalendarTasks);

// Specific task detail routes
router.get('/:id', authenticate, getTaskById);
router.patch('/:id', authenticate, updateTask);
router.delete('/:id', authenticate, deleteTask);

// Assignee management
router.post('/:id/assign', authenticate, assignUser);
router.delete('/:id/assign/:userId', authenticate, unassignUser);

// Comments
router.get('/:id/comments', authenticate, getComments);
router.post('/:id/comments', authenticate, createComment);

export default router;
