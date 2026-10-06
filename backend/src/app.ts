import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';

export function createApp() {
  const app = express();

  // Standard middleware
  app.use(
    cors({
      origin: '*', // Allow frontend development origin
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API router
  app.use('/api', routes);

  // 404 handler: always return JSON for undefined routes (never HTML)
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Centralized Error handler
  app.use(errorHandler);

  return app;
}
