import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';

export async function getHostels(req: Request, res: Response, next: NextFunction) {
  try {
    const hostels = await prisma.hostel.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return res.status(200).json({
      success: true,
      data: hostels,
    });
  } catch (error) {
    next(error);
  }
}
