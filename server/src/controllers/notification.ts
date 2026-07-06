import { Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { NotificationType } from '@prisma/client';

export async function getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const { page = '1', limit = '20', type } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = { userId };

    if (type) {
      if (type === 'Task') {
        whereClause.type = {
          in: [NotificationType.TASK_ASSIGNED, NotificationType.TASK_OVERDUE, NotificationType.TASK_UPDATED, NotificationType.TASK_COMMENT]
        };
      } else if (type === 'Chat') {
        whereClause.type = NotificationType.CHAT_MENTION;
      } else if (type === 'Attendance') {
        whereClause.type = NotificationType.ATTENDANCE_ALERT;
      } else if (type === 'Unread') {
        whereClause.isRead = false;
      }
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      take: limitNum,
      skip,
      orderBy: { createdAt: 'desc' }
    });

    const totalCount = await prisma.notification.count({ where: whereClause });

    return res.status(200).json({
      notifications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const notification = await prisma.notification.findFirst({
      where: { id, userId }
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
}

export async function markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });

    return res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (error) {
    return next(error);
  }
}
