export const Role = {
  STUDENT: 'STUDENT',
  STAFF: 'STAFF',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const BookingStatus = {
  BOOKED: 'BOOKED',
  CANCELLED: 'CANCELLED',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const OrderStatus = {
  BOOKED: 'BOOKED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  VERIFIED: 'VERIFIED',
  COMPLAINT: 'COMPLAINT',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED: 'RESOLVED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ComplaintType = {
  CLOTHES_TORN: 'CLOTHES_TORN',
  NUMBER_OF_CLOTHES_REDUCED: 'NUMBER_OF_CLOTHES_REDUCED',
  OTHER_ISSUE: 'OTHER_ISSUE',
} as const;
export type ComplaintType = (typeof ComplaintType)[keyof typeof ComplaintType];

export const ComplaintStatus = {
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED: 'RESOLVED',
} as const;
export type ComplaintStatus = (typeof ComplaintStatus)[keyof typeof ComplaintStatus];

export const NotificationType = {
  LAUNDRY_COMPLETED: 'LAUNDRY_COMPLETED',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const ClothingCategories = {
  T_SHIRT_SHIRT: 'T-shirt/Shirt',
  PANTS_TRACK: 'Pants/Track',
} as const;

export const LIMITS = {
  MAX_CLOTHES_PER_SUBMISSION: 20,
  MAX_MONTHLY_LAUNDRY_COUNT: 4,
} as const;
