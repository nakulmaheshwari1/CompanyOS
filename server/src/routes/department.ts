import { Router } from 'express';
import { getDepartments, createDepartment, updateDepartment } from '../controllers/department';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', authenticate, getDepartments);
router.post('/', authenticate, authorize(Role.SUPER_ADMIN), createDepartment);
router.patch('/:id', authenticate, authorize(Role.SUPER_ADMIN, Role.HR), updateDepartment);

export default router;
