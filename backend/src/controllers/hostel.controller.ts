import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';
import { EnvironmentType } from '@prisma/client';
import { verifyToken } from '../utils/jwt.js';

export async function getHostels(req: Request, res: Response, next: NextFunction) {
  try {
    let effectiveEnvironment: EnvironmentType | undefined;

    // 1. If caller provides an auth token, enforce caller's authenticated environment
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { environment: true, isActive: true },
        });
        if (user && user.isActive) {
          effectiveEnvironment = user.environment;
        }
      } catch {
        // invalid token; proceed as unauthenticated query
      }
    }

    // 2. If unauthenticated, allow query param filtering by environment
    if (!effectiveEnvironment && req.query.environment) {
      const qEnv = String(req.query.environment).toUpperCase();
      if (qEnv === EnvironmentType.COLLEGE || qEnv === EnvironmentType.PG_SHARED) {
        effectiveEnvironment = qEnv as EnvironmentType;
      } else {
        return res.status(400).json({
          success: false,
          message: `Invalid environment parameter: ${req.query.environment}. Must be COLLEGE or PG_SHARED.`,
        });
      }
    }

    const where = effectiveEnvironment ? { environment: effectiveEnvironment } : {};

    const hostels = await prisma.hostel.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        environment: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return res.status(200).json({
      success: true,
      data: hostels,
      environment: effectiveEnvironment || null,
    });
  } catch (error) {
    next(error);
  }
}
