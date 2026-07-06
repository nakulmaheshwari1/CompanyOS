import { Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { createUserSchema, updateUserSchema, updateProfileSchema } from '../validators/user';
import { uploadFile } from '../utils/cloudinary';
import { Role } from '@prisma/client';

export async function getUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { role, departmentId, status, search } = req.query;

    const whereClause: any = {};

    if (role) {
      whereClause.role = role as Role;
    }
    if (departmentId) {
      whereClause.departmentId = departmentId as string;
    }
    if (status) {
      whereClause.isActive = status === 'active';
    }
    if (search) {
      whereClause.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        isActive: true,
        avatarUrl: true,
        lastActiveAt: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return res.status(200).json(users);
  } catch (error) {
    return next(error);
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const parseResult = createUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Validation error', errors: parseResult.error.flatten() });
    }

    const { name, email, password, role, departmentId } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'A user with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        role,
        departmentId: departmentId || null
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true
      }
    });

    // Automatically add user to the global channel
    const globalChannel = await prisma.channel.findFirst({
      where: { type: 'GLOBAL' }
    });
    if (globalChannel) {
      await prisma.channelMember.create({
        data: {
          channelId: globalChannel.id,
          userId: newUser.id
        }
      });
    }

    return res.status(201).json(newUser);
  } catch (error) {
    return next(error);
  }
}

export async function getUserById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        isActive: true,
        avatarUrl: true,
        lastActiveAt: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
            manager: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const parseResult = updateUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Validation error', errors: parseResult.error.flatten() });
    }

    const updates: any = { ...parseResult.data };

    if (updates.email) {
      updates.email = updates.email.toLowerCase().trim();
      const existingUser = await prisma.user.findFirst({
        where: { email: updates.email, NOT: { id } }
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Email is already taken.' });
      }
    }

    if (updates.password) {
      updates.passwordHash = await bcrypt.hash(updates.password, 10);
      delete updates.password;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        isActive: true,
        avatarUrl: true
      }
    });

    return res.status(200).json(updatedUser);
  } catch (error) {
    return next(error);
  }
}

export async function deactivateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    if (req.user?.id === id) {
      return res.status(400).json({ message: 'You cannot deactivate your own account.' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true }
    });

    return res.status(200).json({ message: `User ${user.name} deactivated successfully.`, user });
  } catch (error) {
    return next(error);
  }
}

export async function getCurrentUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        isActive: true,
        avatarUrl: true,
        lastActiveAt: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
}

export async function updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Validation error', errors: parseResult.error.flatten() });
    }

    const { name, currentPassword, newPassword } = parseResult.data;
    const updateData: any = {};

    if (name) {
      updateData.name = name;
    }

    if (newPassword && currentPassword) {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect current password.' });
      }

      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true
      }
    });

    return res.status(200).json({ message: 'Profile updated successfully.', user: updatedUser });
  } catch (error) {
    return next(error);
  }
}

export async function uploadAvatar(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Upload using Cloudinary helper
    const avatarUrl = await uploadFile(req.file, 'avatars');

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        avatarUrl: true
      }
    });

    return res.status(200).json({
      message: 'Avatar uploaded successfully.',
      avatarUrl: updatedUser.avatarUrl
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteUserPermanently(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    if (req.user?.id === id) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }

    // Use a transaction to clean up relations
    await prisma.$transaction(async (tx) => {
      // 1. Nullify manager in departments
      await tx.department.updateMany({
        where: { managerId: id },
        data: { managerId: null }
      });

      // 2. Delete attendance records
      await tx.attendance.deleteMany({
        where: { userId: id }
      });

      // 3. Delete task assignees
      await tx.taskAssignee.deleteMany({
        where: { userId: id }
      });

      // 4. Delete comments
      await tx.comment.deleteMany({
        where: { authorId: id }
      });

      // 5. Delete channel memberships
      await tx.channelMember.deleteMany({
        where: { userId: id }
      });

      // 6. Delete notifications
      await tx.notification.deleteMany({
        where: { userId: id }
      });

      // 7. Delete messages sent by user
      await tx.message.deleteMany({
        where: { senderId: id }
      });

      // 8. Handle tasks created by the user
      // For tasks they created, we can re-assign creator to the super admin performing this action
      await tx.task.updateMany({
        where: { creatorId: id },
        data: { creatorId: req.user!.id }
      });

      // 9. Delete the user
      await tx.user.delete({
        where: { id }
      });
    });

    return res.status(200).json({ message: 'User permanently deleted.' });
  } catch (error) {
    return next(error);
  }
}
