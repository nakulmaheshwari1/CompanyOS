import { Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { AttendanceStatus, Role } from '@prisma/client';

// Thresholds
const LATE_THRESHOLD_HOUR = 9; // 9:00 AM
const HALF_DAY_MIN_HOURS = 4.0;

export async function clockIn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const today = new Date();
    const todayStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    // Check if attendance record already exists for today
    let record = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayStart
        }
      }
    });

    if (record && record.clockIn && !record.clockOut) {
      return res.status(400).json({ message: 'You have already clocked in today.' });
    }

    // Determine status (PRESENT or LATE)
    let status: AttendanceStatus = AttendanceStatus.PRESENT;
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    if (currentHour > LATE_THRESHOLD_HOUR || (currentHour === LATE_THRESHOLD_HOUR && currentMinute > 0)) {
      status = AttendanceStatus.LATE;
    }

    if (record) {
      // Keep existing status if it is PRESENT or LATE or HALF_DAY
      const targetStatus = (record.status === AttendanceStatus.ABSENT || record.status === AttendanceStatus.ON_LEAVE)
        ? status
        : record.status;
      const targetNotes = (record.status === AttendanceStatus.ABSENT || record.status === AttendanceStatus.ON_LEAVE)
        ? (status === AttendanceStatus.LATE ? 'Clocked in late' : 'Clocked in')
        : record.notes;
      const newCount = record.clockInCount + 1;

      record = await prisma.attendance.update({
        where: { id: record.id },
        data: {
          clockIn: today,
          clockOut: null,
          status: targetStatus,
          notes: targetNotes,
          clockInCount: newCount
        }
      });
    } else {
      record = await prisma.attendance.create({
        data: {
          userId,
          date: todayStart,
          clockIn: today,
          status,
          notes: status === AttendanceStatus.LATE ? 'Clocked in late' : 'Clocked in',
          clockInCount: 1,
          hoursWorked: 0.0
        }
      });
    }

    return res.status(200).json({
      message: 'Clocked in successfully',
      record: {
        id: record.id,
        clockIn: record.clockIn,
        clockOut: record.clockOut,
        status: record.status,
        date: record.date,
        hoursWorked: record.hoursWorked,
        clockInCount: record.clockInCount,
        notes: record.notes
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function clockOut(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const today = new Date();
    const todayStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    const record = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayStart
        }
      }
    });

    if (!record || !record.clockIn) {
      return res.status(400).json({ message: 'You must clock in before clocking out.' });
    }

    if (record.clockOut) {
      return res.status(400).json({ message: 'You have already clocked out today.' });
    }

    // Calculate total hours
    const elapsedMs = today.getTime() - record.clockIn.getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const totalHoursToday = (record.hoursWorked || 0.0) + elapsedHours;

    const wasLate = record.notes && record.notes.toLowerCase().includes('late');
    let status: AttendanceStatus = wasLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
    if (totalHoursToday < HALF_DAY_MIN_HOURS) {
      status = AttendanceStatus.HALF_DAY;
    }

    const updatedRecord = await prisma.attendance.update({
      where: { id: record.id },
      data: {
        clockOut: today,
        status,
        hoursWorked: totalHoursToday,
        notes: status === AttendanceStatus.HALF_DAY ? 'Left early (half day)' : record.notes
      }
    });

    return res.status(200).json({
      message: 'Clocked out successfully',
      record: {
        id: updatedRecord.id,
        clockIn: updatedRecord.clockIn,
        clockOut: updatedRecord.clockOut,
        status: updatedRecord.status,
        date: updatedRecord.date,
        hoursWorked: updatedRecord.hoursWorked,
        clockInCount: updatedRecord.clockInCount,
        notes: updatedRecord.notes
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function getMyAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const { startDate, endDate } = req.query;

    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1));
    
    const targetDay = endDate ? new Date(endDate as string) : new Date();
    const end = new Date(targetDay);
    end.setHours(23, 59, 59, 999);

    const records = await prisma.attendance.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end
        }
      },
      orderBy: { date: 'desc' }
    });

    return res.status(200).json(records);
  } catch (error) {
    return next(error);
  }
}

