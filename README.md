# 🏥 MediCore HMS

> **Enterprise-grade Hospital Management System** — Multi-tenant, role-based, full-stack.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![Prisma](https://img.shields.io/badge/Prisma-5-purple)](https://prisma.io)
[![MySQL](https://img.shields.io/badge/MySQL-8-orange)](https://mysql.com)
[![License](https://img.shields.io/badge/License-MIT-brightgreen)](LICENSE)

---

## 📋 Overview

MediCore HMS is a production-ready, multi-tenant hospital management system with **13 fully functional modules** covering the complete clinical and administrative workflow.

### ✅ Modules Implemented

| # | Module | Key Features |
|---|--------|-------------|
| 1 | **Auth & Tenants** | Multi-tenant registration, JWT auth, refresh tokens, RBAC (11 roles) |
| 2 | **Departments & Doctors** | Doctor onboarding, weekly schedule management |
| 3 | **Patients** | UHID generation, allergies, medical history, clinical timeline |
| 4 | **Appointments** | Token-based queue, OPD scheduling, check-in/cancel |
| 5 | **Visits / EMR** | Vitals, medical records, clinical notes, prescriptions |
| 6 | **IPD — Wards/Beds** | Ward/room/bed management, bed occupancy map, admissions, discharge |
| 7 | **Pharmacy** | Medicine catalog, FEFO batch management, stock alerts, sales with stock deduction |
| 8 | **Laboratory** | Test catalog, multi-test orders, result submission, status tracking |
| 9 | **Radiology** | Service catalog, orders, radiologist reports (Draft/Verified/Final) |
| 10 | **Billing & Payments** | Bill creation, multi-item, partial/full payments, revenue analytics |
| 11 | **HR & Payroll** | Employees, designations, attendance, leave (apply/approve), payroll generation |
| 12 | **Notifications** | In-app notification system per user per tenant |
| 13 | **Audit Logs & Dashboard** | Full audit trail, KPI dashboard with charts |

---

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js 18+ (ESM modules)
- **Framework**: Express.js 4.x
- **ORM**: Prisma 5 (MySQL provider)
- **Database**: MySQL 8
- **Auth**: JWT (access + refresh tokens), bcryptjs
- **Validation**: Joi
- **Logging**: Winston + Morgan
- **Security**: Helmet, express-rate-limit, CORS

### Frontend
- **Framework**: React 18 (Vite)
- **Routing**: React Router 6
- **State**: TanStack Query v5
- **Forms**: React Hook Form
- **Charts**: Recharts
- **Styling**: Tailwind CSS 3
- **HTTP**: Axios (with auto-refresh interceptor)
- **Notifications**: react-hot-toast

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8 running locally
- Git

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd medicore-hms

# Install all dependencies
npm run install:all
```

### 2. Configure Environment

```bash
# Copy the example env
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
DATABASE_URL="mysql://root:yourpassword@localhost:3306/medicore_hms"
JWT_ACCESS_SECRET="your-64-char-hex-secret-here"
JWT_REFRESH_SECRET="your-other-64-char-hex-secret-here"
```

Generate strong secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Database Setup

```bash
# Create database
mysql -u root -p -e "CREATE DATABASE medicore_hms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Generate Prisma client
npm run prisma:generate

# Run migrations (creates all 47 tables)
npm run prisma:migrate
# When prompted for migration name: enter "init"

# Seed demo data
npm run seed
```

### 4. Start Development

```bash
# Start backend + frontend concurrently
npm run dev
```

- **Backend API**: http://localhost:5000
- **Frontend**: http://localhost:5173
- **Prisma Studio**: `npm run prisma:studio`

### Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Hospital Admin | `admin@medicore.com` | `Admin@1234` |
| Doctor | `drsmith@medicore.com` | `Doctor@1234` |

**Tenant Code**: `DEMO0001`

---

## 📁 Project Structure

```
medicore-hms/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # 47-table Prisma schema
│   │   └── seed.js                # Demo data seeder
│   └── src/
│       ├── config/
│       │   ├── env.js             # Env validation
│       │   ├── prisma.js          # Prisma singleton
│       │   └── roles.js           # RBAC roles/permissions
│       ├── controllers/           # HTTP handlers
│       ├── middleware/
│       │   ├── authenticate.js    # JWT verification
│       │   ├── authorize.js       # RBAC gate
│       │   ├── errorHandler.js    # Centralized error handler
│       │   └── validate.js        # Joi validation middleware
│       ├── routes/                # Express routers
│       ├── services/              # Business logic
│       ├── utils/                 # ApiError, asyncHandler, token, etc.
│       ├── app.js                 # Express app setup
│       └── server.js              # Entry point
│
├── frontend/
│   └── src/
│       ├── api/                   # Axios client + all API helpers
│       ├── components/
│       │   ├── layout/            # Sidebar, Topbar, AppLayout
│       │   └── ui/                # Shared UI components
│       ├── context/               # AuthContext
│       ├── hooks/
│       │   └── useListQuery.js    # Reusable paginated list hook
│       └── pages/                 # 20+ page components
│           ├── auth/
│           ├── dashboard/
│           ├── patients/
│           ├── doctors/
│           ├── appointments/
│           ├── visits/
│           ├── ipd/
│           ├── pharmacy/
│           ├── lab/
│           ├── radiology/
│           ├── billing/
│           ├── hr/
│           └── notifications/
│
└── package.json                   # Root monorepo scripts
```

---

## 🔐 RBAC Roles

| Role | Access |
|------|--------|
| `HospitalAdmin` | Full access to all modules |
| `Doctor` | Patients, Visits/EMR, IPD, Lab, Radiology, Prescriptions |
| `Nurse` | Patients, Visits, IPD, Vitals |
| `Receptionist` | Patients, Appointments, Billing |
| `Pharmacist` | Pharmacy (medicines, sales, stock) |
| `LabTechnician` | Lab orders and results |
| `Radiologist` | Radiology orders and reports |
| `Accountant` | Billing and payments |
| `HRManager` | Employees, attendance, leave, payroll |
| `Patient` | Read own appointments |

---

## 🌐 API Reference

Base URL: `http://localhost:5000/api/v1`

All protected routes require: `Authorization: Bearer <access_token>`

### Core Endpoints

```
POST   /auth/register          Register new hospital workspace
POST   /auth/login             Login
POST   /auth/refresh           Refresh access token
POST   /auth/logout            Logout
GET    /auth/me                Current user info
POST   /auth/staff/invite      Invite staff member

GET    /dashboard              KPI dashboard

GET    /patients               List patients
POST   /patients               Register patient
GET    /patients/:id           Patient detail + allergies + history
GET    /patients/:id/timeline  Clinical timeline

GET    /doctors                List doctors
POST   /doctors                Add doctor (creates linked user)
GET    /doctors/:id/schedules  Doctor schedule

GET    /appointments           List appointments
POST   /appointments           Schedule appointment
POST   /appointments/:id/check-in   Check in
POST   /appointments/:id/cancel     Cancel

GET    /visits                 List visits
POST   /visits                 Start visit
POST   /visits/:id/vitals      Record vitals
PUT    /visits/:id/medical-record   Upsert diagnosis
POST   /visits/:id/prescriptions    Create prescription

GET    /ipd/occupancy          Bed occupancy summary
GET    /ipd/beds               List beds (filter by status)
POST   /ipd/admissions         Admit patient
POST   /ipd/admissions/:id/transfer   Transfer bed
POST   /ipd/admissions/:id/discharge  Discharge

GET    /pharmacy/medicines     List medicines
GET    /pharmacy/alerts        Low stock + expiry alerts
POST   /pharmacy/sales         Create sale (deducts stock)

GET    /lab/orders             Lab orders
POST   /lab/orders             Create order
POST   /lab/orders/:id/items/:itemId/result   Submit result

GET    /radiology/orders       Radiology orders
POST   /radiology/orders       Create order
PUT    /radiology/orders/:id/report   Write report

GET    /billing                List bills
POST   /billing                Create bill
POST   /billing/:id/payments   Record payment
GET    /billing/stats          Revenue statistics

GET    /hr/employees           List employees
POST   /hr/attendance          Mark attendance
POST   /hr/leaves              Apply leave
PATCH  /hr/leaves/:id/status   Approve/reject leave
POST   /hr/payroll             Generate payroll
POST   /hr/payroll/:id/mark-paid  Mark payroll as paid

GET    /notifications          User notifications
PATCH  /notifications/mark-all-read  Mark all read

GET    /audit                  Audit log (admin only)
```

---

## 🗄 Database Schema

The schema implements **47 tables** across 13 modules, faithful to the provided MySQL DDL:

- **Platform**: `tenants`, `users`, `roles`, `permissions`, `role_permissions`, `tenant_users`, `user_sessions`, `audit_logs`
- **Clinical**: `departments`, `doctors`, `doctor_schedules`, `patients`, `patient_allergies`, `patient_medical_history`, `appointments`, `visits`, `vitals`, `medical_records`, `clinical_notes`, `prescriptions`, `prescription_items`
- **IPD**: `wards`, `rooms`, `beds`, `admissions`, `discharges`
- **Pharmacy**: `suppliers`, `medicine_categories`, `medicines`, `medicine_batches`, `pharmacy_sales`, `pharmacy_sale_items`
- **Lab**: `lab_categories`, `lab_tests`, `lab_orders`, `lab_order_items`, `lab_results`
- **Radiology**: `radiology_services`, `radiology_orders`, `radiology_order_items`, `radiology_reports`
- **Billing**: `billing_categories`, `bills`, `bill_items`, `payments`
- **HR**: `designations`, `employees`, `attendance`, `leave_types`, `leave_applications`, `payroll`
- **System**: `notifications`, `files`

---

## 🔑 Key Design Decisions

1. **Multi-tenancy**: Every entity is scoped to a `tenantId`. The `authenticate` middleware re-fetches the live `tenant_users` row on every request so role changes take effect immediately.

2. **JWT Strategy**: Short-lived access tokens (15m) + long-lived refresh tokens (7d) stored in `user_sessions`. The Axios interceptor handles silent token refresh transparently.

3. **Soft Deletes**: Most entities use `deletedAt` (nullable timestamp) rather than hard deletion to preserve audit history.

4. **FEFO Pharmacy**: Batches are ordered by `expiryDate ASC` (First-Expiry-First-Out) when listing available stock. Stock deduction is transactional.

5. **Audit Logging**: The `recordAudit()` helper is fire-and-forget — failures never break the primary request.

6. **BigInt Serialization**: Prisma returns `BigInt` for all PK/FK columns. A global `bigIntSerializer` middleware converts them to safe numbers for JSON responses.

7. **Factory Pattern**: `createCrudService` + `createCrudController` + `createCrudRouter` eliminate boilerplate for the ~15 simpler entities, while complex modules (auth, pharmacy, billing) have custom service logic.

---

## 📄 License

MIT — use freely for educational and commercial purposes.
