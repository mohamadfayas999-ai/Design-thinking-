# 💧 WASHWISE — Smart & Intelligent Campus Laundry Management System

**Rajalakshmi Engineering College (REC) Hostels**

---

## 📌 Problem Statement

In large-scale collegiate residential campuses, managing laundry services for hundreds of students across multiple independent hostels creates significant administrative and operational friction:
- **Long Queues & Crowding:** Unscheduled drop-offs cause peak-hour congestion at the laundry depot.
- **Garment Loss & Discrepancies:** Lack of formalized intake counting and transparent custody tracking leads to misplaced clothing.
- **Storage Chaos:** Without structured rack/shelf allocation, finding completed laundry during collection is slow and error-prone.
- **Accountability & Privacy Gaps:** Students lack a structured recourse mechanism for complaints (torn garments, reduced counts), while internal storage locations and staff assignments must be kept strictly private.
- **Resource Inequities:** Without fair-use quota enforcement, a minority of residents can monopolize available slot capacity.

---

## 💡 The WASHWISE Solution

WASHWISE is an end-to-end, role-architected web application that replaces manual registers and chaotic depot operations with a disciplined digital workflow:
- **Fair-Use Slot Allocation:** Automated monthly allowance enforcement (4 bookings per student per calendar month) and strict capacity caps per hourly slot.
- **Disciplined Custody Lifecycle:** Formal custody transitions: `BOOKED → IN_PROGRESS → COMPLETED → VERIFIED` (or `COMPLAINT → UNDER_REVIEW → RESOLVED`).
- **Internal Storage Management:** Isolated rack and shelf allocation for staff operations, strictly hidden from student interfaces to prevent depot trespassing.
- **Opaque Permanent Digital Identity:** Every student is issued a permanent, non-PII, opaque digital QR token displayed on their profile for quick student validation without requiring laptop cameras or scan actions.
- **Formalized Complaint Resolution:** Standardized issue reporting (`Clothes Torn`, `Number of Clothes Reduced`, `Other Issue`) with dedicated administrator review, investigation notes, and storage release.
- **Campus-Wide Administrative Visibility:** High-level metrics, transparent descriptive demand insights, cross-hostel comparisons, slot utilization schedules, and immutable audit logs.

---

## 🏢 Portals & Core Features

### 1. Student Portal (`/student`)
- **Hostel-Scoped Authentication:** Secure login strictly bound to the resident's registered hostel (`Habitat`, `Thandalam`, or `Girls`).
- **Slot Booking:** Real-time visibility into weekly slots, remaining capacities, and category breakdown.
- **Strict Submission Caps:** Maximum 20 garments per submission, confined strictly to two categories: `T-shirt/Shirt` and `Pants/Track`.
- **Monthly Quota Enforcement:** Strict limit of 4 laundry uses per student per calendar month.
- **Active Booking & Status Tracking:** Live status badge tracking (`BOOKED`, `IN_PROGRESS`, `COMPLETED`, `VERIFIED`, `UNDER_REVIEW`, `RESOLVED`).
- **Completion Notification & Modal:** Automatic popup upon completion prompting the student to inspect their garments upon pickup.
- **Garment Verification:** One-click confirmation confirming receipt and releasing internal depot shelf storage.
- **Garment Complaint Reporting:** Standardized complaint submission with optional notes transitioning orders to `UNDER_REVIEW`.
- **Persistent Laundry History:** Complete historical timeline of all past submissions. Displays a centered, bold `NO HISTORY` empty state when no history exists.
- **Permanent Digital QR Display:** Display-only permanent opaque token identifying the student for college services.

### 2. Laundry Staff Portal (`/staff`)
- **Hostel-Isolated Dashboard:** Staff access only their assigned hostel's depot. Cross-hostel operations are strictly rejected.
- **Intake & Physical Count Confirmation:** Verification of student garment counts against physical intake items before processing.
- **Internal Rack/Shelf Allocation:** Selection of unoccupied storage locations (`Rack 1–3`, `Shelf 1–4`).
- **Order Progression:** Atomic progression from `BOOKED` to `IN_PROGRESS` with timestamp recording.
- **Laundry Completion:** Transition from `IN_PROGRESS` to `COMPLETED` when washing and folding are finished, triggering student notification.
- **Depot Storage Monitoring:** Visual occupancy grid of racks and shelves.

### 3. Administrator Portal (`/admin`)
- **Global Campus Login:** Unified admin login without hostel restrictions.
- **Operational Analytics & Overview:** Campus-wide and hostel-specific metrics (Students, Staff, Active Bookings, Orders, Pickups, Storage Utilization).
- **Transparent Descriptive Demand Insights:** Peak slot timings, busiest hostels, and 7-day usage trends calculated directly from stored database records.
- **Cross-Hostel Laundry Monitoring:** Comprehensive order inspector across all 3 hostels with search, status filters, and time range filters.
- **Complaint Management & Resolution:** Dedicated queue for student complaints (`UNDER_REVIEW`). Protected resolution endpoint (`PATCH /api/admin/complaints/:id/resolve`) releasing storage upon resolution.
- **Storage Rack Capacity Overview:** Real-time monitoring of all 36 storage locations across campus.
- **Student & Staff Directories:** User management with monthly quota usage tracking without exposing passwords or password hashes.
- **System Audit Trail:** Immutable system logs capturing intake, completion, verification, complaint, and resolution events.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend Framework** | React 18 with TypeScript |
| **Build Tool & Dev Server** | Vite |
| **Styling & Design System**| Tailwind CSS (Curated water-inspired palette: navy, ocean slate, cyan, and water blue) |
| **Icons** | Lucide React |
| **Client Routing** | React Router DOM (v6) |
| **Backend Runtime** | Node.js (v20+) |
| **Server Framework** | Express.js with TypeScript |
| **Database & ORM** | SQLite with Prisma ORM |
| **Authentication** | JSON Web Tokens (JWT) & bcryptjs password hashing |
| **Design Quality Standard**| Strictly adhering to `.agents/skills/design-taste-frontend` |

