import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('[Error Caught by Middleware]:', err);

  const isDatabaseError =
    err?.name?.startsWith?.('Prisma') ||
    err?.code === 'P1001' ||
    err?.code === 'P2024' ||
    (typeof err?.message === 'string' &&
      (err.message.includes('reach database server') ||
        err.message.includes('Can\'t reach database') ||
        err.message.includes('connection pool') ||
        err.message.includes('prisma.') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ETIMEDOUT') ||
        err.message.includes(':5432')));

  if (isDatabaseError) {
    const isUnreachableOrTimeout =
      err?.code === 'P1001' ||
      err?.code === 'P2024' ||
      err?.name === 'PrismaClientInitializationError' ||
      (typeof err?.message === 'string' &&
        (err.message.includes('reach database server') ||
          err.message.includes('connection pool') ||
          err.message.includes('ETIMEDOUT')));

    const statusCode = isUnreachableOrTimeout ? 503 : 500;
    return res.status(statusCode).json({
      success: false,
      message: 'Database service is temporarily unavailable. Please try again shortly.',
    });
  }

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  const message = err.message || 'An unexpected internal server error occurred';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
