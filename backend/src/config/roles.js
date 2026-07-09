/**
 * Platform-level operators. These are NOT tenant roles — they have no row
 * in any tenant's `roles` table, are never in ROLE_MODULE_ACCESS below, and
 * are checked exclusively by `authenticatePlatform` / `restrictToPlatform`
 * against the separate `PlatformUser` table. Keeping this map physically
 * separate from SYSTEM_ROLES is what guarantees a SuperAdmin/Developer
 * session can never satisfy the tenant `authorize()`/`hasAccess()` checks
 * below, and vice versa.
 */
export const PLATFORM_ROLES = {
  DEVELOPER: 'Developer',
  SUPER_ADMIN: 'SuperAdmin',
};

/**
 * System-defined TENANT roles. Each tenant gets its own `roles` rows seeded
 * from this list (roles table is tenant-scoped per db.txt), but the *names*
 * and the permission-module map below are shared application logic used to
 * seed and to gate routes via the `authorize()` middleware.
 *
 * Note: 'SuperAdmin' used to live in this list with the same '*':'manage'
 * grant as HospitalAdmin. It has been moved out to PLATFORM_ROLES above —
 * platform operators are no longer part of any hospital's tenant/role data
 * at all, so hospital data stays invisible to them by construction.
 */
export const SYSTEM_ROLES = {
  HOSPITAL_ADMIN: 'HospitalAdmin',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  RECEPTIONIST: 'Receptionist',
  PHARMACIST: 'Pharmacist',
  LAB_TECHNICIAN: 'LabTechnician',
  RADIOLOGIST: 'Radiologist',
  ACCOUNTANT: 'Accountant',
  HR_MANAGER: 'HRManager',
  STORE_MANAGER: 'StoreManager',
  CASHIER: 'Cashier',
  PATIENT: 'Patient',
};

export const MODULES = {
  TENANTS: 'tenants',
  USERS: 'users',
  ROLES: 'roles',
  DEPARTMENTS: 'departments',
  DOCTORS: 'doctors',
  PATIENTS: 'patients',
  APPOINTMENTS: 'appointments',
  VISITS: 'visits',
  IPD: 'ipd',
  PHARMACY: 'pharmacy',
  LAB: 'lab',
  RADIOLOGY: 'radiology',
  BILLING: 'billing',
  HR: 'hr',
  NOTIFICATIONS: 'notifications',
  AUDIT: 'audit',
  DASHBOARD: 'dashboard',
  OT: 'ot',
  INSURANCE: 'insurance',
  BLOOD_BANK: 'blood_bank',
  DIET: 'diet',
  INVENTORY: 'inventory',
  SHIFTS: 'shifts',
  DOCTOR_REVENUE: 'doctor_revenue',
  INCENTIVES: 'incentives',
  LOANS: 'loans',
  RECRUITMENT: 'recruitment',
  DOCUMENTS: 'documents',
  LETTERS: 'letters',
  PERFORMANCE: 'performance',
  AMBULANCE: 'ambulance',
  VISITORS: 'visitors',
  COMPLAINTS: 'complaints',
  MORTUARY: 'mortuary',
  QR: 'qr',
  BIOMETRIC: 'biometric',
  MOBILE_APP: 'mobile_app',
  VOICE_NOTES: 'voice_notes',
};

/**
 * Which roles can access which modules, and at what level.
 * 'manage' = full CRUD, 'read' = read-only, absent = no access.
 * Used by the authorize() middleware as a coarse-grained gate; fine-grained
 * checks (e.g. "doctor can only see own patients") live in the services.
 */
