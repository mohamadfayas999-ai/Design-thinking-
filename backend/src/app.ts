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
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API router
  app.use('/api', routes);

  // Centralized Error handler
  app.use(errorHandler);

  return app;
}
