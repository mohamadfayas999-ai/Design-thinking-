import { Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { Role, EnvironmentType, OrderStatus } from '../types/models.js';

// ────────────────────────────────────────────────
// Helper: Resolve student profile for authenticated user
// ────────────────────────────────────────────────
async function getStudentProfile(userId: string) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    include: { hostel: true },
  });
}

// ────────────────────────────────────────────────
// POST /api/student/pg/orders/:id/start-wash
// PG Resident explicitly starts self-service wash cycle on machine
// Lifecycle transition: BOOKED → IN_PROGRESS
// ────────────────────────────────────────────────
export async function startPgSelfServiceWash(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only.' });
    }

    // Environment Isolation: PG_SHARED residents only
    if (req.user.environment !== EnvironmentType.PG_SHARED) {
      return res.status(403).json({
        success: false,
        message: 'PG self-service actions are only available to residents in the PG & Shared Living environment.',
      });
    }

    const student = await getStudentProfile(req.user.userId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const { id: orderId } = req.params;

    const order = await prisma.laundryOrder.findUnique({
      where: { id: orderId },
      include: {
        itemCount: true,
        booking: { include: { slot: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Laundry order not found.' });
    }

    // Ownership Verification
    if (order.studentId !== student.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to manage this laundry order.',
      });
    }

    // Status Validation
    if (order.status !== OrderStatus.BOOKED) {
      return res.status(400).json({
        success: false,
        message: `Cannot start wash cycle: order is currently in status ${order.status}. Only BOOKED orders can be started.`,
      });
    }

    const now = new Date();

    // Atomic transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Update order status → IN_PROGRESS
      const updated = await tx.laundryOrder.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.IN_PROGRESS,
          startedAt: now,
        },
        include: {
          itemCount: true,
          booking: { include: { slot: true } },
        },
      });

      // 2. Lock ItemCount if present
      if (order.itemCountId) {
        await tx.itemCount.update({
          where: { id: order.itemCountId },
          data: {
            isLocked: true,
            lockedAt: now,
          },
        });
      }

      // 3. Create AuditLog
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.userId,
          action: 'PG_SELF_SERVICE_START',
          entityType: 'LaundryOrder',
          entityId: orderId,
          oldValue: JSON.stringify({ status: OrderStatus.BOOKED }),
          newValue: JSON.stringify({ status: OrderStatus.IN_PROGRESS, startedAt: now }),
          reason: 'PG resident started self-service wash cycle',
        },
      });

      return updated;
    });

    return res.status(200).json({
      success: true,
      message: 'Self-service wash cycle started. Laundry is now IN_PROGRESS.',
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        startedAt: updatedOrder.startedAt,
        slot: updatedOrder.booking.slot,
        itemCount: updatedOrder.itemCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// POST /api/student/pg/orders/:id/complete-wash
// PG Resident explicitly marks self-service wash finished
// Lifecycle transition: IN_PROGRESS → COMPLETED
// ────────────────────────────────────────────────
export async function completePgSelfServiceWash(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only.' });
    }

    // Environment Isolation: PG_SHARED residents only
    if (req.user.environment !== EnvironmentType.PG_SHARED) {
      return res.status(403).json({
        success: false,
        message: 'PG self-service actions are only available to residents in the PG & Shared Living environment.',
      });
    }

    const student = await getStudentProfile(req.user.userId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const { id: orderId } = req.params;

    const order = await prisma.laundryOrder.findUnique({
      where: { id: orderId },
      include: {
        itemCount: true,
        booking: { include: { slot: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Laundry order not found.' });
    }

    // Ownership Verification
    if (order.studentId !== student.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to manage this laundry order.',
      });
    }

    // Status Validation
    if (order.status !== OrderStatus.IN_PROGRESS) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete wash cycle: order is currently in status ${order.status}. Only IN_PROGRESS orders can be completed.`,
      });
    }

    const now = new Date();

    // Atomic transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Update order status → COMPLETED
      const updated = await tx.laundryOrder.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.COMPLETED,
          completedAt: now,
        },
        include: {
          itemCount: true,
          booking: { include: { slot: true } },
        },
      });

      // 2. Create completion notification for resident
      await tx.notification.create({
        data: {
          userId: req.user!.userId,
          type: 'LAUNDRY_COMPLETED',
          title: 'Self-Service Wash Completed',
          message: `Your laundry cycle has finished. ${updated.itemCount?.totalCount ?? 0} items processed. Please verify your items.`,
          isRead: false,
        },
      });

      // 3. Create AuditLog
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.userId,
          action: 'PG_SELF_SERVICE_COMPLETE',
          entityType: 'LaundryOrder',
          entityId: orderId,
          oldValue: JSON.stringify({ status: OrderStatus.IN_PROGRESS }),
          newValue: JSON.stringify({ status: OrderStatus.COMPLETED, completedAt: now }),
          reason: 'PG resident marked self-service wash cycle completed',
        },
      });

      return updated;
    });

    return res.status(200).json({
      success: true,
      message: 'Self-service wash cycle marked completed. Please verify your laundry.',
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        completedAt: updatedOrder.completedAt,
        slot: updatedOrder.booking.slot,
        itemCount: updatedOrder.itemCount,
      },
    });
  } catch (error) {
    next(error);
  }
}