export const ROLE_MODULE_ACCESS = {
  [SYSTEM_ROLES.HOSPITAL_ADMIN]: { '*': 'manage' },
  [SYSTEM_ROLES.DOCTOR]: {
    [MODULES.PATIENTS]: 'manage',
    [MODULES.APPOINTMENTS]: 'manage',
    [MODULES.VISITS]: 'manage',
    [MODULES.IPD]: 'manage',
    [MODULES.PHARMACY]: 'read',
    [MODULES.LAB]: 'manage',
    [MODULES.RADIOLOGY]: 'manage',
    [MODULES.BILLING]: 'read',
    [MODULES.VOICE_NOTES]: 'manage',
    [MODULES.DASHBOARD]: 'read',
    [MODULES.NOTIFICATIONS]: 'manage',
  },
  [SYSTEM_ROLES.NURSE]: {
    [MODULES.PATIENTS]: 'manage',
    [MODULES.APPOINTMENTS]: 'read',
    [MODULES.VISITS]: 'manage',
    [MODULES.IPD]: 'manage',
    [MODULES.LAB]: 'read',
    [MODULES.DASHBOARD]: 'read',
    [MODULES.NOTIFICATIONS]: 'manage',
    [MODULES.VOICE_NOTES]: 'manage',
  },
  [SYSTEM_ROLES.RECEPTIONIST]: {
    [MODULES.PATIENTS]: 'manage',
    [MODULES.APPOINTMENTS]: 'manage',
    [MODULES.DOCTORS]: 'read',
    [MODULES.BILLING]: 'manage',
    [MODULES.DASHBOARD]: 'read',
    [MODULES.NOTIFICATIONS]: 'manage',
  },
  [SYSTEM_ROLES.PHARMACIST]: {
    [MODULES.PHARMACY]: 'manage',
    [MODULES.PATIENTS]: 'read',
    [MODULES.DASHBOARD]: 'read',
    [MODULES.NOTIFICATIONS]: 'manage',
  },
  [SYSTEM_ROLES.LAB_TECHNICIAN]: {
    [MODULES.LAB]: 'manage',
    [MODULES.PATIENTS]: 'read',
    [MODULES.DASHBOARD]: 'read',
    [MODULES.NOTIFICATIONS]: 'manage',
  },
  [SYSTEM_ROLES.RADIOLOGIST]: {
    [MODULES.RADIOLOGY]: 'manage',
    [MODULES.PATIENTS]: 'read',
    [MODULES.DASHBOARD]: 'read',
    [MODULES.NOTIFICATIONS]: 'manage',
  },
  [SYSTEM_ROLES.ACCOUNTANT]: {
    [MODULES.BILLING]: 'manage',
    [MODULES.PATIENTS]: 'read',
    [MODULES.DASHBOARD]: 'read',
    [MODULES.NOTIFICATIONS]: 'manage',
  },
  [SYSTEM_ROLES.HR_MANAGER]: {
    [MODULES.HR]: 'manage',
    [MODULES.DEPARTMENTS]: 'manage',
    [MODULES.DASHBOARD]: 'read',
    [MODULES.NOTIFICATIONS]: 'manage',
    [MODULES.BIOMETRIC]: 'manage',
  },
  [SYSTEM_ROLES.STORE_MANAGER]: {
    [MODULES.INVENTORY]: 'manage',
    [MODULES.PHARMACY]: 'manage',
    [MODULES.DASHBOARD]: 'read',
    [MODULES.NOTIFICATIONS]: 'manage',
  },
  [SYSTEM_ROLES.CASHIER]: {
    [MODULES.BILLING]: 'manage',
    [MODULES.PATIENTS]: 'read',
    [MODULES.DASHBOARD]: 'read',
    [MODULES.NOTIFICATIONS]: 'manage',
  },
  [SYSTEM_ROLES.PATIENT]: {
    [MODULES.APPOINTMENTS]: 'read',
    [MODULES.NOTIFICATIONS]: 'manage',
  },
};

export function hasAccess(roleName, moduleName, level = 'read') {
  const access = ROLE_MODULE_ACCESS[roleName];
  if (!access) return false;
  const grant = access['*'] || access[moduleName];
  if (!grant) return false;
  if (level === 'read') return grant === 'read' || grant === 'manage';
  return grant === 'manage';
}
