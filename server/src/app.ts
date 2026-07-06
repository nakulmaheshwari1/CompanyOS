import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';

// Import routers
import authRouter from './routes/auth';
import userRouter from './routes/user';
import departmentRouter from './routes/department';
import attendanceRouter from './routes/attendance';
import taskRouter from './routes/task';
import chatRouter from './routes/chat';
import notificationRouter from './routes/notification';

const app = express();

// CORS configuration
app.use(cors({
  origin: [config.clientUrl, 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Simple inline cookie-parser middleware to avoid external dependencies
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie || '';
  (req as any).cookies = cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, ...val] = cookie.trim().split('=');
    if (name) {
      cookies[name] = decodeURIComponent(val.join('='));
    }
    return cookies;
  }, {} as Record<string, string>);
  next();
});

// Route registration
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/departments', departmentRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/channels', chatRouter);
app.use('/api/notifications', notificationRouter);

// Global Error Handler
app.use(errorHandler);

export default app;
