import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt.js';
import { Role } from '../types/models.js';
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

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role as Role,
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

export function requireHostelAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  // Admin has access to all hostels
  if (req.user.role === Role.ADMIN) {
    return next();
  }

  const targetHostelId = req.params.hostelId || req.body.hostelId || req.query.hostelId;
  if (targetHostelId && targetHostelId !== req.user.hostelId) {
    return res.status(403).json({
      success: false,
      message: 'Access restricted: you can only access resources belonging to your hostel',
    });
  }

  next();
}
