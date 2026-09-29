import { Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { Role, ComplaintType, ComplaintStatus, OrderStatus } from '../types/models.js';

const MAX_ADDITIONAL_DETAILS_LENGTH = 1000;

// ────────────────────────────────────────────────
// Helper: get student profile from authenticated user
// ────────────────────────────────────────────────
async function getStudentProfile(userId: string) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    include: { hostel: true },
  });
}

// ────────────────────────────────────────────────
// GET /api/student/notifications
// Returns completion notifications for the authenticated student.
// Only LAUNDRY_COMPLETED notifications that are unread (actionable).
// ────────────────────────────────────────────────
export async function getStudentNotifications(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only' });
    }

    const student = await getStudentProfile(req.user.userId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    // Fetch unread LAUNDRY_COMPLETED notifications for this student only
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.userId,
        type: 'LAUNDRY_COMPLETED',
        isRead: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich each notification with order details (for popup display)
    const enriched = await Promise.all(
      notifications.map(async (n) => {
        // Parse orderId from notification message or use metadata
        // We store the orderId in a structured way via a reference field
        // We'll look for the most recent COMPLETED order for this student
        // that doesn't have a complaint or verification yet
        const order = await prisma.laundryOrder.findFirst({
          where: {
            studentId: student.id,
            status: OrderStatus.COMPLETED,
          },
          include: {
            itemCount: { select: { totalCount: true } },
            booking: { include: { slot: true } },
          },
          orderBy: { completedAt: 'desc' },
        });

        return {
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          isRead: n.isRead,
          createdAt: n.createdAt,
          order: order
            ? {
                id: order.id,
                completedAt: order.completedAt,
                clothesCount: order.itemCount?.totalCount ?? 0,
                slot: order.booking.slot,
              }
            : null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      notifications: enriched,
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// POST /api/student/orders/:id/verify
// Student verifies that laundry is correct after pickup.
// Transition: COMPLETED → VERIFIED
// Releases storage location.
// ────────────────────────────────────────────────
export async function verifyOrder(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only' });
    }

    const student = await getStudentProfile(req.user.userId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const { id: orderId } = req.params;

    // Fetch order with all needed relations
    const order = await prisma.laundryOrder.findUnique({
      where: { id: orderId },
      include: {
        complaint: true,
        itemCount: true,
        booking: { include: { slot: true } },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Laundry order not found.',
      });
    }

    // Ownership check — never use client-supplied student ID
    if (order.studentId !== student.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this laundry.',
      });
    }

    // Status check
    if (order.status === OrderStatus.VERIFIED) {
      return res.status(400).json({
        success: false,
        message: 'This laundry has already been verified.',
      });
    }

    if (order.status !== OrderStatus.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'This action is not available for the current laundry status.',
      });
    }

    // Duplicate check: no previous verification or complaint
    if (order.complaint) {
      return res.status(400).json({
        success: false,
        message: 'A complaint has already been submitted for this laundry.',
      });
    }

    const now = new Date();

    // Atomic transaction
    await prisma.$transaction(async (tx) => {
      // 1. Update order status → VERIFIED, record verifiedAt
      await tx.laundryOrder.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.VERIFIED,
          verifiedAt: now,
        },
      });

      // Update booking status so student can book future slots
      if (order.bookingId) {
        await tx.slotBooking.update({
          where: { id: order.bookingId },
          data: { status: 'COMPLETED' },
        });
      }

      // 2. Create LaundryHistory record
      await tx.laundryHistory.create({
        data: {
          studentId: student.id,
          laundryOrderId: orderId,
          bookingDate: order.booking.slot.date,
          slotTiming: `${order.booking.slot.startTime} – ${order.booking.slot.endTime}`,
          clothesCount: order.itemCount?.totalCount ?? 0,
          processStartedAt: order.startedAt,
          completedAt: order.completedAt,
          finalOutcome: 'VERIFIED',
          complaintType: null,
          complaintDetails: null,
          complaintStatus: null,
          resolvedAt: null,
        },
      });

      // 3. Mark the completion notification as read (handled)
      await tx.notification.updateMany({
        where: {
          userId: req.user!.userId,
          type: 'LAUNDRY_COMPLETED',
          isRead: false,
        },
        data: { isRead: true },
      });

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.userId,
          action: 'VERIFY',
          entityType: 'LaundryOrder',
          entityId: orderId,
          oldValue: JSON.stringify({ status: OrderStatus.COMPLETED }),
          newValue: JSON.stringify({ status: OrderStatus.VERIFIED, verifiedAt: now }),
          reason: 'Student confirmed receipt and verification of laundry',
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Laundry verified successfully.',
      orderId,
      status: OrderStatus.VERIFIED,
      verifiedAt: now,
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// POST /api/student/orders/:id/complaint
// Student submits a complaint about completed laundry.
// Transition: COMPLETED → COMPLAINT (then immediately UNDER_REVIEW)
// ────────────────────────────────────────────────
export async function submitComplaint(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only' });
    }

    const student = await getStudentProfile(req.user.userId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const { id: orderId } = req.params;
    const { type, additionalDetails } = req.body;

    // Validate complaint type
    const validTypes = Object.values(ComplaintType);
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a complaint type.',
      });
    }

    // Validate additionalDetails length
    if (additionalDetails && typeof additionalDetails === 'string') {
      if (additionalDetails.length > MAX_ADDITIONAL_DETAILS_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Additional details must not exceed ${MAX_ADDITIONAL_DETAILS_LENGTH} characters.`,
        });
      }
    }

    // Fetch order
    const order = await prisma.laundryOrder.findUnique({
      where: { id: orderId },
      include: {
        complaint: true,
        itemCount: true,
        booking: { include: { slot: true } },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Laundry order not found.',
      });
    }

    // Ownership check
    if (order.studentId !== student.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this laundry.',
      });
    }

    // Status check: only COMPLETED can receive a complaint
    if (order.status !== OrderStatus.COMPLETED) {
      if (order.status === OrderStatus.COMPLAINT || order.status === OrderStatus.UNDER_REVIEW) {
        return res.status(400).json({
          success: false,
          message: 'A complaint has already been submitted for this laundry.',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'This action is not available for the current laundry status.',
      });
    }

    // Duplicate complaint check
    if (order.complaint) {
      return res.status(400).json({
        success: false,
        message: 'A complaint has already been submitted for this laundry.',
      });
    }

    const now = new Date();
    const sanitizedDetails =
      additionalDetails && typeof additionalDetails === 'string'
        ? additionalDetails.trim().slice(0, MAX_ADDITIONAL_DETAILS_LENGTH)
        : null;

    // Atomic transaction
    const complaint = await prisma.$transaction(async (tx) => {
      // 1. Update order status → UNDER_REVIEW
      await tx.laundryOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.UNDER_REVIEW },
      });

      // 2. Create Complaint record
      const newComplaint = await tx.complaint.create({
        data: {
          laundryOrderId: orderId,
          studentId: student.id,
          type,
          additionalDetails: sanitizedDetails,
          status: ComplaintStatus.UNDER_REVIEW,
          createdAt: now,
        },
      });

      // 3. Create LaundryHistory record
      await tx.laundryHistory.create({
        data: {
          studentId: student.id,
          laundryOrderId: orderId,
          bookingDate: order.booking.slot.date,
          slotTiming: `${order.booking.slot.startTime} – ${order.booking.slot.endTime}`,
          clothesCount: order.itemCount?.totalCount ?? 0,
          processStartedAt: order.startedAt,
          completedAt: order.completedAt,
          finalOutcome: 'COMPLAINT',
          complaintType: type,
          complaintDetails: sanitizedDetails,
          complaintStatus: ComplaintStatus.UNDER_REVIEW,
          resolvedAt: null,
        },
      });

      // 4. Mark completion notification as read
      await tx.notification.updateMany({
        where: {
          userId: req.user!.userId,
          type: 'LAUNDRY_COMPLETED',
          isRead: false,
        },
        data: { isRead: true },
      });

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.userId,
          action: 'COMPLAINT_SUBMITTED',
          entityType: 'LaundryOrder',
          entityId: orderId,
          oldValue: JSON.stringify({ status: OrderStatus.COMPLETED }),
          newValue: JSON.stringify({
            status: OrderStatus.UNDER_REVIEW,
            complaintType: type,
            complaintId: newComplaint.id,
          }),
          reason: `Student submitted complaint: ${type}`,
        },
      });

      return newComplaint;
    });

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted. Your complaint is under review.',
      complaint: {
        id: complaint.id,
        type: complaint.type,
        additionalDetails: complaint.additionalDetails,
        status: complaint.status,
        createdAt: complaint.createdAt,
      },
      orderStatus: OrderStatus.UNDER_REVIEW,
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/student/history
// Returns the authenticated student's full laundry history.
// Student can only see their own history.
// ────────────────────────────────────────────────
export async function getStudentHistory(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only' });
    }

    const student = await getStudentProfile(req.user.userId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    // Fetch all completed laundry orders for this student
    // Orders with VERIFIED, COMPLAINT, UNDER_REVIEW, or RESOLVED status
    const orders = await prisma.laundryOrder.findMany({
      where: {
        studentId: student.id,
        status: {
          in: [
            OrderStatus.VERIFIED,
            OrderStatus.COMPLAINT,
            OrderStatus.UNDER_REVIEW,
            OrderStatus.RESOLVED,
          ],
        },
      },
      include: {
        booking: { include: { slot: true } },
        itemCount: { select: { totalCount: true, tShirtShirtCount: true, pantsTrackCount: true } },
        complaint: true,
        histories: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { completedAt: 'desc' },
    });

    const history = orders.map((order) => ({
      orderId: order.id,
      status: order.status,
      bookingDate: order.booking.slot.date,
      slotTiming: `${order.booking.slot.startTime} – ${order.booking.slot.endTime}`,
      clothesCount: order.itemCount?.totalCount ?? 0,
      startedAt: order.startedAt,
      completedAt: order.completedAt,
      verifiedAt: order.verifiedAt,
      complaint: order.complaint
        ? {
            id: order.complaint.id,
            type: order.complaint.type,
            additionalDetails: order.complaint.additionalDetails,
            status: order.complaint.status,
            createdAt: order.complaint.createdAt,
            resolvedAt: order.complaint.resolvedAt,
          }
        : null,
    }));

    return res.status(200).json({
      success: true,
      history,
      count: history.length,
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/student/complaints
// Returns the authenticated student's complaint status.
// ────────────────────────────────────────────────
export async function getStudentComplaints(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only' });
    }

    const student = await getStudentProfile(req.user.userId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const complaints = await prisma.complaint.findMany({
      where: { studentId: student.id },
      include: {
        laundryOrder: {
          include: {
            booking: { include: { slot: true } },
            itemCount: { select: { totalCount: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      complaints: complaints.map((c) => ({
        id: c.id,
        type: c.type,
        additionalDetails: c.additionalDetails,
        status: c.status,
        createdAt: c.createdAt,
        resolvedAt: c.resolvedAt,
        order: {
          id: c.laundryOrder.id,
          status: c.laundryOrder.status,
          completedAt: c.laundryOrder.completedAt,
          clothesCount: c.laundryOrder.itemCount?.totalCount ?? 0,
          bookingDate: c.laundryOrder.booking.slot.date,
          slotTiming: `${c.laundryOrder.booking.slot.startTime} – ${c.laundryOrder.booking.slot.endTime}`,
        },
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/student/orders/:id
// Returns a single laundry order for the authenticated student.
// Does NOT expose rack/shelf or staff information.
// ────────────────────────────────────────────────
export async function getStudentOrder(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only' });
    }

    const student = await getStudentProfile(req.user.userId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const { id: orderId } = req.params;

    const order = await prisma.laundryOrder.findUnique({
      where: { id: orderId },
      include: {
        booking: { include: { slot: true } },
        itemCount: { select: { totalCount: true, tShirtShirtCount: true, pantsTrackCount: true } },
        complaint: true,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Laundry order not found.' });
    }

    // Ownership check
    if (order.studentId !== student.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this laundry.',
      });
    }

    return res.status(200).json({
      success: true,
      order: {
        id: order.id,
        status: order.status,
        completedAt: order.completedAt,
        verifiedAt: order.verifiedAt,
        startedAt: order.startedAt,
        clothesCount: order.itemCount?.totalCount ?? 0,
        bookingDate: order.booking.slot.date,
        slotTiming: `${order.booking.slot.startTime} – ${order.booking.slot.endTime}`,
        complaint: order.complaint
          ? {
              id: order.complaint.id,
              type: order.complaint.type,
              additionalDetails: order.complaint.additionalDetails,
              status: order.complaint.status,
              createdAt: order.complaint.createdAt,
              resolvedAt: order.complaint.resolvedAt,
            }
          : null,
        // Never expose: rackShelfId, staffId, internal audit logs
      },
    });
  } catch (error) {
    next(error);
  }
}
