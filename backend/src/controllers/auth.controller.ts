import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';
import { comparePassword } from '../utils/hash.js';
import { generateToken } from '../utils/jwt.js';
import { Role } from '../types/models.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, role, hostelId } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and role are required',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Verify role validity
    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role provided',
      });
    }

    // Role-specific hostel validation
    if ((role === Role.STUDENT || role === Role.STAFF) && !hostelId) {
      return res.status(400).json({
        success: false,
        message: 'Please select your hostel before logging in',
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
        hostel: true,
        studentProfile: {
          include: {
            hostel: true,
          },
        },
        staffProfile: {
          include: {
            hostel: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User does not exist.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated.',
      });
    }

    // Verify requested role matches actual user role
    if (user.role !== role) {
      return res.status(401).json({
        success: false,
        message: `Account is registered as ${user.role}, not ${role}`,
      });
    }

    // Verify hostel matches if student or staff
    if (role === Role.STUDENT || role === Role.STAFF) {
      if (user.hostelId !== hostelId) {
        return res.status(401).json({
          success: false,
          message: 'The selected hostel does not match your registered hostel',
        });
      }
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Incorrect password.',
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as Role,
      hostelId: user.hostelId,
    });

    // Format safe response object (omitting passwordHash and opaque QR token)
    const displayName =
      user.studentProfile?.name || user.staffProfile?.name || 'College Laundry Administrator';

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: displayName,
        hostelId: user.hostelId,
        hostelName: user.hostel?.name || null,
        studentId: user.studentProfile?.studentId || null,
        department: user.studentProfile?.department || null,
        admissionYear: user.studentProfile?.admissionYear || null,
        staffId: user.staffProfile?.staffId || null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        hostel: true,
        studentProfile: {
          include: { hostel: true },
        },
        staffProfile: {
          include: { hostel: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    const displayName =
      user.studentProfile?.name || user.staffProfile?.name || 'College Laundry Administrator';

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: displayName,
        hostelId: user.hostelId,
        hostelName: user.hostel?.name || null,
        studentId: user.studentProfile?.studentId || null,
        department: user.studentProfile?.department || null,
        admissionYear: user.studentProfile?.admissionYear || null,
        staffId: user.staffProfile?.staffId || null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
}

// Student-authorized dedicated endpoint for digital identification QR token
export async function getStudentPermanentQr(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({
        success: false,
        message: 'Only registered students can access their digital QR token',
      });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: req.user.userId },
      select: {
        id: true,
        name: true,
        studentId: true,
        permanentQrToken: true,
      },
    });

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found',
      });
    }

    return res.status(200).json({
      success: true,
      qrToken: studentProfile.permanentQrToken,
      studentId: studentProfile.studentId,
    });
  } catch (error) {
    next(error);
  }
}
