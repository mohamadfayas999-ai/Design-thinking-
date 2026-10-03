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

    const { hostelId } = req.query;
    const hostelFilter = hostelId && typeof hostelId === 'string' && hostelId !== 'ALL'
      ? hostelId
      : undefined;

    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Core Counts
    const studentWhere = hostelFilter ? { hostelId: hostelFilter } : {};
    const staffWhere = hostelFilter ? { hostelId: hostelFilter } : {};
    const orderWhere = hostelFilter ? { hostelId: hostelFilter } : {};
    const storageWhere = hostelFilter ? { hostelId: hostelFilter, isActive: true } : { isActive: true };

    const [
      totalStudents,
      totalStaff,
      todayBookings,
      inProgressOrders,
      completedOrders,
      verifiedOrders,
      underReviewComplaints,
      resolvedComplaints,
      totalStorageLocations,
      occupiedStorageLocations,
      allHostels,
    ] = await Promise.all([
      prisma.studentProfile.count({ where: studentWhere }),
      prisma.staffProfile.count({ where: staffWhere }),
      prisma.slotBooking.count({
        where: {
          slot: {
            date: todayStr,
            ...(hostelFilter ? { hostelId: hostelFilter } : {}),
          },
          status: 'BOOKED',
        },
      }),
      prisma.laundryOrder.count({
        where: {
          ...orderWhere,
          status: OrderStatus.IN_PROGRESS,
        },
      }),
      prisma.laundryOrder.count({
        where: {
          ...orderWhere,
          status: OrderStatus.COMPLETED,
        },
      }),
      prisma.laundryOrder.count({
        where: {
          ...orderWhere,
          status: OrderStatus.VERIFIED,
        },
      }),
      prisma.complaint.count({
        where: {
          status: ComplaintStatus.UNDER_REVIEW,
          ...(hostelFilter ? { student: { hostelId: hostelFilter } } : {}),
        },
      }),
      prisma.complaint.count({
        where: {
          status: ComplaintStatus.RESOLVED,
          ...(hostelFilter ? { student: { hostelId: hostelFilter } } : {}),
        },
      }),
      prisma.rackShelfLocation.count({ where: storageWhere }),
      prisma.rackShelfLocation.count({
        where: {
          ...storageWhere,
          laundryOrders: {
            some: {
              status: { in: ['IN_PROGRESS', 'COMPLETED', 'UNDER_REVIEW'] },
            },
          },
        },
      }),
      prisma.hostel.findMany({
        orderBy: { name: 'asc' },
      }),
    ]);

    // 2. Hostel-wise Breakdown
    const targetHostels = hostelFilter
      ? allHostels.filter((h) => h.id === hostelFilter)
      : allHostels;

    const hostelSummaries = await Promise.all(
      targetHostels.map(async (h) => {
        const [
          sCount,
          stfCount,
          tBookings,
          inProg,
          comp,
          verif,
          complaintsPending,
          sTotal,
          sOccupied,
        ] = await Promise.all([
          prisma.studentProfile.count({ where: { hostelId: h.id } }),
          prisma.staffProfile.count({ where: { hostelId: h.id } }),
          prisma.slotBooking.count({
            where: {
              slot: { date: todayStr, hostelId: h.id },
              status: 'BOOKED',
            },
          }),
          prisma.laundryOrder.count({
            where: { hostelId: h.id, status: OrderStatus.IN_PROGRESS },
          }),
          prisma.laundryOrder.count({
            where: { hostelId: h.id, status: OrderStatus.COMPLETED },
          }),
          prisma.laundryOrder.count({
            where: { hostelId: h.id, status: OrderStatus.VERIFIED },
          }),
          prisma.complaint.count({
            where: { student: { hostelId: h.id }, status: ComplaintStatus.UNDER_REVIEW },
          }),
          prisma.rackShelfLocation.count({ where: { hostelId: h.id, isActive: true } }),
          prisma.rackShelfLocation.count({
            where: {
              hostelId: h.id,
              isActive: true,
              laundryOrders: {
                some: { status: { in: ['IN_PROGRESS', 'COMPLETED', 'UNDER_REVIEW'] } },
              },
            },
          }),
        ]);

        return {
          id: h.id,
          name: h.name,
          code: h.code,
          description: h.description,
          studentCount: sCount,
          staffCount: stfCount,
          todayBookingsCount: tBookings,
          inProgressCount: inProg,
          completedCount: comp,
          verifiedCount: verif,
          underReviewComplaintsCount: complaintsPending,
          storageTotal: sTotal,
          storageOccupied: sOccupied,
          storageUtilizationPercent: sTotal > 0 ? Math.round((sOccupied / sTotal) * 100) : 0,
        };
      })
    );

    // 3. Demand Insights (transparent descriptive analytics from real database data)
    // Find busiest hostel
    let busiestHostel = 'N/A';
    const ordersByHostel = await prisma.laundryOrder.groupBy({
      by: ['hostelId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });
    if (ordersByHostel.length > 0) {
      const bh = allHostels.find((h) => h.id === ordersByHostel[0].hostelId);
      if (bh) busiestHostel = bh.name;
    }

    // Find peak slot time across all bookings
    let peakSlotTime = '02:00 PM – 03:00 PM';
    const allBookingsWithSlots = await prisma.slotBooking.findMany({
      select: {
        slot: {
          select: { startTime: true, endTime: true },
        },
      },
      take: 200,
    });
    if (allBookingsWithSlots.length > 0) {
      const slotFrequency: Record<string, number> = {};
      for (const b of allBookingsWithSlots) {
        if (b.slot) {
          const key = `${b.slot.startTime} – ${b.slot.endTime}`;
          slotFrequency[key] = (slotFrequency[key] || 0) + 1;
        }
      }
      let maxCount = -1;
      for (const [timeRange, count] of Object.entries(slotFrequency)) {
        if (count > maxCount) {
          maxCount = count;
          peakSlotTime = timeRange;
        }
      }
    }

    // Average clothes count across orders
    const itemCountAgg = await prisma.itemCount.aggregate({
      _avg: { totalCount: true },
      _count: { id: true },
    });
    const avgClothes = itemCountAgg._avg.totalCount ? Math.round(itemCountAgg._avg.totalCount) : 0;

    // 7-day usage trends
    const recent7DaysTrends: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const count = await prisma.slotBooking.count({
        where: {
          slot: {
            date: dateKey,
            ...(hostelFilter ? { hostelId: hostelFilter } : {}),
          },
        },
      });
      recent7DaysTrends.push({ date: dateKey, count });
    }

    const storageUtilizationPercent =
      totalStorageLocations > 0
        ? Math.round((occupiedStorageLocations / totalStorageLocations) * 100)
        : 0;

    return res.status(200).json({
      success: true,
      summary: {
        totalStudents,
        totalStaff,
        todayBookings,
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
        totalOrdersAllTime: await prisma.laundryOrder.count(hostelFilter ? { where: { hostelId: hostelFilter } } : undefined),
        avgClothesPerOrder: avgClothes,
        recent7DaysTrends,
      },
    });
  } catch (error) {
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

    const { hostelId, status, dateRange, search } = req.query;

    const where: any = {};

    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      where.hostelId = hostelId;
    }

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
              },
            },
          },
        },
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

    const { hostelId, status } = req.query;

    const where: any = {};

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      where.student = { hostelId };
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

    const { id: complaintId } = req.params;

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { laundryOrder: true },
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found.',
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

    const { hostelId } = req.query;
    const where: any = { isActive: true };
    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      where.hostelId = hostelId;
    }

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
// Daily slot breakdown across hostels
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

    const { hostelId } = req.query;
    const todayStr = new Date().toISOString().split('T')[0];

    const where: any = {
      date: todayStr,
      isActive: true,
    };
    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      where.hostelId = hostelId;
    }

    const slots = await prisma.laundrySlot.findMany({
      where,
      include: {
        hostel: {
          select: { id: true, name: true, code: true },
        },
        slotBookings: {
          where: { status: 'BOOKED' },
          select: { id: true },
        },
      },
      orderBy: [
        { hostel: { name: 'asc' } },
        { startTime: 'asc' },
      ],
    });

    return res.status(200).json({
      success: true,
      date: todayStr,
      slots: slots.map((s) => {
        const bookedCount = s.slotBookings.length;
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
        };
      }),
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/admin/students
// Student management visibility (NO password hashes!)
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

    const { hostelId, search } = req.query;

    const where: any = {};
    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      where.hostelId = hostelId;
    }
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { studentId: { contains: q } },
        { user: { email: { contains: q } } },
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
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Compute monthly usage per student
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const formatted = await Promise.all(
      students.map(async (st) => {
        const usedCount = await prisma.slotBooking.count({
          where: {
            studentId: st.id,
            createdAt: { gte: startOfMonth, lte: endOfMonth },
            OR: [
              { status: 'BOOKED' },
              { laundryOrder: { isNot: null } },
            ],
          },
        });

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

    const { hostelId } = req.query;
    const where: any = {};
    if (hostelId && typeof hostelId === 'string' && hostelId !== 'ALL') {
      where.hostelId = hostelId;
    }

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

    const { limit = '50', entityType, action } = req.query;

    const where: any = {};
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
