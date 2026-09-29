import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { Role } from '../types/models.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  hostelId?: string | null;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN as any,
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;
}
