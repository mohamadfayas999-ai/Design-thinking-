import { Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { Role } from '../types/models.js';

const MAX_CLOTHES_TOTAL = 20;

// ────────────────────────────────────────────────
// Helper: get staff profile + hostelId from authenticated user
// ────────────────────────────────────────────────
async function getStaffProfile(userId: string) {
  const staff = await prisma.staffProfile.findUnique({
    where: { userId },
    include: { hostel: true },
  });
  return staff;
}

// ────────────────────────────────────────────────
// GET /api/staff/dashboard
// Returns operational summary counts for the staff's hostel
// ────────────────────────────────────────────────
export async function getStaffDashboard(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STAFF) {
      return res.status(403).json({ success: false, message: 'Staff access only' });
    }

    const staff = await getStaffProfile(req.user.userId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff profile not found' });
    }

    const hostelId = staff.hostelId;
    const today = new Date().toISOString().split('T')[0];

    const [todayBookings, waitingCount, inProgressCount, totalStorage, occupiedStorage] =
      await Promise.all([
        // Today's bookings
        prisma.slotBooking.count({
          where: {
            slot: { hostelId, date: today },
            status: { in: ['BOOKED', 'CANCELLED'] },
          },
        }),
        // Waiting for intake (BOOKED status)
        prisma.slotBooking.count({
          where: {
            slot: { hostelId },
            status: 'BOOKED',
          },
        }),
        // In progress
        prisma.laundryOrder.count({
          where: {
            hostelId,
            status: 'IN_PROGRESS',
          },
        }),
        // Total rack/shelf locations
        prisma.rackShelfLocation.count({
          where: { hostelId, isActive: true },
        }),
        // Occupied storage (IN_PROGRESS or COMPLETED — clothes still on rack)
        prisma.rackShelfLocation.count({
          where: {
            hostelId,
            isActive: true,
            laundryOrders: {
              some: {
                status: { in: ['IN_PROGRESS', 'COMPLETED'] },
              },
            },
          },
        }),
      ]);

    // Today's slot breakdown
    const todaySlots = await prisma.laundrySlot.findMany({
      where: { hostelId, date: today, isActive: true },
      include: {
        _count: {
          select: {
            slotBookings: {
              where: { status: 'BOOKED' },
            },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return res.status(200).json({
      success: true,
      dashboard: {
        staff: {
          name: staff.name,
          staffId: staff.staffId,
          hostel: {
            id: staff.hostel.id,
            name: staff.hostel.name,
            code: staff.hostel.code,
          },
        },
        stats: {
          todayBookings,
          waitingCount,
          inProgressCount,
          totalStorage,
          availableStorage: totalStorage - occupiedStorage,
          occupiedStorage,
        },
        todaySlots: todaySlots.map((s) => ({
          id: s.id,
          startTime: s.startTime,
          endTime: s.endTime,
          bookedCount: s._count.slotBookings,
          capacity: s.capacity,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/staff/bookings
// Returns hostel-scoped bookings with optional filters
// Query: date, status, search
// ────────────────────────────────────────────────
export async function getStaffBookings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STAFF) {
      return res.status(403).json({ success: false, message: 'Staff access only' });
    }

    const staff = await getStaffProfile(req.user.userId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff profile not found' });
    }

    const hostelId = staff.hostelId;
    const { date, status, search } = req.query;

    // Build dynamic where clause
    const where: any = {
      slot: { hostelId },
    };

    // Date filter
    if (date && typeof date === 'string') {
      where.slot.date = date;
    }

    // Status filter
    if (status && typeof status === 'string' && ['BOOKED', 'CANCELLED'].includes(status)) {
      where.status = status;
    }

    // Search: student name or student ID — still hostel-scoped
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const searchTerm = search.trim();
      where.student = {
        hostelId, // CRITICAL: force hostel scope on search
        OR: [
          { name: { contains: searchTerm } },
          { studentId: { contains: searchTerm } },
        ],
      };
    } else {
      // Even without search, restrict to hostel students
      where.student = { hostelId };
    }

    const bookings = await prisma.slotBooking.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
            department: true,
            hostelId: true,
          },
        },
        slot: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            hostelId: true,
          },
        },
        aiScan: true,
        laundryOrder: {
          include: {
            aiScan: true,
            itemCount: {
              select: {
                tShirtShirtCount: true,
                pantsTrackCount: true,
                totalCount: true,
                isLocked: true,
              },
            },
            rackShelf: {
              select: {
                rackNumber: true,
                shelfNumber: true,
                label: true,
              },
            },
            staff: {
              select: {
                name: true,
                staffId: true,
              },
            },
          },
        },
      },
      orderBy: [{ slot: { date: 'asc' } }, { slot: { startTime: 'asc' } }],
    });

    return res.status(200).json({
      success: true,
      bookings: bookings.map((b) => ({
        id: b.id,
        status: b.status,
        bookedAt: b.bookedAt,
        cancelledAt: b.cancelledAt,
        student: b.student,
        slot: b.slot,
        aiScan: b.aiScan || b.laundryOrder?.aiScan || null,
        laundryOrder: b.laundryOrder
          ? {
              id: b.laundryOrder.id,
              status: b.laundryOrder.status,
              startedAt: b.laundryOrder.startedAt,
              itemCount: b.laundryOrder.itemCount,
              rackShelf: b.laundryOrder.rackShelf,
              staff: b.laundryOrder.staff,
            }
          : null,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/staff/bookings/:id
// Returns a single booking with full details (hostel-scoped)
// ────────────────────────────────────────────────
export async function getBookingDetail(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STAFF) {
      return res.status(403).json({ success: false, message: 'Staff access only' });
    }

    const staff = await getStaffProfile(req.user.userId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff profile not found' });
    }

    const { id } = req.params;

    const booking = await prisma.slotBooking.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
            department: true,
            hostelId: true,
          },
        },
        slot: true,
        aiScan: true,
        laundryOrder: {
          include: {
            itemCount: true,
            rackShelf: true,
            aiScan: true,
            staff: {
              select: { name: true, staffId: true },
            },
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Verify hostel isolation
    if (booking.slot.hostelId !== staff.hostelId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this booking.',
      });
    }

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/staff/storage
// Returns rack/shelf locations for the staff's hostel with occupancy
// ────────────────────────────────────────────────
export async function getStorage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STAFF) {
      return res.status(403).json({ success: false, message: 'Staff access only' });
    }

    const staff = await getStaffProfile(req.user.userId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff profile not found' });
    }

    const locations = await prisma.rackShelfLocation.findMany({
      where: { hostelId: staff.hostelId, isActive: true },
      include: {
        laundryOrders: {
          where: { status: { in: ['IN_PROGRESS', 'COMPLETED', 'UNDER_REVIEW'] } },
          select: {
            id: true,
            status: true,
            student: { select: { name: true, studentId: true } },
          },
        },
      },
      orderBy: [{ rackNumber: 'asc' }, { shelfNumber: 'asc' }],
    });

    const result = locations.map((loc) => {
      const activeOrder = loc.laundryOrders[0] || null;
      return {
        id: loc.id,
        rackNumber: loc.rackNumber,
        shelfNumber: loc.shelfNumber,
        label: loc.label,
        isOccupied: activeOrder !== null,
        occupiedBy: activeOrder
          ? {
              orderId: activeOrder.id,
              studentName: activeOrder.student.name,
              studentId: activeOrder.student.studentId,
            }
          : null,
      };
    });

    // Group by rack
    const byRack: Record<number, typeof result> = {};
    for (const loc of result) {
      if (!byRack[loc.rackNumber]) byRack[loc.rackNumber] = [];
      byRack[loc.rackNumber].push(loc);
    }

    return res.status(200).json({
      success: true,
      storage: result,
      byRack,
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// POST /api/staff/bookings/:id/intake
// Atomic intake operation:
//   1. Validate staff, booking, hostel scope, status
//   2. Validate clothing counts
//   3. Validate rack/shelf (exists, hostel-scoped, not occupied)
//   4. Transaction: update ItemCount, LaundryOrder, booking status → IN_PROGRESS
//   5. Create AuditLog
// ────────────────────────────────────────────────
export async function performIntake(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STAFF) {
      return res.status(403).json({ success: false, message: 'Staff access only' });
    }

    const staff = await getStaffProfile(req.user.userId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff profile not found' });
    }

    const { id: bookingId } = req.params;
    const { tShirtShirtCount, pantsTrackCount, rackShelfId, aiScanConfirmation } = req.body;

    // ── 1. Rack/shelf required ──
    if (!rackShelfId) {
      return res.status(400).json({
        success: false,
        message: 'Please select a rack and shelf.',
      });
    }

    // ── 2. Clothing count validation ──
    const tCount = Number(tShirtShirtCount);
    const pCount = Number(pantsTrackCount);

    if (!Number.isInteger(tCount) || !Number.isInteger(pCount) || tCount < 0 || pCount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid clothing count.',
      });
    }

    const totalClothes = tCount + pCount;

    if (totalClothes < 1) {
      return res.status(400).json({
        success: false,
        message: 'Please enter at least 1 clothing item.',
      });
    }

    if (totalClothes > MAX_CLOTHES_TOTAL) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_CLOTHES_TOTAL} clothes are allowed per laundry submission.`,
      });
    }

    // ── 3. Fetch the booking ──
    const booking = await prisma.slotBooking.findUnique({
      where: { id: bookingId },
      include: {
        slot: true,
        student: true,
        aiScan: true,
        laundryOrder: {
          include: { itemCount: true, aiScan: true },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // ── 4. Hostel isolation ──
    if (booking.slot.hostelId !== staff.hostelId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this booking.',
      });
    }

    // ── 5. Status check ──
    if (booking.status !== 'BOOKED') {
      if (booking.status === 'CANCELLED') {
        return res.status(400).json({
          success: false,
          message: 'This booking has been cancelled and cannot be processed.',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Only BOOKED laundry bookings can be taken into intake.',
      });
    }

    // ── 6. Already processed check ──
    if (booking.laundryOrder && booking.laundryOrder.status !== 'BOOKED') {
      return res.status(400).json({
        success: false,
        message: `This booking is already in status ${booking.laundryOrder.status} and cannot be taken into intake again.`,
      });
    }

    // ── 6b. Discrepancy protection: Staff cannot alter student booked quantities ──
    if (booking.laundryOrder?.itemCount) {
      const bookedT = booking.laundryOrder.itemCount.tShirtShirtCount;
      const bookedP = booking.laundryOrder.itemCount.pantsTrackCount;
      if (tCount !== bookedT || pCount !== bookedP) {
        return res.status(400).json({
          success: false,
          message: 'Received clothing count does not match student booking. Staff cannot alter booked clothing quantities.',
        });
      }
    }

    // ── 7. Validate rack/shelf ──
    const rackShelf = await prisma.rackShelfLocation.findUnique({
      where: { id: rackShelfId },
      include: {
        laundryOrders: {
          where: { status: { in: ['IN_PROGRESS', 'COMPLETED', 'UNDER_REVIEW'] } },
        },
      },
    });

    if (!rackShelf) {
      return res.status(404).json({
        success: false,
        message: 'Rack/shelf location not found.',
      });
    }

    // Hostel isolation for storage
    if (rackShelf.hostelId !== staff.hostelId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to use this rack/shelf location.',
      });
    }

    // Occupied check
    if (rackShelf.laundryOrders.length > 0) {
      return res.status(409).json({
        success: false,
        message: `This rack/shelf is already occupied. Please select an available location.`,
      });
    }

    // ── 8. Atomic transaction ──
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();

      let laundryOrderId: string;
      let oldItemCountId: string | null = null;

      if (booking.laundryOrder) {
        // Order already exists from Phase 2 booking — update it
        laundryOrderId = booking.laundryOrder.id;
        oldItemCountId = booking.laundryOrder.itemCountId || null;

        // Update ItemCount: overwrite with actual intake count and lock it
        if (oldItemCountId) {
          await tx.itemCount.update({
            where: { id: oldItemCountId },
            data: {
              tShirtShirtCount: tCount,
              pantsTrackCount: pCount,
              totalCount: totalClothes,
              isLocked: true,
              lockedAt: now,
            },
          });
        } else {
          // Create new ItemCount if it doesn't exist
          const newItemCount = await tx.itemCount.create({
            data: {
              tShirtShirtCount: tCount,
              pantsTrackCount: pCount,
              totalCount: totalClothes,
              isLocked: true,
              lockedAt: now,
            },
          });
          oldItemCountId = newItemCount.id;
          // Link to order
          await tx.laundryOrder.update({
            where: { id: laundryOrderId },
            data: { itemCountId: newItemCount.id },
          });
        }

        // Update order: assign staff, rack/shelf, status → IN_PROGRESS
        await tx.laundryOrder.update({
          where: { id: laundryOrderId },
          data: {
            status: 'IN_PROGRESS',
            staffId: staff.id,
            rackShelfId,
            startedAt: now,
            submittedAt: now,
          },
        });
      } else {
        // Create ItemCount
        const itemCount = await tx.itemCount.create({
          data: {
            tShirtShirtCount: tCount,
            pantsTrackCount: pCount,
            totalCount: totalClothes,
            isLocked: true,
            lockedAt: now,
          },
        });

        // Create LaundryOrder
        const order = await tx.laundryOrder.create({
          data: {
            studentId: booking.studentId,
            bookingId: booking.id,
            hostelId: staff.hostelId,
            staffId: staff.id,
            rackShelfId,
            itemCountId: itemCount.id,
            status: 'IN_PROGRESS',
            startedAt: now,
            submittedAt: now,
          },
        });

        laundryOrderId = order.id;
      }

      // Update booking status to track it's in-progress
      // Note: SlotBooking.status is "BOOKED" or "CANCELLED" per schema
      // The LaundryOrder.status reflects actual progress
      // We keep SlotBooking as BOOKED since it was successfully booked
      // (the order status is what shows IN_PROGRESS)

      // If staff confirmed or corrected AI observations, update AiScan
      const targetAiScan = booking.aiScan || booking.laundryOrder?.aiScan;
      if (aiScanConfirmation && targetAiScan) {
        await tx.aiScan.update({
          where: { id: targetAiScan.id },
          data: {
            staffConfirmed: true,
            confirmedType: aiScanConfirmation.confirmedType || targetAiScan.clothingType,
            confirmedColor: aiScanConfirmation.confirmedColor || targetAiScan.mainColor,
            confirmedStain: aiScanConfirmation.confirmedStain || targetAiScan.possibleStain,
            confirmedSeverity: aiScanConfirmation.confirmedSeverity || targetAiScan.stainSeverity,
            confirmedRecommendation:
              aiScanConfirmation.confirmedRecommendation ||
              `${targetAiScan.washMode} (${targetAiScan.preTreatment})`,
            confirmedAt: now,
            confirmedByStaffId: staff.id,
          },
        });
      }

      // Create AuditLog
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.userId,
          action: 'INTAKE',
          entityType: 'LaundryOrder',
          entityId: laundryOrderId,
          newValue: JSON.stringify({
            status: 'IN_PROGRESS',
            tShirtShirtCount: tCount,
            pantsTrackCount: pCount,
            totalCount: totalClothes,
            rackShelfId,
            rackLabel: rackShelf.label,
            staffId: staff.staffId,
          }),
          reason: 'Staff confirmed physical intake of laundry',
        },
      });

      return { laundryOrderId };
    });

    // Fetch the completed order for response
    const finalOrder = await prisma.laundryOrder.findUnique({
      where: { id: result.laundryOrderId },
      include: {
        itemCount: true,
        rackShelf: true,
        student: { select: { name: true, studentId: true } },
        staff: { select: { name: true, staffId: true } },
        booking: {
          include: { slot: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Intake confirmed. Laundry order is now IN_PROGRESS.',
      order: {
        id: finalOrder!.id,
        status: finalOrder!.status,
        startedAt: finalOrder!.startedAt,
        student: finalOrder!.student,
        staff: finalOrder!.staff,
        itemCount: finalOrder!.itemCount,
        rackShelf: finalOrder!.rackShelf,
        slot: {
          date: finalOrder!.booking.slot.date,
          startTime: finalOrder!.booking.slot.startTime,
          endTime: finalOrder!.booking.slot.endTime,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// POST /api/staff/orders/:id/complete
// Staff marks an IN_PROGRESS laundry order as COMPLETED.
// Creates completion timestamp, notification, and audit log.
// Does NOT release the rack/shelf (clothes still there for pickup).
// ────────────────────────────────────────────────
export async function completeOrder(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STAFF) {
      return res.status(403).json({ success: false, message: 'Staff access only' });
    }

    const staff = await getStaffProfile(req.user.userId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff profile not found' });
    }

    const { id: orderId } = req.params;

    const order = await prisma.laundryOrder.findUnique({
      where: { id: orderId },
      include: {
        student: {
          include: { user: { select: { id: true } } },
        },
        itemCount: true,
        rackShelf: true,
        booking: { include: { slot: true } },
        hostel: { select: { name: true, code: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Laundry order not found.' });
    }

    // Hostel isolation
    if (order.hostelId !== staff.hostelId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this laundry order.',
      });
    }

    // Status checks
    if (order.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'This laundry has already been marked as completed.',
      });
    }

    if (order.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        message: 'Only IN_PROGRESS laundry can be marked as completed.',
      });
    }

    // Intake data checks
    if (!order.itemCount || !order.itemCount.isLocked) {
      return res.status(400).json({
        success: false,
        message: 'This order has no valid intake data. Cannot mark as completed.',
      });
    }

    if (!order.rackShelfId) {
      return res.status(400).json({
        success: false,
        message: 'This order has no assigned storage location. Cannot mark as completed.',
      });
    }

    const now = new Date();

    // Atomic transaction
    await prisma.$transaction(async (tx) => {
      // 1. Update order status → COMPLETED with completion timestamp
      await tx.laundryOrder.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          completedAt: now,
        },
      });

      // 2. Create completion notification for student (duplicate-protected)
      const existingNotification = await tx.notification.findFirst({
        where: {
          userId: order.student.user.id,
          type: 'LAUNDRY_COMPLETED',
          isRead: false,
        },
      });

      if (!existingNotification) {
        await tx.notification.create({
          data: {
            userId: order.student.user.id,
            type: 'LAUNDRY_COMPLETED',
            title: 'Laundry Completed',
            message: `Your laundry has been processed and is ready for pickup. ${order.itemCount?.totalCount ?? 0} items.`,
            isRead: false,
          },
        });
      }

      // 3. Audit log
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.userId,
          action: 'COMPLETE',
          entityType: 'LaundryOrder',
          entityId: orderId,
          oldValue: JSON.stringify({ status: 'IN_PROGRESS' }),
          newValue: JSON.stringify({
            status: 'COMPLETED',
            completedAt: now,
            staffId: staff.staffId,
            clothesCount: order.itemCount?.totalCount,
          }),
          reason: 'Staff marked laundry as completed and ready for pickup',
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Laundry order marked as completed. Student notification sent.',
      orderId,
      status: 'COMPLETED',
      completedAt: now,
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/staff/orders/:id
// Returns a single laundry order's details (hostel-scoped)
// ────────────────────────────────────────────────
export async function getOrderDetail(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STAFF) {
      return res.status(403).json({ success: false, message: 'Staff access only' });
    }

    const staff = await getStaffProfile(req.user.userId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff profile not found' });
    }

    const { id } = req.params;

    const order = await prisma.laundryOrder.findUnique({
      where: { id },
      include: {
        student: { select: { name: true, studentId: true, department: true } },
        staff: { select: { name: true, staffId: true } },
        itemCount: true,
        rackShelf: true,
        booking: { include: { slot: true } },
        hostel: { select: { name: true, code: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Laundry order not found.' });
    }

    // Hostel isolation
    if (order.hostelId !== staff.hostelId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this laundry order.',
      });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
}
