import { z } from 'zod';
import { TaskStatus, Priority } from '@prisma/client';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.NOT_STARTED),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().nullable().optional(),
  tags: z.array(z.string()).default([]),
  parentTaskId: z.string().nullable().optional(),
  assignees: z.array(z.string()).default([])
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().nullable().optional(),
  actualHours: z.number().nullable().optional(),
  tags: z.array(z.string()).optional(),
  parentTaskId: z.string().nullable().optional()
});

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment text is required')
});
