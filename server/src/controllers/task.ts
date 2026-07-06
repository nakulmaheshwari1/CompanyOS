import { Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { createTaskSchema, updateTaskSchema, createCommentSchema } from '../validators/task';
import { TaskStatus, Priority, Role, ChannelType, NotificationType } from '@prisma/client';

// Helper to create notifications and emit socket event
async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  referenceId?: string,
  io?: any
) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        referenceId
      }
    });

    if (io) {
      io.to(`user:${userId}`).emit('notification:new', notification);
    }
  } catch (error) {
    console.error('Failed to create/emit notification:', error);
  }
}

export async function getTasks(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const { tab, sort } = req.query;

    const whereClause: any = {
      OR: [
        { creatorId: userId },
        { assignees: { some: { userId } } }
      ]
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Apply tab filters
    if (tab === 'Today') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      whereClause.dueDate = {
        gte: today,
        lt: tomorrow
      };
    } else if (tab === 'Overdue') {
      whereClause.dueDate = {
        lt: new Date()
      };
      whereClause.status = {
        not: TaskStatus.COMPLETED
      };
    } else if (tab === 'Completed') {
      whereClause.status = TaskStatus.COMPLETED;
    }

    // Apply sorting
    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'dueDate') {
      orderBy = { dueDate: 'asc' };
    } else if (sort === 'priority') {
      // In prisma, we can sort by priority if we map priority enum to order,
      // but sorting directly will do alphabetical. Let's do dueDate or updatedAt
      orderBy = { priority: 'asc' }; 
    } else if (sort === 'lastUpdated') {
      orderBy = { updatedAt: 'desc' };
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        creator: {
          select: { id: true, name: true, avatarUrl: true }
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true }
            }
          }
        },
        _count: {
          select: { comments: true, subtasks: true }
        }
      },
      orderBy
    });

    return res.status(200).json(tasks);
  } catch (error) {
    return next(error);
  }
}

export async function getTaskById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, avatarUrl: true }
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true }
            }
          }
        },
        comments: {
          include: {
            author: {
              select: { id: true, name: true, avatarUrl: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        subtasks: {
          include: {
            assignees: {
              include: {
                user: {
                  select: { id: true, name: true, avatarUrl: true }
                }
              }
            }
          }
        },
        parentTask: {
          select: { id: true, title: true }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    return res.status(200).json(task);
  } catch (error) {
    return next(error);
  }
}

export async function createTask(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const parseResult = createTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Validation error', errors: parseResult.error.flatten() });
    }

    const {
      title,
      description,
      status,
      priority,
      startDate,
      dueDate,
      estimatedHours,
      tags,
      parentTaskId,
      assignees
    } = parseResult.data;

    // Enforce role assignment rules:
    // Only managers/admins can assign to others.
    // Employees can assign only to themselves.
    const io = req.app.get('io');
    const isManagerOrAdmin = req.user?.role === Role.SUPER_ADMIN || req.user?.role === Role.MANAGER;
    let finalAssignees = assignees;

    if (!isManagerOrAdmin) {
      // Force assign only to self
      finalAssignees = [userId];
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status,
        priority,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        estimatedHours,
        tags,
        parentTaskId: parentTaskId || null,
        creatorId: userId
      }
    });

    // Create TaskAssignee records
    for (const assigneeId of finalAssignees) {
      await prisma.taskAssignee.create({
        data: {
          taskId: task.id,
          userId: assigneeId
        }
      });

      // Send instant notification
      if (assigneeId !== userId) {
        await createNotification(
          assigneeId,
          NotificationType.TASK_ASSIGNED,
          'New Task Assigned',
          `You have been assigned a new task: "${task.title}"`,
          task.id,
          io
        );
      }
    }

    // Auto-create TASK chat channel
    const chatChannel = await prisma.channel.create({
      data: {
        type: ChannelType.TASK,
        name: `Task: ${task.title}`,
        taskId: task.id
      }
    });

    // Add all assignees & creator as channel members
    const members = Array.from(new Set([userId, ...finalAssignees]));
    for (const memberId of members) {
      await prisma.channelMember.create({
        data: {
          channelId: chatChannel.id,
          userId: memberId
        }
      });
    }

    // Return created task with assignees loaded
    const fullTask = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        assignees: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } }
          }
        }
      }
    });

    return res.status(201).json(fullTask);
  } catch (error) {
    return next(error);
  }
}

