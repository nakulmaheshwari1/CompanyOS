import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { createDepartmentSchema, updateDepartmentSchema } from '../validators/department';

export async function getDepartments(req: Request, res: Response, next: NextFunction) {
  try {
    const departments = await prisma.department.findMany({
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        _count: {
          select: { users: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return res.status(200).json(departments);
  } catch (error) {
    return next(error);
  }
}

export async function createDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = createDepartmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Validation error', errors: parseResult.error.flatten() });
    }

    const { name, managerId } = parseResult.data;

    // Check duplicate name
    const existing = await prisma.department.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } }
    });

    if (existing) {
      return res.status(400).json({ message: 'Department with this name already exists.' });
    }

    const department = await prisma.department.create({
      data: {
        name,
        managerId: managerId || null
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return res.status(201).json(department);
  } catch (error) {
    return next(error);
  }
}

export async function updateDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const parseResult = updateDepartmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Validation error', errors: parseResult.error.flatten() });
    }

    const { name, managerId } = parseResult.data;
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (managerId !== undefined) updateData.managerId = managerId;

    const department = await prisma.department.update({
      where: { id },
      data: updateData,
      include: {
        manager: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return res.status(200).json(department);
  } catch (error) {
    return next(error);
  }
}