---

## 📏 Core Business Rules

1. **Hostels:** Exactly 3 residential hostels supported: `Habitat` (Boys), `Thandalam` (Boys), and `Girls` (Girls Main).
2. **Clothing Categories:** Exactly 2 supported categories: `T-shirt/Shirt` and `Pants/Track`.
3. **Item Submission Limit:** Maximum 20 clothes in total per booking.
4. **Monthly Usage Limit:** Exactly 4 laundry bookings per student per calendar month. Enforced at database level.
5. **No Camera QR Scanning:** Student QR is permanent, opaque, non-PII, and display-only. Staff never scan QR codes.
6. **Student Privacy Protection:** Storage location (`rackShelfId`, `rackShelf`), and staff details (`staffId`, `staff`) are strictly scrubbed from all student API responses.
7. **Staff Hostel Isolation:** Staff cannot view, modify, or take intake on bookings or storage belonging to another hostel.
8. **Storage Lifecycle Integrity:**
   - Rack/shelf is allocated during staff intake (`IN_PROGRESS`).
   - Storage remains occupied throughout `IN_PROGRESS`, `COMPLETED`, and `UNDER_REVIEW`.
   - Storage is released immediately upon student `VERIFIED` or administrator `RESOLVED`.
   - No two active orders may occupy the same rack/shelf.

---

## 🔄 Status Lifecycles

### Standard Lifecycle
```text
[ BOOKED ]
   │  (Student books slot with garment count)
   ▼
[ IN_PROGRESS ]
   │  (Staff confirms physical count & assigns Rack/Shelf)
   ▼
[ COMPLETED ]
   │  (Staff finishes laundry; student receives completion notification)
   ▼
[ VERIFIED ]
      (Student collects garments, verifies items; storage is released)
```

### Complaint Lifecycle
```text
[ COMPLETED ]
   │  (Student identifies discrepancy or damage upon pickup)
   ▼
[ UNDER_REVIEW ]
   │  (Student logs complaint: Clothes Torn / Reduced Count / Other; storage remains held)
   ▼
[ RESOLVED ]
      (Admin inspects complaint, records resolution notes; storage is released)
```

---

## 👤 Safe Demo Credentials

> **Notice:** The following fictional credentials are seeded for demonstration and testing purposes.

### 1. System Administrator
- **Email:** `admin@rajalakshmi.edu.in`
- **Password:** `admin123`
- **Scope:** Campus-wide

### 2. Laundry Staff (1 per hostel)
- **Password:** `laundrystaff123` (all staff)

| Hostel | Staff Email |
| :--- | :--- |
| **Habitat** | `habitatstaff1@rajalakshmi.edu.in` |
| **Thandalam** | `thandalamstaff1@rajalakshmi.edu.in` |
| **Girls** | `girlsstaff1@rajalakshmi.edu.in` |

### 3. Students (3 per hostel, 9 total)
- **Password:** `rec123` (all students)

| Hostel | Student Name | Roll ID | Email |
| :--- | :--- | :--- | :--- |
| **Habitat** | Student One | `2024CSD001` | `student.one.2024.csd@rajalakshmi.edu.in` |
| **Habitat** | Student Two | `2024CSE002` | `student.two.2024.cse@rajalakshmi.edu.in` |
| **Habitat** | Student Three | `2024IT003` | `student.three.2024.it@rajalakshmi.edu.in` |
| **Thandalam** | Student Four | `2024ECE004` | `student.four.2024.ece@rajalakshmi.edu.in` |
| **Thandalam** | Student Five | `2024MEC005` | `student.five.2024.mech@rajalakshmi.edu.in` |
| **Thandalam** | Student Six | `2024ADS006` | `student.six.2024.aids@rajalakshmi.edu.in` |
| **Girls** | Student Seven | `2024CSD007` | `student.seven.2024.csd@rajalakshmi.edu.in` |
| **Girls** | Student Eight | `2024CSE008` | `student.eight.2024.cse@rajalakshmi.edu.in` |
| **Girls** | Student Nine | `2024BIO009` | `student.nine.2024.biotech@rajalakshmi.edu.in` |

---

## 🚀 Running the Project

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### 1. Backend Setup & Run
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run dev
# Server starts at http://localhost:5000
# Health check available at http://localhost:5000/api/health
```

### 2. Frontend Setup & Run
```bash
cd frontend
npm install
npm run dev
# Vite dev server starts at http://localhost:5173
```

### 3. Automated Test Suite Execution
```bash
cd backend

# Phase 1 Foundation & Seed Verification
npx tsx src/tests/foundation.test.ts

# Phase 1 API Integration
npx tsx src/tests/api.test.ts

# Phase 2 Student Slot Booking & Quotas
npx tsx src/tests/phase2.test.ts

# Phase 3 Staff Intake & Storage Allocation
npx tsx src/tests/phase3.test.ts

# Phase 4 Completion, Verification & Complaints
npx tsx src/tests/phase4.test.ts

# Phase 5 Admin Portal, Analytics & Security Audit
npx tsx src/tests/phase5.test.ts
```

### 4. Database Reset
To restore all database tables to their clean initial demo state:
```bash
cd backend
npm run db:reset
```

### 5. Production Build Verification
```bash
# Backend compilation
cd backend && npm run build

# Frontend compilation
cd frontend && npm run build
```
