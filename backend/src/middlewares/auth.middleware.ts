import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt.js';
import { Role } from '../types/models.js';
import { EnvironmentType } from '@prisma/client';
import { prisma } from '../prisma.js';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload & {
    name?: string;
    studentProfileId?: string;
    staffProfileId?: string;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token required',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        studentProfile: true,
        staffProfile: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive or not found',
      });
    }

    if (decoded.environment && decoded.environment !== user.environment) {
      return res.status(401).json({
        success: false,
        message: 'Token environment does not match user account environment',
      });
    }

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role as Role,
      environment: user.environment, // Loaded authoritatively from database!
      hostelId: user.hostelId,
      name: user.studentProfile?.name || user.staffProfile?.name || 'Admin',
      studentProfileId: user.studentProfile?.id,
      staffProfileId: user.staffProfile?.id,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token',
    });
  }
}

export function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: role ${req.user.role} does not have permission for this resource`,
      });
    }

    next();
  };
}

export function requireEnvironment(allowedEnvironments: EnvironmentType[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.environment) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required with valid environment',
      });
    }

    if (!allowedEnvironments.includes(req.user.environment)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: environment ${req.user.environment} is not authorized for this resource`,
      });
    }

    next();
  };
}

export async function requireHostelAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  const targetHostelId = req.params.hostelId || req.body.hostelId || req.query.hostelId;

  // If no target hostel is referenced in request parameters/body, proceed
  if (!targetHostelId || typeof targetHostelId !== 'string' || targetHostelId === 'ALL') {
    return next();
  }

  try {
    const targetHostel = await prisma.hostel.findUnique({
      where: { id: targetHostelId },
      select: { id: true, environment: true },
    });

    if (!targetHostel) {
      return res.status(404).json({
        success: false,
        message: 'Target facility does not exist',
      });
    }

    // Cross-environment access is strictly prohibited for all roles (including Admin)
    if (targetHostel.environment !== req.user.environment) {
      return res.status(403).json({
        success: false,
        message: 'Access restricted: facility belongs to another environment',
      });
    }

    // Admin can access any hostel within their own environment
    if (req.user.role === Role.ADMIN) {
      return next();
    }

    // Student / Staff can only access their assigned hostel
    if (targetHostel.id !== req.user.hostelId) {
      return res.status(403).json({
        success: false,
        message: 'Access restricted: you can only access resources belonging to your hostel',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}

