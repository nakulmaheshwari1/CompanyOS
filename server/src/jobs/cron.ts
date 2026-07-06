import cron from 'node-cron';
import { Server } from 'socket.io';
import prisma from '../prisma/client';
import { AttendanceStatus, NotificationType, Role, TaskStatus } from '@prisma/client';
import { onlineUsers } from '../socket';

export function setupCronJobs(io: Server) {
  console.log('Registering Cron Jobs...');

  // Helper to send socket notifications
  async function createCronNotification(userId: string, type: NotificationType, title: string, body: string, referenceId?: string) {
    try {
      const notification = await prisma.notification.create({
        data: { userId, type, title, body, referenceId }
      });
      io.to(`user:${userId}`).emit('notification:new', notification);
    } catch (err) {
      console.error(`Failed to create cron notification for user ${userId}:`, err);
    }
  }

  // 1. Every day at 11:59 PM: Auto-mark absent users who never clocked in
  cron.schedule('59 23 * * *', async () => {
    console.log('[CRON] Running daily auto-mark absent job...');
    try {
      const today = new Date();
      const todayStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

      // Get all employees and managers (users who need to clock in)
      const users = await prisma.user.findMany({
        where: {
          role: { in: [Role.EMPLOYEE, Role.MANAGER] },
          isActive: true
        }
      });

      for (const user of users) {
        const attendance = await prisma.attendance.findUnique({
          where: {
            userId_date: {
              userId: user.id,
              date: todayStart
            }
          }
        });

        if (!attendance || !attendance.clockIn) {
          // Mark absent or update
          await prisma.attendance.upsert({
            where: {
              userId_date: {
                userId: user.id,
                date: todayStart
              }
            },
            update: {
              status: AttendanceStatus.ABSENT,
              notes: 'Auto-marked absent: no clock-in by end of day'
            },
            create: {
              userId: user.id,
              date: todayStart,
              status: AttendanceStatus.ABSENT,
              notes: 'Auto-marked absent: no clock-in by end of day'
            }
          });
          console.log(`Auto-marked user ${user.name} as ABSENT for today.`);
        }
      }
    } catch (error) {
      console.error('[CRON ERROR] Auto-mark absent failed:', error);
    }
  });

  // 2. Every 6 hours: Send overdue task notifications
  cron.schedule('0 */6 * * *', async () => {
    console.log('[CRON] Running overdue tasks notification job...');
    try {
      const now = new Date();

      const overdueTasks = await prisma.task.findMany({
        where: {
          dueDate: { lt: now },
          status: { not: TaskStatus.COMPLETED }
        },
        include: {
          assignees: true
        }
      });

      for (const task of overdueTasks) {
        // Notify assignees
        for (const assignee of task.assignees) {
          await createCronNotification(
            assignee.userId,
            NotificationType.TASK_OVERDUE,
            'Overdue Task Alert',
            `The task "${task.title}" is overdue. Please update its status.`,
            task.id
          );
        }

        // Notify creator
        await createCronNotification(
          task.creatorId,
          NotificationType.TASK_OVERDUE,
          'Overdue Task Alert (Creator)',
          `The task "${task.title}" you created is overdue.`,
          task.id
        );
      }
      console.log(`Sent overdue notifications for ${overdueTasks.length} tasks.`);
    } catch (error) {
      console.error('[CRON ERROR] Overdue tasks job failed:', error);
    }
  });

  // 3. Every day at 9:00 AM: Send "Tasks due today" digest per user
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Running daily tasks due today digest...');
    try {
      const today = new Date();
      const todayStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      const todayEnd = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999));

      const activeUsersList = await prisma.user.findMany({
        where: { isActive: true }
      });

      for (const user of activeUsersList) {
        const tasksDueToday = await prisma.task.findMany({
          where: {
            dueDate: {
              gte: todayStart,
              lte: todayEnd
            },
            status: { not: TaskStatus.COMPLETED },
            assignees: { some: { userId: user.id } }
          }
        });

        if (tasksDueToday.length > 0) {
          const taskTitles = tasksDueToday.map(t => `"${t.title}"`).join(', ');
          await createCronNotification(
            user.id,
            NotificationType.ANNOUNCEMENT,
            'Daily Task Digest',
            `You have ${tasksDueToday.length} task(s) due today: ${taskTitles}`,
            undefined
          );
        }
      }
    } catch (error) {
      console.error('[CRON ERROR] Daily digest failed:', error);
    }
  });

  // 4. Every 1 minute: Update presence status and broadcast if users are inactive for > 5 mins
  cron.schedule('*/1 * * * *', async () => {
    try {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);

      // Find users who have not pinged/active for > 5 min, but might still be considered online
      // We will check active DB users who are not in the onlineUsers map but still show as active.
      // Sockets disconnect handles this, but this is a double safety.
      // We will find users who are not in the socket online map but have lastActiveAt > 5m ago
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          lastActiveAt: { lt: fiveMinsAgo }
        }
      });

      for (const user of users) {
        // If they are in the memory map but not active, remove them
        if (onlineUsers.has(user.id)) {
          onlineUsers.delete(user.id);
          io.emit('user:presence', { userId: user.id, isOnline: false });
          console.log(`Presence timeout for user ${user.name} (marked offline).`);
        }
      }
    } catch (error) {
      console.error('[CRON ERROR] Presence check failed:', error);
    }
  });
}
