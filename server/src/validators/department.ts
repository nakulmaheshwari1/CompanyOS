import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z.string().min(2, 'Department name must be at least 2 characters'),
  managerId: z.string().nullable().optional()
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(2).optional(),
  managerId: z.string().nullable().optional()
});
