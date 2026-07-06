import http from 'http';
import app from './app';
import { setupSocketIO } from './socket';
import { setupCronJobs } from './jobs/cron';
import { config } from './config';
import prisma from './prisma/client';

const server = http.createServer(app);

// Initialize Socket.io
const io = setupSocketIO(server);

// Share the Socket.io instance with Express controllers
app.set('io', io);

// Initialize Background Cron Jobs
setupCronJobs(io);

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Database connected successfully.');

    server.listen(config.port, () => {
      console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
