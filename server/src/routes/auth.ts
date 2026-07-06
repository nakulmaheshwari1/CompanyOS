import { Router } from 'express';
import { login, logout, refresh, forgotPassword, resetPassword } from '../controllers/auth';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
