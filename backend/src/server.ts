import { createApp } from './app.js';
import { ENV } from './config/env.js';

const app = createApp();

const server = app.listen(ENV.PORT, () => {
  console.log(`=========================================`);
  console.log(`💧 WASHWISE Backend API Server Running`);
  console.log(`📡 URL: http://localhost:${ENV.PORT}`);
  console.log(`🩺 Health: http://localhost:${ENV.PORT}/api/health`);
  console.log(`🔐 Phase 1 Foundation & Architecture Active`);
  console.log(`=========================================`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
  });
});
