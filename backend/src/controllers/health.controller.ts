import { Request, Response } from 'express';

export function getHealth(req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    message: 'WASHWISE API is running',
    timestamp: new Date().toISOString(),
    service: 'WASHWISE Smart Campus Laundry API',
    version: '1.0.0',
    phase: 'Phase 1 - Foundation & Architecture',
  });
}
