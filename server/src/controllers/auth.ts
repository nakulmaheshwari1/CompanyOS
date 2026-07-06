import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../prisma/client';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { checkLockout, registerFailure, resetFailure } from '../utils/lockout';
import { sendEmail } from '../utils/email';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/auth';

// Temporary in-memory OTP storage
const otpStore = new Map<string, { otp: string; expiresAt: Date }>();

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Validation error', errors: parseResult.error.flatten() });
    }

    const { email, password } = parseResult.data;

    // Check account lockout
    const lockout = checkLockout(email);
    if (lockout.isLocked) {
      return res.status(423).json({
        message: `Account is locked due to multiple failed attempts. Try again in ${Math.ceil(lockout.remainingTime / 60)} minutes.`,
        remainingTime: lockout.remainingTime
      });
    }

    // Find active user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user || !user.isActive) {
      const { attemptsLeft, lockedUntil } = registerFailure(email);
      const message = lockedUntil
        ? 'Too many failed login attempts. Your account has been locked for 15 minutes.'
        : `Invalid email or password. You have ${attemptsLeft} attempts remaining.`;
      
      return res.status(401).json({ message });
    }

    // Check password
    const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordMatch) {
      const { attemptsLeft, lockedUntil } = registerFailure(email);
      const message = lockedUntil
        ? 'Too many failed login attempts. Your account has been locked for 15 minutes.'
        : `Invalid email or password. You have ${attemptsLeft} attempts remaining.`;

      return res.status(401).json({ message });
    }

    // Reset failed attempts on success
    resetFailure(email);

    // Update lastActiveAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() }
    });

    // Generate tokens
    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Set refresh token in HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(200).json({
      message: 'Login successful',
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        departmentId: user.departmentId
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    return next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token missing.' });
    }

    const decoded = verifyRefreshToken(refreshToken);

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive.' });
    }

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() }
    });

    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);

    return res.status(200).json({ accessToken });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired refresh token.' });
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = forgotPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Validation error', errors: parseResult.error.flatten() });
    }

    const { email } = parseResult.data;

    // Check if user exists (fail silently to prevent enumeration attacks, or let the user know for internal apps. Since it is internal workforce, we can just say if it exists or not)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user || !user.isActive) {
      // Still return 200 to prevent user enumeration
      return res.status(200).json({ message: 'If the email matches an active account, an OTP has been sent.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry

    otpStore.set(email.toLowerCase().trim(), { otp, expiresAt });

    // Send email with OTP
    await sendEmail({
      to: user.email,
      subject: 'CompanyOS — Password Reset OTP',
      text: `Hello ${user.name},\n\nYou requested a password reset. Your OTP is: ${otp}\nIt is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`
    });

    return res.status(200).json({ message: 'If the email matches an active account, an OTP has been sent.' });
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = resetPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Validation error', errors: parseResult.error.flatten() });
    }

    const { email, otp, newPassword } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    const storedData = otpStore.get(normalizedEmail);
    if (!storedData) {
      return res.status(400).json({ message: 'No reset request found for this email.' });
    }

    if (new Date() > storedData.expiresAt) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP code.' });
    }

    // Update password in DB
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.isActive) {
      return res.status(400).json({ message: 'Account not found or inactive.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    // Clean up OTP and lockout history
    otpStore.delete(normalizedEmail);
    resetFailure(normalizedEmail);

    return res.status(200).json({ message: 'Password has been reset successfully. You can now login.' });
  } catch (error) {
    return next(error);
}
}
