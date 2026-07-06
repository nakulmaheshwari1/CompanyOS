import { Router } from 'express';
import {
  clockIn,
  clockOut,
  getMyAttendance,
  getTeamAttendance,
  getCompanyAttendanceReport,
  exportAttendanceCSV,
  correctAttendance
} from '../controllers/attendance';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.post('/clock-in', authenticate, clockIn);
router.post('/clock-out', authenticate, clockOut);
router.get('/me', authenticate, getMyAttendance);

// Manager / HR / Admin routes
router.get('/team', authenticate, getTeamAttendance);
router.get('/report', authenticate, authorize(Role.SUPER_ADMIN, Role.HR), getCompanyAttendanceReport);
router.get('/export', authenticate, authorize(Role.SUPER_ADMIN, Role.HR, Role.MANAGER), exportAttendanceCSV);
router.patch('/:id', authenticate, authorize(Role.SUPER_ADMIN, Role.HR), correctAttendance);

export default router;