export async function updateTask(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const parseResult = updateTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Validation error', errors: parseResult.error.flatten() });
    }

    const currentTask = await prisma.task.findUnique({
      where: { id },
      include: { assignees: true }
    });

    if (!currentTask) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const updates: any = { ...parseResult.data };
    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);

    // If status is being set to COMPLETED, add completedAt timestamp
    if (updates.status === TaskStatus.COMPLETED && currentTask.status !== TaskStatus.COMPLETED) {
      updates.completedAt = new Date();
    } else if (updates.status && updates.status !== TaskStatus.COMPLETED) {
      updates.completedAt = null;
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updates,
      include: {
        creator: { select: { name: true, email: true } },
        assignees: { include: { user: true } }
      }
    });

    const io = req.app.get('io');

    // If status changed, log activity as comment and send notification to creator
    if (updates.status && updates.status !== currentTask.status) {
      const userObj = await prisma.user.findUnique({ where: { id: userId } });
      const activityText = `[ACTIVITY] Status changed from ${currentTask.status} to ${updates.status} by ${userObj?.name}`;
      
      await prisma.comment.create({
        data: {
          taskId: id,
          authorId: userId,
          content: activityText
        }
      });

      // Notify creator (if not the user making change)
      if (updatedTask.creatorId !== userId) {
        await createNotification(
          updatedTask.creatorId,
          NotificationType.TASK_UPDATED,
          'Task Status Updated',
          `Task "${updatedTask.title}" status changed to ${updates.status}`,
          updatedTask.id,
          io
        );
      }

      // Notify other assignees
      for (const assignee of updatedTask.assignees) {
        if (assignee.userId !== userId) {
          await createNotification(
            assignee.userId,
            NotificationType.TASK_UPDATED,
            'Task Status Updated',
            `Task "${updatedTask.title}" status changed to ${updates.status}`,
            updatedTask.id,
            io
          );
        }
      }

      // Socket emit task:updated event to task room or channel members
      if (io) {
        io.to(`task:${id}`).emit('task:updated', { taskId: id, changes: { status: updates.status } });
      }
    }

    return res.status(200).json(updatedTask);
  } catch (error) {
    return next(error);
  }
}

export async function deleteTask(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // Delete related relations first
    await prisma.taskAssignee.deleteMany({ where: { taskId: id } });
    await prisma.comment.deleteMany({ where: { taskId: id } });

    // Also delete channel related to task
    const channel = await prisma.channel.findFirst({ where: { taskId: id } });
    if (channel) {
      await prisma.channelMember.deleteMany({ where: { channelId: channel.id } });
      await prisma.message.deleteMany({ where: { channelId: channel.id } });
      await prisma.channel.delete({ where: { id: channel.id } });
    }

    await prisma.task.delete({ where: { id } });

    return res.status(200).json({ message: 'Task deleted successfully.' });
  } catch (error) {
    return next(error);
  }
}

export async function assignUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const existing = await prisma.taskAssignee.findUnique({
      where: {
        taskId_userId: {
          taskId: id,
          userId
        }
      }
    });

    if (existing) {
      return res.status(400).json({ message: 'User is already assigned to this task.' });
    }

    await prisma.taskAssignee.create({
      data: {
        taskId: id,
        userId
      }
    });

    // Add user as channel member of the task channel
    const channel = await prisma.channel.findFirst({ where: { taskId: id } });
    if (channel) {
      await prisma.channelMember.create({
        data: {
          channelId: channel.id,
          userId
        }
      });
    }

    const task = await prisma.task.findUnique({ where: { id } });
    const io = req.app.get('io');
    
    // Notify assignee
    await createNotification(
      userId,
      NotificationType.TASK_ASSIGNED,
      'New Task Assigned',
      `You have been assigned to task: "${task?.title}"`,
      id,
      io
    );

    return res.status(200).json({ message: 'User assigned successfully.' });
  } catch (error) {
    return next(error);
  }
}