export async function getTeamAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const managerId = req.user?.id;
    const { date, departmentId, status } = req.query;

    const targetDate = date ? new Date(date as string) : new Date();
    const targetDateStart = date
      ? new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()))
      : new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));

    // Verify manager manages a department
    const managedDepts = await prisma.department.findMany({
      where: { managerId }
    });

    if (managedDepts.length === 0 && req.user?.role !== Role.SUPER_ADMIN && req.user?.role !== Role.HR) {
      return res.status(403).json({ message: 'Only managers can view team attendance.' });
    }

    const deptIds = req.user?.role === Role.SUPER_ADMIN || req.user?.role === Role.HR
      ? (departmentId ? [departmentId as string] : [])
      : managedDepts.map(d => d.id);

    const userWhere: any = {};
    if (deptIds.length > 0) {
      userWhere.departmentId = { in: deptIds };
    } else if (req.user?.role !== Role.SUPER_ADMIN && req.user?.role !== Role.HR) {
      return res.status(200).json([]); // No departments managed
    }

    // Find all users in these departments
    const teamMembers = await prisma.user.findMany({
      where: {
        ...userWhere,
        role: Role.EMPLOYEE // We want employees
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        department: {
          select: { name: true }
        },
        attendance: {
          where: { date: targetDateStart }
        }
      }
    });

    // Format response
    const results = teamMembers.map(member => {
      const att = member.attendance[0] || null;
      return {
        userId: member.id,
        name: member.name,
        email: member.email,
        avatarUrl: member.avatarUrl,
        department: member.department?.name || 'N/A',
        attendance: att ? {
          id: att.id,
          clockIn: att.clockIn,
          clockOut: att.clockOut,
          status: att.status,
          notes: att.notes
        } : {
          status: AttendanceStatus.ABSENT,
          clockIn: null,
          clockOut: null,
          notes: 'No clock-in recorded'
        }
      };
    });

    // Apply filtering by status if requested
    const filteredResults = status
      ? results.filter(r => r.attendance.status === status)
      : results;

    return res.status(200).json(filteredResults);
  } catch (error) {
    return next(error);
  }
}

export async function getCompanyAttendanceReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { date, departmentId, search } = req.query;

    const targetDate = date ? new Date(date as string) : new Date();
    const targetDateStart = date
      ? new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()))
      : new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));

    const userWhere: any = {};
    if (departmentId) {
      userWhere.departmentId = departmentId as string;
    }
    if (search) {
      userWhere.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const members = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        department: {
          select: { name: true }
        },
        attendance: {
          where: { date: targetDateStart }
        }
      }
    });

    const report = members.map(member => {
      const att = member.attendance[0] || null;
      
      // Anomaly flagging: absent or late
      const isAnomaly = !att || att.status === AttendanceStatus.ABSENT || att.status === AttendanceStatus.LATE;

      return {
        userId: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        avatarUrl: member.avatarUrl,
        department: member.department?.name || 'N/A',
        attendance: att ? {
          id: att.id,
          clockIn: att.clockIn,
          clockOut: att.clockOut,
          status: att.status,
          notes: att.notes
        } : {
          status: AttendanceStatus.ABSENT,
          clockIn: null,
          clockOut: null,
          notes: 'No clock-in recorded'
        },
        isAnomaly
      };
    });

    return res.status(200).json(report);
  } catch (error) {
    return next(error);
  }
}

export async function exportAttendanceCSV(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1));
    const end = endDate ? new Date(endDate as string) : new Date();

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            department: { select: { name: true } }
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { user: { name: 'asc' } }
      ]
    });

    let csvContent = 'Date,Employee Name,Email,Department,Clock In,Clock Out,Status,Hours Worked,Notes\n';

    for (const rec of attendanceRecords) {
      const dateStr = rec.date.toISOString().split('T')[0];
      const name = rec.user.name.replace(/"/g, '""');
      const email = rec.user.email;
      const dept = (rec.user.department?.name || 'N/A').replace(/"/g, '""');
      const clockInStr = rec.clockIn ? rec.clockIn.toISOString() : 'N/A';
      const clockOutStr = rec.clockOut ? rec.clockOut.toISOString() : 'N/A';
      
      let hoursWorked = 0;
      if (rec.clockIn && rec.clockOut) {
        hoursWorked = (rec.clockOut.getTime() - rec.clockIn.getTime()) / (1000 * 60 * 60);
      }
      
      const notes = (rec.notes || '').replace(/"/g, '""');

      csvContent += `"${dateStr}","${name}","${email}","${dept}","${clockInStr}","${clockOutStr}","${rec.status}","${hoursWorked.toFixed(2)}","${notes}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
    return res.status(200).send(csvContent);
  } catch (error) {
    return next(error);
  }
}

export async function correctAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { clockIn, clockOut, status, notes } = req.body;

    const data: any = {};
    if (clockIn) data.clockIn = new Date(clockIn);
    if (clockOut) data.clockOut = new Date(clockOut);
    if (status) data.status = status;
    if (notes !== undefined) data.notes = notes;

    const updated = await prisma.attendance.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    return res.status(200).json({
      message: 'Attendance record updated successfully.',
      record: updated
    });
  } catch (error) {
    return next(error);
  }
}
