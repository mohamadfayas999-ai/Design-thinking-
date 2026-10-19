import { Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { Role, ComplaintStatus, OrderStatus } from '../types/models.js';

// ────────────────────────────────────────────────
// GET /api/admin/summary
// Comprehensive system-level metrics & hostel breakdown
// ────────────────────────────────────────────────
export async function getAdminSummary(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin access only.' });
    }

    const env = req.user.environment;
    const { hostelId } = req.query;

    let verifiedHostelId: string | undefined = undefined;
    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      const targetHostel = await prisma.hostel.findUnique({
        where: { id: hostelId },
        select: { id: true, environment: true },
      });
      if (!targetHostel || targetHostel.environment !== env) {
        return res.status(403).json({
          success: false,
          message: 'Access restricted: requested facility belongs to another environment or does not exist.',
        });
      }
      verifiedHostelId = targetHostel.id;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Consolidated queries scoped strictly to the authenticated admin's environment (8 round-trips total)
    const [
      allHostels,
      studentsGrouped,
      staffGrouped,
      ordersGrouped,
      environmentBookings,
      complaints,
      storageLocations,
      itemCountAgg,
    ] = await Promise.all([
      // 1. Hostels in admin environment
      prisma.hostel.findMany({
        where: { environment: env },
        orderBy: { name: 'asc' },
      }),
      // 2. Student count grouped by hostel
      prisma.studentProfile.groupBy({
        by: ['hostelId'],
        where: { hostel: { environment: env } },
        _count: { _all: true },
      }),
      // 3. Staff count grouped by hostel
      prisma.staffProfile.groupBy({
        by: ['hostelId'],
        where: { hostel: { environment: env } },
        _count: { _all: true },
      }),
      // 4. Laundry orders grouped by hostel and status
      prisma.laundryOrder.groupBy({
        by: ['hostelId', 'status'],
        where: { hostel: { environment: env } },
        _count: { _all: true },
      }),
      // 5. Slot bookings with slot timing & dates for booking counts, trends, and peak slot calculation
      prisma.slotBooking.findMany({
        where: {
          slot: { hostel: { environment: env } },
        },
        select: {
          id: true,
          status: true,
          slot: {
            select: {
              hostelId: true,
              date: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      }),
      // 6. Complaints with status and hostel assignment
      prisma.complaint.findMany({
        where: {
          student: { hostel: { environment: env } },
        },
        select: {
          status: true,
          student: {
            select: { hostelId: true },
          },
        },
      }),
      // 7. Active storage locations and their occupation status
      prisma.rackShelfLocation.findMany({
        where: {
          isActive: true,
          hostel: { environment: env },
        },
        select: {
          id: true,
          hostelId: true,
          laundryOrders: {
            where: {
              status: { in: [OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED, OrderStatus.UNDER_REVIEW] },
            },
            select: { id: true },
            take: 1,
          },
        },
      }),
      // 8. Average clothes count across orders in this environment
      prisma.itemCount.aggregate({
        where: {
          laundryOrder: { hostel: { environment: env } },
        },
        _avg: { totalCount: true },
        _count: { id: true },
      }),
    ]);

    // Scope filters based on whether a specific facility was requested and verified
    const targetHostels = verifiedHostelId
      ? allHostels.filter((h) => h.id === verifiedHostelId)
      : allHostels;

    // Filter student counts
    const filteredStudentGroups = verifiedHostelId
      ? studentsGrouped.filter((g) => g.hostelId === verifiedHostelId)
      : studentsGrouped;
    const totalStudents = filteredStudentGroups.reduce((acc, g) => acc + (g._count?._all || 0), 0);

    // Filter staff counts
    const filteredStaffGroups = verifiedHostelId
      ? staffGrouped.filter((g) => g.hostelId === verifiedHostelId)
      : staffGrouped;
    const totalStaff = filteredStaffGroups.reduce((acc, g) => acc + (g._count?._all || 0), 0);

    // Filter order counts
    const filteredOrderGroups = verifiedHostelId
      ? ordersGrouped.filter((g) => g.hostelId === verifiedHostelId)
      : ordersGrouped;

    let inProgressOrders = 0;
    let completedOrders = 0;
    let verifiedOrders = 0;
    let totalOrdersAllTime = 0;
    for (const g of filteredOrderGroups) {
      const count = g._count?._all || 0;
      totalOrdersAllTime += count;
      if (g.status === OrderStatus.IN_PROGRESS) inProgressOrders += count;
      else if (g.status === OrderStatus.COMPLETED) completedOrders += count;
      else if (g.status === OrderStatus.VERIFIED) verifiedOrders += count;
    }

    // Filter slot bookings
    const targetBookings = verifiedHostelId
      ? environmentBookings.filter((b) => b.slot?.hostelId === verifiedHostelId)
      : environmentBookings;

    let todayBookings = 0;
    let totalBookings = targetBookings.length;
    let activeBookings = 0;
    let cancelledBookings = 0;
    let upcomingBookings = 0;

    for (const b of targetBookings) {
      if (b.status === 'BOOKED') {
        activeBookings++;
        if (b.slot?.date === todayStr) {
          todayBookings++;
        }
        if (b.slot?.date && b.slot.date >= todayStr) {
          upcomingBookings++;
        }
      } else if (b.status === 'CANCELLED') {
        cancelledBookings++;
      }
    }

    // Filter complaints
    const targetComplaints = verifiedHostelId
      ? complaints.filter((c) => c.student?.hostelId === verifiedHostelId)
      : complaints;

    let underReviewComplaints = 0;
    let resolvedComplaints = 0;
    for (const c of targetComplaints) {
      if (c.status === ComplaintStatus.UNDER_REVIEW) underReviewComplaints++;
      else if (c.status === ComplaintStatus.RESOLVED) resolvedComplaints++;
    }

    // Filter storage locations
    const targetStorage = verifiedHostelId
      ? storageLocations.filter((l) => l.hostelId === verifiedHostelId)
      : storageLocations;

    const totalStorageLocations = targetStorage.length;
    const occupiedStorageLocations = targetStorage.filter((l) => l.laundryOrders && l.laundryOrders.length > 0).length;
    const availableStorageLocations = Math.max(0, totalStorageLocations - occupiedStorageLocations);
    const storageUtilizationPercent =
      totalStorageLocations > 0
        ? Math.round((occupiedStorageLocations / totalStorageLocations) * 100)
        : 0;

    // Hostel-wise breakdown (computed in memory from the consolidated datasets)
    const hostelSummaries = targetHostels.map((h) => {
      const sCount = studentsGrouped.find((g) => g.hostelId === h.id)?._count?._all || 0;
      const stfCount = staffGrouped.find((g) => g.hostelId === h.id)?._count?._all || 0;

      const hBookings = environmentBookings.filter((b) => b.slot?.hostelId === h.id);
      let tBookings = 0;
      let totalBookingsHostel = hBookings.length;
      let activeBookingsHostel = 0;
      let cancelledBookingsHostel = 0;
      for (const b of hBookings) {
        if (b.status === 'BOOKED') {
          activeBookingsHostel++;
          if (b.slot?.date === todayStr) tBookings++;
        } else if (b.status === 'CANCELLED') {
          cancelledBookingsHostel++;
        }
      }

      const hOrders = ordersGrouped.filter((g) => g.hostelId === h.id);
      let inProg = 0;
      let comp = 0;
      let verif = 0;
      for (const g of hOrders) {
        const count = g._count?._all || 0;
        if (g.status === OrderStatus.IN_PROGRESS) inProg += count;
        else if (g.status === OrderStatus.COMPLETED) comp += count;
        else if (g.status === OrderStatus.VERIFIED) verif += count;
      }

      const complaintsPending = complaints.filter(
        (c) => c.student?.hostelId === h.id && c.status === ComplaintStatus.UNDER_REVIEW
      ).length;

      const hStorage = storageLocations.filter((l) => l.hostelId === h.id);
      const sTotal = hStorage.length;
      const sOccupied = hStorage.filter((l) => l.laundryOrders && l.laundryOrders.length > 0).length;
      const sUtilizationPercent = sTotal > 0 ? Math.round((sOccupied / sTotal) * 100) : 0;

      return {
        id: h.id,
        name: h.name,
        code: h.code,
        description: h.description,
        studentCount: sCount,
        staffCount: stfCount,
        todayBookingsCount: tBookings,
        totalBookingsCount: totalBookingsHostel,
        activeBookingsCount: activeBookingsHostel,
        cancelledBookingsCount: cancelledBookingsHostel,
        inProgressCount: inProg,
        completedCount: comp,
        verifiedCount: verif,
        underReviewComplaintsCount: complaintsPending,
        storageTotal: sTotal,
        storageOccupied: sOccupied,
        storageUtilizationPercent: sUtilizationPercent,
      };
    });

    // Demand Insights scoped to Admin Environment
    let busiestHostel = 'N/A';
    const hostelOrderCounts: Record<string, number> = {};
    for (const g of ordersGrouped) {
      hostelOrderCounts[g.hostelId] = (hostelOrderCounts[g.hostelId] || 0) + (g._count?._all || 0);
    }
    let maxOrderCount = -1;
    let busiestHostelId = '';
    for (const [hId, count] of Object.entries(hostelOrderCounts)) {
      if (count > maxOrderCount) {
        maxOrderCount = count;
        busiestHostelId = hId;
      }
    }
    if (busiestHostelId) {
      const bh = allHostels.find((h) => h.id === busiestHostelId);
      if (bh) busiestHostel = bh.name;
    }

    // Find peak slot time across all bookings in this environment
    let peakSlotTime = '02:00 PM – 03:00 PM';
    if (environmentBookings.length > 0) {
      const slotFrequency: Record<string, number> = {};
      const sample = environmentBookings.slice(0, 200);
      for (const b of sample) {
        if (b.slot?.startTime && b.slot?.endTime) {
          const key = `${b.slot.startTime} – ${b.slot.endTime}`;
          slotFrequency[key] = (slotFrequency[key] || 0) + 1;
        }
      }
      let maxFrequency = -1;
      for (const [timeRange, count] of Object.entries(slotFrequency)) {
        if (count > maxFrequency) {
          maxFrequency = count;
          peakSlotTime = timeRange;
        }
      }
    }

    const avgClothes = itemCountAgg._avg.totalCount ? Math.round(itemCountAgg._avg.totalCount) : 0;

    // 7-day usage trends in this environment (derived in memory from targetBookings)
    const recent7DaysTrends: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const count = targetBookings.filter((b) => b.slot?.date === dateKey).length;
      recent7DaysTrends.push({ date: dateKey, count });
    }


    return res.status(200).json({
      success: true,
      summary: {
        totalStudents,
        totalStaff,
        todayBookings,
        totalBookings,
        activeBookings,
        cancelledBookings,
        upcomingBookings,
        inProgressOrders,
        completedOrders,
        verifiedOrders,
        underReviewComplaints,
        resolvedComplaints,
        totalStorageLocations,
        occupiedStorageLocations,
        availableStorageLocations: Math.max(0, totalStorageLocations - occupiedStorageLocations),
        storageUtilizationPercent,
      },
      hostels: hostelSummaries,
      insights: {
        busiestHostel,
        peakSlotTime,
        totalOrdersAllTime,
        avgClothesPerOrder: avgClothes,
        recent7DaysTrends,
      },
    });
  } catch (error) {
    console.error('[Admin Controller] getAdminSummary failed:', error);
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/admin/orders
// Laundry order monitoring with filters & search
// ────────────────────────────────────────────────
export async function getAdminOrders(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin access only.' });
    }

    const env = req.user.environment;
    const { hostelId, status, dateRange, search } = req.query;

    let verifiedHostelId: string | undefined = undefined;
    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      const targetHostel = await prisma.hostel.findUnique({
        where: { id: hostelId },
        select: { id: true, environment: true },
      });
      if (!targetHostel || targetHostel.environment !== env) {
        return res.status(403).json({
          success: false,
          message: 'Access restricted: requested facility belongs to another environment or does not exist.',
        });
      }
      verifiedHostelId = targetHostel.id;
    }

    const where: any = {
      hostel: { environment: env },
      ...(verifiedHostelId ? { hostelId: verifiedHostelId } : {}),
    };

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    if (dateRange && typeof dateRange === 'string') {
      const now = new Date();
      if (dateRange === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        where.booking = { slot: { date: todayStr } };
      } else if (dateRange === '7days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        where.createdAt = { gte: sevenDaysAgo };
      } else if (dateRange === 'month') {
        const monthAgo = new Date();
        monthAgo.setDate(now.getDate() - 30);
        where.createdAt = { gte: monthAgo };
      }
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = search.trim();
      where.student = {
        OR: [
          { name: { contains: q } },
          { studentId: { contains: q } },
        ],
      };
    }

    const orders = await prisma.laundryOrder.findMany({
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
        hostel: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        booking: {
          include: {
            slot: {
              select: {
                id: true,
                date: true,
                startTime: true,
                endTime: true,
                capacity: true,
              },
            },
          },
        },
        itemCount: {
          select: {
            tShirtShirtCount: true,
            pantsTrackCount: true,
            totalCount: true,
            shirtCount: true,
            tshirtCount: true,
            pantsCount: true,
            jeansCount: true,
            shortsCount: true,
            totalWeightGrams: true,
            isLocked: true,
            lockedAt: true,
          },
        },
        rackShelf: {
          select: {
            id: true,
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
        complaint: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            resolvedAt: true,
          },
        },
        aiScan: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status,
        submittedAt: o.submittedAt,
        startedAt: o.startedAt,
        completedAt: o.completedAt,
        verifiedAt: o.verifiedAt,
        createdAt: o.createdAt,
        student: o.student,
        hostel: o.hostel,
        booking: o.booking
          ? {
              id: o.booking.id,
              status: o.booking.status,
              bookedAt: o.booking.bookedAt,
              createdAt: o.booking.createdAt,
              cancelledAt: o.booking.cancelledAt,
              batchGroupId: o.booking.batchGroupId,
              batchNumber: o.booking.batchNumber,
              totalBatches: o.booking.totalBatches,
              weightGrams: o.booking.weightGrams,
              slot: o.booking.slot,
            }
          : null,
        slot: o.booking?.slot || null,
        itemCount: o.itemCount,
        rackShelf: o.rackShelf, // Visible to admin
        staff: o.staff, // Visible to admin
        complaint: o.complaint,
        aiScan: o.aiScan || null,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/admin/complaints
// Cross-hostel complaint management
// ────────────────────────────────────────────────
export async function getAdminComplaints(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin access only.' });
    }

    const env = req.user.environment;
    const { hostelId, status } = req.query;

    let verifiedHostelId: string | undefined = undefined;
    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      const targetHostel = await prisma.hostel.findUnique({
        where: { id: hostelId },
        select: { id: true, environment: true },
      });
      if (!targetHostel || targetHostel.environment !== env) {
        return res.status(403).json({
          success: false,
          message: 'Access restricted: requested facility belongs to another environment or does not exist.',
        });
      }
      verifiedHostelId = targetHostel.id;
    }

    const where: any = {
      student: {
        hostel: { environment: env },
        ...(verifiedHostelId ? { hostelId: verifiedHostelId } : {}),
      },
    };

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    const complaints = await prisma.complaint.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
            department: true,
            hostel: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        laundryOrder: {
          include: {
            itemCount: true,
            rackShelf: true,
            booking: {
              include: {
                slot: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      count: complaints.length,
      complaints: complaints.map((c) => ({
        id: c.id,
        type: c.type,
        additionalDetails: c.additionalDetails,
        status: c.status,
        createdAt: c.createdAt,
        resolvedAt: c.resolvedAt,
        student: c.student,
        order: {
          id: c.laundryOrder.id,
          status: c.laundryOrder.status,
          startedAt: c.laundryOrder.startedAt,
          completedAt: c.laundryOrder.completedAt,
          verifiedAt: c.laundryOrder.verifiedAt,
          itemCount: c.laundryOrder.itemCount,
          rackShelf: c.laundryOrder.rackShelf,
          slot: c.laundryOrder.booking?.slot || null,
        },
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// PATCH /api/admin/complaints/:id/resolve
// Role-protected complaint resolution
// ────────────────────────────────────────────────
export async function resolveComplaint(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Admin access only.',
      });
    }

    const env = req.user.environment;
    const { id: complaintId } = req.params;

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        laundryOrder: {
          include: { hostel: true },
        },
      },
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
    }

    if (complaint.laundryOrder?.hostel?.environment !== env) {
      return res.status(403).json({
        success: false,
        message: 'Access restricted: complaint belongs to another environment.',
      });
    }

    if (complaint.status !== ComplaintStatus.UNDER_REVIEW) {
      if (complaint.status === ComplaintStatus.RESOLVED) {
        return res.status(400).json({
          success: false,
          message: 'This complaint has already been resolved.',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'This action is not available for the current complaint status.',
      });
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1. Update complaint status → RESOLVED with server timestamp
      await tx.complaint.update({
        where: { id: complaintId },
        data: {
          status: ComplaintStatus.RESOLVED,
          resolvedAt: now,
        },
      });

      // 2. Update order status → RESOLVED
      await tx.laundryOrder.update({
        where: { id: complaint.laundryOrderId },
        data: { status: OrderStatus.RESOLVED },
      });

      // Update booking status so student can book future slots
      if (complaint.laundryOrder.bookingId) {
        await tx.slotBooking.update({
          where: { id: complaint.laundryOrder.bookingId },
          data: { status: 'COMPLETED' },
        });
      }

      // 3. Update LaundryHistory record with resolution
      await tx.laundryHistory.updateMany({
        where: {
          laundryOrderId: complaint.laundryOrderId,
          finalOutcome: 'COMPLAINT',
        },
        data: {
          complaintStatus: ComplaintStatus.RESOLVED,
          resolvedAt: now,
        },
      });

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.userId,
          action: 'COMPLAINT_RESOLVED',
          entityType: 'Complaint',
          entityId: complaintId,
          oldValue: JSON.stringify({ status: ComplaintStatus.UNDER_REVIEW }),
          newValue: JSON.stringify({ status: ComplaintStatus.RESOLVED, resolvedAt: now }),
          reason: 'Admin resolved the complaint',
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Complaint resolved successfully.',
      complaintId,
      status: ComplaintStatus.RESOLVED,
      orderStatus: OrderStatus.RESOLVED,
      resolvedAt: now,
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/admin/storage
// Storage capacity and rack/shelf utilization
// ────────────────────────────────────────────────
export async function getAdminStorage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin access only.' });
    }

    const env = req.user.environment;
    const { hostelId } = req.query;

    let verifiedHostelId: string | undefined = undefined;
    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      const targetHostel = await prisma.hostel.findUnique({
        where: { id: hostelId },
        select: { id: true, environment: true },
      });
      if (!targetHostel || targetHostel.environment !== env) {
        return res.status(403).json({
          success: false,
          message: 'Access restricted: requested facility belongs to another environment or does not exist.',
        });
      }
      verifiedHostelId = targetHostel.id;
    }

    const where: any = {
      isActive: true,
      hostel: { environment: env },
      ...(verifiedHostelId ? { hostelId: verifiedHostelId } : {}),
    };

    const locations = await prisma.rackShelfLocation.findMany({
      where,
      include: {
        hostel: {
          select: { id: true, name: true, code: true },
        },
        laundryOrders: {
          where: { status: { in: ['IN_PROGRESS', 'COMPLETED', 'UNDER_REVIEW'] } },
          select: {
            id: true,
            status: true,
            student: { select: { name: true, studentId: true } },
          },
        },
      },
      orderBy: [
        { hostel: { name: 'asc' } },
        { rackNumber: 'asc' },
        { shelfNumber: 'asc' },
      ],
    });

    const formatted = locations.map((loc) => {
      const activeOrder = loc.laundryOrders[0] || null;
      return {
        id: loc.id,
        hostel: loc.hostel,
        rackNumber: loc.rackNumber,
        shelfNumber: loc.shelfNumber,
        label: loc.label,
        isOccupied: activeOrder !== null,
        occupiedBy: activeOrder
          ? {
              orderId: activeOrder.id,
              studentName: activeOrder.student.name,
              studentId: activeOrder.student.studentId,
              status: activeOrder.status,
            }
          : null,
      };
    });

    const total = formatted.length;
    const occupied = formatted.filter((f) => f.isOccupied).length;
    const available = total - occupied;

    return res.status(200).json({
      success: true,
      stats: {
        total,
        occupied,
        available,
        utilizationPercent: total > 0 ? Math.round((occupied / total) * 100) : 0,
      },
      storage: formatted,
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/admin/slots/today
// Daily slot breakdown across hostels (supports optional ?date=YYYY-MM-DD)
// ────────────────────────────────────────────────
export async function getAdminTodaySlots(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin access only.' });
    }

    const env = req.user.environment;
    const { hostelId, date } = req.query;
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDateStr =
      date && typeof date === 'string' && date.trim().length > 0 ? date.trim() : todayStr;

    let verifiedHostelId: string | undefined = undefined;
    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      const targetHostel = await prisma.hostel.findUnique({
        where: { id: hostelId },
        select: { id: true, environment: true },
      });
      if (!targetHostel || targetHostel.environment !== env) {
        return res.status(403).json({
          success: false,
          message: 'Access restricted: requested facility belongs to another environment or does not exist.',
        });
      }
      verifiedHostelId = targetHostel.id;
    }

    const where: any = {
      date: targetDateStr,
      isActive: true,
      hostel: { environment: env },
      ...(verifiedHostelId ? { hostelId: verifiedHostelId } : {}),
    };

    const slots = await prisma.laundrySlot.findMany({
      where,
      include: {
        hostel: {
          select: { id: true, name: true, code: true, environment: true },
        },
        slotBookings: {
          where: { status: { in: ['BOOKED', 'COMPLETED', 'CANCELLED'] } },
          select: {
            id: true,
            status: true,
            batchNumber: true,
            totalBatches: true,
            weightGrams: true,
            bookedAt: true,
            cancelledAt: true,
            student: {
              select: {
                id: true,
                name: true,
                studentId: true,
                user: { select: { email: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { hostel: { name: 'asc' } },
        { startTime: 'asc' },
      ],
    });

    return res.status(200).json({
      success: true,
      date: targetDateStr,
      slots: slots.map((s) => {
        const activeBookings = s.slotBookings.filter((b) => b.status === 'BOOKED');
        const bookedCount = activeBookings.length;
        const remainingCapacity = Math.max(0, s.capacity - bookedCount);
        const utilization = s.capacity > 0 ? Math.round((bookedCount / s.capacity) * 100) : 0;
        return {
          id: s.id,
          hostel: s.hostel,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          capacity: s.capacity,
          bookedCount,
          remainingCapacity,
          utilizationPercent: utilization,
          bookings: s.slotBookings.map((b) => ({
            id: b.id,
            status: b.status,
            batchNumber: b.batchNumber,
            totalBatches: b.totalBatches,
            weightGrams: b.weightGrams,
            bookedAt: b.bookedAt,
            cancelledAt: b.cancelledAt,
            student: {
              id: b.student.id,
              name: b.student.name,
              studentId: b.student.studentId,
              email: b.student.user.email,
            },
          })),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/admin/students
// Student / Resident management visibility (NO password hashes or QR tokens!)
// ────────────────────────────────────────────────
export async function getAdminStudents(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin access only.' });
    }

    const env = req.user.environment;
    const { hostelId, search } = req.query;

    let verifiedHostelId: string | undefined = undefined;
    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      const targetHostel = await prisma.hostel.findUnique({
        where: { id: hostelId },
        select: { id: true, environment: true },
      });
      if (!targetHostel || targetHostel.environment !== env) {
        return res.status(403).json({
          success: false,
          message: 'Access restricted: requested facility belongs to another environment or does not exist.',
        });
      }
      verifiedHostelId = targetHostel.id;
    }

    const where: any = {
      hostel: { environment: env },
      ...(verifiedHostelId ? { hostelId: verifiedHostelId } : {}),
    };

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = search.trim();
      where.AND = [
        {
          OR: [
            { name: { contains: q } },
            { studentId: { contains: q } },
            { user: { email: { contains: q } } },
          ],
        },
      ];
    }

    const students = await prisma.studentProfile.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            isActive: true,
          },
        },
        hostel: {
          select: {
            id: true,
            name: true,
            code: true,
            environment: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Compute monthly usage & booking summary per student/resident
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const formatted = await Promise.all(
      students.map(async (st) => {
        const [usedCount, totalBookings, activeBookings, completedBookings] = await Promise.all([
          prisma.slotBooking.count({
            where: {
              studentId: st.id,
              createdAt: { gte: startOfMonth, lte: endOfMonth },
              OR: [
                { status: 'BOOKED' },
                { laundryOrder: { isNot: null } },
              ],
            },
          }),
          prisma.slotBooking.count({
            where: { studentId: st.id },
          }),
          prisma.slotBooking.count({
            where: { studentId: st.id, status: 'BOOKED' },
          }),
          prisma.slotBooking.count({
            where: {
              studentId: st.id,
              status: 'COMPLETED',
            },
          }),
        ]);

        return {
          id: st.id,
          name: st.name,
          studentId: st.studentId,
          email: st.user.email,
          isActive: st.user.isActive,
          department: st.department,
          admissionYear: st.admissionYear,
          hostel: st.hostel,
          monthlyUsage: {
            used: usedCount,
            max: 4,
            remaining: Math.max(0, 4 - usedCount),
          },
          bookingSummary: {
            totalBookings,
            activeBookings,
            completedBookings,
          },
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: formatted.length,
      students: formatted,
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/admin/staff
// Staff management visibility (NO password hashes!)
// ────────────────────────────────────────────────
export async function getAdminStaff(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin access only.' });
    }

    const env = req.user.environment;
    const { hostelId } = req.query;

    let verifiedHostelId: string | undefined = undefined;
    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      const targetHostel = await prisma.hostel.findUnique({
        where: { id: hostelId },
        select: { id: true, environment: true },
      });
      if (!targetHostel || targetHostel.environment !== env) {
        return res.status(403).json({
          success: false,
          message: 'Access restricted: requested facility belongs to another environment or does not exist.',
        });
      }
      verifiedHostelId = targetHostel.id;
    }

    const where: any = {
      hostel: { environment: env },
      ...(verifiedHostelId ? { hostelId: verifiedHostelId } : {}),
    };

    const staffMembers = await prisma.staffProfile.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            isActive: true,
          },
        },
        hostel: {
          select: {
            id: true,
            name: true,
            code: true,
            environment: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      count: staffMembers.length,
      staff: staffMembers.map((s) => ({
        id: s.id,
        name: s.name,
        staffId: s.staffId,
        email: s.user.email,
        isActive: s.user.isActive,
        hostel: s.hostel,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/admin/audit-logs
// System audit logs overview
// ────────────────────────────────────────────────
export async function getAdminAuditLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin access only.' });
    }

    const env = req.user.environment;
    const { limit = '50', entityType, action } = req.query;

    const where: any = {
      actorUser: {
        environment: env,
      },
    };
    if (entityType && typeof entityType === 'string') {
      where.entityType = entityType;
    }
    if (action && typeof action === 'string') {
      where.action = action;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        actorUser: {
          select: {
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, parseInt(limit as string, 10) || 50),
    });

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        actor: l.actorUser
          ? { email: l.actorUser.email, role: l.actorUser.role }
          : { email: 'SYSTEM', role: 'SYSTEM' },
        reason: l.reason,
        createdAt: l.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/admin/bookings
// Detailed bookings management across facilities in admin environment
// ────────────────────────────────────────────────
export async function getAdminBookings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin access only.' });
    }

    const env = req.user.environment;
    const { hostelId, status, date, search } = req.query;

    let verifiedHostelId: string | undefined = undefined;
    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      const targetHostel = await prisma.hostel.findUnique({
        where: { id: hostelId },
        select: { id: true, environment: true },
      });
      if (!targetHostel || targetHostel.environment !== env) {
        return res.status(403).json({
          success: false,
          message: 'Access restricted: requested facility belongs to another environment or does not exist.',
        });
      }
      verifiedHostelId = targetHostel.id;
    }

    const where: any = {
      slot: {
        hostel: { environment: env },
        ...(verifiedHostelId ? { hostelId: verifiedHostelId } : {}),
      },
    };

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    if (date && typeof date === 'string' && date.trim().length > 0) {
      where.slot.date = date.trim();
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = search.trim();
      where.student = {
        OR: [
          { name: { contains: q } },
          { studentId: { contains: q } },
          { user: { email: { contains: q } } },
        ],
      };
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
            admissionYear: true,
            user: { select: { email: true } },
            hostel: { select: { id: true, name: true, code: true, environment: true } },
          },
        },
        slot: {
          include: {
            hostel: { select: { id: true, name: true, code: true, environment: true } },
          },
        },
        laundryOrder: {
          include: {
            itemCount: true,
            rackShelf: true,
            staff: { select: { name: true, staffId: true } },
          },
        },
        aiScan: true,
      },
      orderBy: [
        { bookedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 200,
    });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings: bookings.map((b) => ({
        id: b.id,
        status: b.status,
        bookedAt: b.bookedAt,
        createdAt: b.createdAt,
        cancelledAt: b.cancelledAt,
        batchGroupId: b.batchGroupId,
        batchNumber: b.batchNumber,
        totalBatches: b.totalBatches,
        weightGrams: b.weightGrams,
        student: {
          id: b.student.id,
          name: b.student.name,
          studentId: b.student.studentId,
          email: b.student.user.email,
          department: b.student.department,
          admissionYear: b.student.admissionYear,
          hostel: b.student.hostel,
        },
        hostel: b.slot.hostel,
        facility: b.slot.hostel,
        slot: {
          id: b.slot.id,
          date: b.slot.date,
          startTime: b.slot.startTime,
          endTime: b.slot.endTime,
          capacity: b.slot.capacity,
        },
        garmentCounts: b.laundryOrder?.itemCount
          ? {
              shirtCount: b.laundryOrder.itemCount.shirtCount,
              tshirtCount: b.laundryOrder.itemCount.tshirtCount,
              pantsCount: b.laundryOrder.itemCount.pantsCount,
              jeansCount: b.laundryOrder.itemCount.jeansCount,
              shortsCount: b.laundryOrder.itemCount.shortsCount,
              totalCount: b.laundryOrder.itemCount.totalCount,
              totalWeightGrams: b.laundryOrder.itemCount.totalWeightGrams,
            }
          : null,
        order: b.laundryOrder
          ? {
              id: b.laundryOrder.id,
              status: b.laundryOrder.status,
              submittedAt: b.laundryOrder.submittedAt,
              startedAt: b.laundryOrder.startedAt,
              completedAt: b.laundryOrder.completedAt,
              verifiedAt: b.laundryOrder.verifiedAt,
              staff: b.laundryOrder.staff,
              rackShelf: b.laundryOrder.rackShelf,
            }
          : null,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/admin/history
// Environment-scoped laundry history
// ────────────────────────────────────────────────
export async function getAdminHistory(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin access only.' });
    }

    const env = req.user.environment;
    const { hostelId, search } = req.query;

    let verifiedHostelId: string | undefined = undefined;
    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      const targetHostel = await prisma.hostel.findUnique({
        where: { id: hostelId },
        select: { id: true, environment: true },
      });
      if (!targetHostel || targetHostel.environment !== env) {
        return res.status(403).json({
          success: false,
          message: 'Access restricted: requested facility belongs to another environment or does not exist.',
        });
      }
      verifiedHostelId = targetHostel.id;
    }

    const where: any = {
      student: {
        hostel: { environment: env },
        ...(verifiedHostelId ? { hostelId: verifiedHostelId } : {}),
      },
    };

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = search.trim();
      where.student.OR = [
        { name: { contains: q } },
        { studentId: { contains: q } },
      ];
    }

    const histories = await prisma.laundryHistory.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
            user: { select: { email: true } },
            hostel: { select: { id: true, name: true, code: true } },
          },
        },
        laundryOrder: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.status(200).json({
      success: true,
      count: histories.length,
      history: histories.map((h) => ({
        id: h.id,
        bookingDate: h.bookingDate,
        slotTiming: h.slotTiming,
        clothesCount: h.clothesCount,
        processStartedAt: h.processStartedAt,
        completedAt: h.completedAt,
        finalOutcome: h.finalOutcome,
        complaintType: h.complaintType,
        complaintDetails: h.complaintDetails,
        complaintStatus: h.complaintStatus,
        resolvedAt: h.resolvedAt,
        createdAt: h.createdAt,
        student: {
          id: h.student.id,
          name: h.student.name,
          studentId: h.student.studentId,
          email: h.student.user.email,
          hostel: h.student.hostel,
        },
        orderId: h.laundryOrderId,
        orderStatus: h.laundryOrder?.status || null,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/admin/notifications
// Environment-scoped system and resident notifications
// ────────────────────────────────────────────────
export async function getAdminNotifications(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin access only.' });
    }

    const env = req.user.environment;
    const { limit = '50' } = req.query;

    const notifications = await prisma.notification.findMany({
      where: {
        user: { environment: env },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            studentProfile: {
              select: {
                id: true,
                name: true,
                studentId: true,
                hostel: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, parseInt(limit as string, 10) || 50),
    });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt,
        recipient: {
          userId: n.user.id,
          email: n.user.email,
          role: n.user.role,
          name: n.user.studentProfile?.name || 'User',
          studentId: n.user.studentProfile?.studentId || null,
          hostel: n.user.studentProfile?.hostel || null,
        },
      })),
    });
  } catch (error) {
    next(error);
  }
}