export async function unassignUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id, userId } = req.params;

    await prisma.taskAssignee.delete({
      where: {
        taskId_userId: {
          taskId: id,
          userId
        }
      }
    });

    // Remove user as channel member of the task channel
    const channel = await prisma.channel.findFirst({ where: { taskId: id } });
    if (channel) {
      await prisma.channelMember.deleteMany({
        where: {
          channelId: channel.id,
          userId
        }
      });
    }

    return res.status(200).json({ message: 'User unassigned successfully.' });
  } catch (error) {
    return next(error);
  }
}

export async function getComments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const comments = await prisma.comment.findMany({
      where: { taskId: id },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.status(200).json(comments);
  } catch (error) {
    return next(error);
  }
}

export async function createComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const parseResult = createCommentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Validation error', errors: parseResult.error.flatten() });
    }

    const { content } = parseResult.data;

    const comment = await prisma.comment.create({
      data: {
        taskId: id,
        authorId: userId,
        content
      },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true }
        }
      }
    });

    // Smart Alert: Check for @mentions in comment content
    const mentionRegex = /@(\w+@\w+\.\w+|[a-zA-Z0-9_]+)/g;
    const matches = content.match(mentionRegex);
    const io = req.app.get('io');

    if (matches) {
      for (const match of matches) {
        const identifier = match.substring(1); // strip @
        const mentionedUser = await prisma.user.findFirst({
          where: {
            OR: [
              { email: identifier },
              { name: { equals: identifier.replace(/_/g, ' '), mode: 'insensitive' } }
            ]
          }
        });

        if (mentionedUser && mentionedUser.id !== userId) {
          await createNotification(
            mentionedUser.id,
            NotificationType.TASK_COMMENT,
            'Mentioned in Task Comment',
            `${comment.author.name} mentioned you in a comment on task.`,
            id,
            io
          );
        }
      }
    }

    return res.status(201).json(comment);
  } catch (error) {
    return next(error);
  }
}

export async function getTeamTasks(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const managerId = req.user?.id;

    // Verify manager manages a department
    const managedDepts = await prisma.department.findMany({
      where: { managerId }
    });

    if (managedDepts.length === 0 && req.user?.role !== Role.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Only managers or admins can view team tasks.' });
    }

    const deptIds = req.user?.role === Role.SUPER_ADMIN
      ? []
      : managedDepts.map(d => d.id);

    const userWhere: any = {};
    if (deptIds.length > 0) {
      userWhere.departmentId = { in: deptIds };
    }

    // Get all team members
    const teamMembers = await prisma.user.findMany({
      where: userWhere,
      select: { id: true }
    });

    const teamMemberIds = teamMembers.map(m => m.id);

    // Fetch tasks created by or assigned to team members
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { creatorId: { in: teamMemberIds } },
          { assignees: { some: { userId: { in: teamMemberIds } } } }
        ]
      },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } }
          }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    return res.status(200).json(tasks);
  } catch (error) {
    return next(error);
  }
}

export async function getKanbanBoard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;

    // Get all tasks assigned to user or created by user
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { assignees: { some: { userId } } }
        ]
      },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } }
          }
        }
      }
    });

    // Group by status
    const board = {
      NOT_STARTED: tasks.filter(t => t.status === TaskStatus.NOT_STARTED),
      IN_PROGRESS: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS),
      BLOCKED: tasks.filter(t => t.status === TaskStatus.BLOCKED),
      ON_HOLD: tasks.filter(t => t.status === TaskStatus.ON_HOLD),
      COMPLETED: tasks.filter(t => t.status === TaskStatus.COMPLETED)
    };

    return res.status(200).json(board);
  } catch (error) {
    return next(error);
  }
}

export async function getCalendarTasks(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;

    // Fetch tasks that have a due date
    const tasks = await prisma.task.findMany({
      where: {
        dueDate: { not: null },
        OR: [
          { creatorId: userId },
          { assignees: { some: { userId } } }
        ]
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        priority: true
      }
    });

    return res.status(200).json(tasks);
  } catch (error) {
    return next(error);
  }
}
