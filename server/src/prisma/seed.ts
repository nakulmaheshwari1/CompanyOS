import { PrismaClient, Role, AttendanceStatus, TaskStatus, Priority, ChannelType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.channelMember.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.taskAssignee.deleteMany();
  await prisma.task.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = bcrypt.hashSync('Password123', 10);
  const adminHash = bcrypt.hashSync('Admin@123', 10);

  // 1. Create Departments first
  const engineeringDept = await prisma.department.create({
    data: { name: 'Engineering' }
  });

  const salesDept = await prisma.department.create({
    data: { name: 'Sales' }
  });

  const hrDept = await prisma.department.create({
    data: { name: 'Human Resources' }
  });

  // 2. Create Users
  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@company.com',
      passwordHash: adminHash,
      role: Role.SUPER_ADMIN,
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
    }
  });

  const manager1 = await prisma.user.create({
    data: {
      name: 'Manager One',
      email: 'manager1@company.com',
      passwordHash: passwordHash,
      role: Role.MANAGER,
      departmentId: engineeringDept.id,
      avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150'
    }
  });

  const manager2 = await prisma.user.create({
    data: {
      name: 'Manager Two',
      email: 'manager2@company.com',
      passwordHash: passwordHash,
      role: Role.MANAGER,
      departmentId: salesDept.id,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
    }
  });

  // Update department managers
  await prisma.department.update({
    where: { id: engineeringDept.id },
    data: { managerId: manager1.id }
  });

  await prisma.department.update({
    where: { id: salesDept.id },
    data: { managerId: manager2.id }
  });

  // Create HR staff
  const hrStaff = await prisma.user.create({
    data: {
      name: 'HR Partner',
      email: 'hr@company.com',
      passwordHash: passwordHash,
      role: Role.HR,
      departmentId: hrDept.id,
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150'
    }
  });

  await prisma.department.update({
    where: { id: hrDept.id },
    data: { managerId: hrStaff.id }
  });

  // Create Employees
  const employeesData = [
    { name: 'Alice Smith', email: 'emp1@company.com', deptId: engineeringDept.id, avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150' },
    { name: 'Bob Johnson', email: 'emp2@company.com', deptId: engineeringDept.id, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
    { name: 'Charlie Brown', email: 'emp3@company.com', deptId: engineeringDept.id, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' },
    { name: 'Diana Prince', email: 'emp4@company.com', deptId: salesDept.id, avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150' },
    { name: 'Ethan Hunt', email: 'emp5@company.com', deptId: salesDept.id, avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150' },
    { name: 'Fiona Gallagher', email: 'emp6@company.com', deptId: salesDept.id, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' }
  ];

  const employees = [];
  for (const emp of employeesData) {
    const created = await prisma.user.create({
      data: {
        name: emp.name,
        email: emp.email,
        passwordHash: passwordHash,
        role: Role.EMPLOYEE,
        departmentId: emp.deptId,
        avatarUrl: emp.avatar
      }
    });
    employees.push(created);
  }

  const allUsers = [admin, manager1, manager2, hrStaff, ...employees];

  // 3. Attendance Seed (1 week back)
  const today = new Date();
  const statuses = [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.HALF_DAY];
  
  for (let i = 6; i >= 0; i--) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - i);
    
    // Skip weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    for (const user of allUsers) {
      // Admin doesn't necessarily clock in every day
      if (user.role === Role.SUPER_ADMIN && Math.random() > 0.5) continue;

      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      
      let clockIn: Date | null = null;
      let clockOut: Date | null = null;

      if (randomStatus === AttendanceStatus.PRESENT) {
        clockIn = new Date(currentDate);
        clockIn.setHours(8, Math.floor(Math.random() * 45), 0, 0); // 8:00 - 8:45 AM
        clockOut = new Date(currentDate);
        clockOut.setHours(17, Math.floor(Math.random() * 30), 0, 0); // 5:00 - 5:30 PM
      } else if (randomStatus === AttendanceStatus.LATE) {
        clockIn = new Date(currentDate);
        clockIn.setHours(9, Math.floor(Math.random() * 30) + 15, 0, 0); // 9:15 - 9:45 AM (late)
        clockOut = new Date(currentDate);
        clockOut.setHours(17, 0, 0, 0);
      } else if (randomStatus === AttendanceStatus.HALF_DAY) {
        clockIn = new Date(currentDate);
        clockIn.setHours(8, 30, 0, 0);
        clockOut = new Date(currentDate);
        clockOut.setHours(12, 30, 0, 0); // leave early
      }

      let hoursWorked = 0.0;
      if (clockIn && clockOut) {
        hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      }

      await prisma.attendance.create({
        data: {
          userId: user.id,
          date: currentDate,
          clockIn,
          clockOut,
          status: randomStatus,
          notes: randomStatus === AttendanceStatus.LATE ? 'Heavy traffic' : undefined,
          hoursWorked: parseFloat(hoursWorked.toFixed(2)),
          clockInCount: clockIn ? 1 : 0
        }
      });
    }
  }

  // 4. Create 10 Tasks
  const tasksData = [
    { title: 'Setup CI/CD Pipeline', desc: 'Configure Github Actions for production build deployment.', status: TaskStatus.COMPLETED, priority: Priority.CRITICAL, creator: manager1, assignees: [employees[0]], est: 6, act: 5 },
    { title: 'Design System Implementation', desc: 'Create buttons, cards, and input fields using theme values.', status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, creator: manager1, assignees: [employees[0], employees[1]], est: 12, act: 4 },
    { title: 'Database Migration to Railway', desc: 'Migrate local postgres structure and seed production.', status: TaskStatus.NOT_STARTED, priority: Priority.MEDIUM, creator: admin, assignees: [manager1], est: 4, act: 0 },
    { title: 'Draft HR Leave Policy', desc: 'Write guidelines for annual leave and sick leaves.', status: TaskStatus.COMPLETED, priority: Priority.LOW, creator: hrStaff, assignees: [hrStaff], est: 8, act: 8 },
    { title: 'Create Sales Presentation Q3', desc: 'Prepare deck for quarterly earnings call with stakeholders.', status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, creator: manager2, assignees: [employees[3], employees[4]], est: 10, act: 6 },
    { title: 'Fix Auth Cookie Expiry Bug', desc: 'JWT token refresh gets rejected in Safari browsers.', status: TaskStatus.BLOCKED, priority: Priority.CRITICAL, creator: manager1, assignees: [employees[1]], est: 4, act: 3 },
    { title: 'Organize Team Building Event', desc: 'Schedule laser tag and dinner for engineering.', status: TaskStatus.ON_HOLD, priority: Priority.LOW, creator: manager1, assignees: [employees[2]], est: 2, act: 0 },
    { title: 'Customer Feedback Review', desc: 'Review tickets filed in June and catalog feature requests.', status: TaskStatus.NOT_STARTED, priority: Priority.MEDIUM, creator: manager2, assignees: [employees[5]], est: 8, act: 0 },
    { title: 'Refactor Messaging WebSocket', desc: 'Ensure socket connections reconnect gracefully.', status: TaskStatus.IN_PROGRESS, priority: Priority.CRITICAL, creator: manager1, assignees: [employees[0]], est: 8, act: 2 },
    { title: 'Upload Product Catalog', desc: 'Import CSV data to production inventory systems.', status: TaskStatus.COMPLETED, priority: Priority.LOW, creator: manager2, assignees: [employees[4]], est: 3, act: 3 }
  ];

  const tasks = [];
  for (const t of tasksData) {
    const createdTask = await prisma.task.create({
      data: {
        title: t.title,
        description: t.desc,
        creatorId: t.creator.id,
        status: t.status,
        priority: t.priority,
        estimatedHours: t.est,
        actualHours: t.act,
        startDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
        dueDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)
      }
    });

    for (const assignee of t.assignees) {
      await prisma.taskAssignee.create({
        data: {
          taskId: createdTask.id,
          userId: assignee.id
        }
      });
    }

    // Auto-create a task-specific chat channel if task has assignees
    const chatChannel = await prisma.channel.create({
      data: {
        type: ChannelType.TASK,
        name: `Task: ${t.title}`,
        taskId: createdTask.id
      }
    });

    // Add creator and assignees as members of the channel
    const members = Array.from(new Set([t.creator.id, ...t.assignees.map(a => a.id)]));
    for (const userId of members) {
      await prisma.channelMember.create({
        data: {
          channelId: chatChannel.id,
          userId
        }
      });
    }

    tasks.push(createdTask);
  }

  // 5. Channels Setup
  // Global channel
  const globalChannel = await prisma.channel.create({
    data: {
      type: ChannelType.GLOBAL,
      name: 'Company General'
    }
  });

  // Add all users to global channel
  for (const user of allUsers) {
    await prisma.channelMember.create({
      data: {
        channelId: globalChannel.id,
        userId: user.id
      }
    });
  }

  // Prepopulate 5 messages in Global Channel
  const messagesData = [
    { sender: admin, content: 'Welcome to CompanyOS! This is the central workforce hub.' },
    { sender: manager1, content: 'Excited to have this up. Engineering team, make sure to check the Kanban board!' },
    { sender: employees[0], content: 'Already clocked in today! The dashboard looks clean.' },
    { sender: manager2, content: 'Sales team meeting scheduled at 2:00 PM today. Check your invites.' },
    { sender: employees[3], content: 'Got it. Preparing the presentation deck now.' }
  ];

  for (let idx = 0; idx < messagesData.length; idx++) {
    const msg = messagesData[idx];
    await prisma.message.create({
      data: {
        channelId: globalChannel.id,
        senderId: msg.sender.id,
        content: msg.content,
        createdAt: new Date(today.getTime() - (5 - idx) * 10 * 60 * 1000) // spaced out by 10m
      }
    });
  }

  // Create a Direct Message (DM) Channel between Manager 1 and Employee 1 (Alice)
  const dmChannel = await prisma.channel.create({
    data: {
      type: ChannelType.DM
    }
  });

  await prisma.channelMember.create({ data: { channelId: dmChannel.id, userId: manager1.id } });
  await prisma.channelMember.create({ data: { channelId: dmChannel.id, userId: employees[0].id } });

  await prisma.message.create({
    data: {
      channelId: dmChannel.id,
      senderId: manager1.id,
      content: 'Hi Alice, how is the dashboard design coming along?'
    }
  });

  await prisma.message.create({
    data: {
      channelId: dmChannel.id,
      senderId: employees[0].id,
      content: 'Almost done! Preparing components with custom Tailwind tokens now.'
    }
  });

  // Create a Group Channel for Engineering
  const groupChannel = await prisma.channel.create({
    data: {
      type: ChannelType.GROUP,
      name: 'Eng Frontend Focus',
      createdBy: manager1.id
    }
  });

  await prisma.channelMember.create({ data: { channelId: groupChannel.id, userId: manager1.id } });
  await prisma.channelMember.create({ data: { channelId: groupChannel.id, userId: employees[0].id } });
  await prisma.channelMember.create({ data: { channelId: groupChannel.id, userId: employees[1].id } });

  await prisma.message.create({
    data: {
      channelId: groupChannel.id,
      senderId: manager1.id,
      content: 'This group is for frontend design systems discussions.'
    }
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
