/**
 * Seed script: creates a demo hospital tenant with all standard roles,
 * a HospitalAdmin user, some departments, and sample data so the app
 * is usable immediately after `npm run seed`.
 *
 * Run: npm run seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Note: 'SuperAdmin' is no longer a tenant role — platform operators
// (Developer/SuperAdmin) live in the separate `platform_users` table and
// are bootstrapped by `npm run seed:platform`, not seeded per-hospital.
const ROLES = [
  'HospitalAdmin', 'Doctor', 'Nurse', 'Receptionist', 'Pharmacist',
  'LabTechnician', 'Radiologist', 'Accountant', 'HRManager',
  'StoreManager', 'Cashier', 'Patient',
];

// Same list as roleService.seedPermissions — kept in sync here so seed is self-contained
const PERM_DEFS = [
  { name: 'dashboard:read', moduleName: 'dashboard' },
  { name: 'patients:read', moduleName: 'patients' },
  { name: 'patients:manage', moduleName: 'patients' },
  { name: 'doctors:read', moduleName: 'doctors' },
  { name: 'doctors:manage', moduleName: 'doctors' },
  { name: 'appointments:read', moduleName: 'appointments' },
  { name: 'appointments:manage', moduleName: 'appointments' },
  { name: 'visits:read', moduleName: 'visits' },
  { name: 'visits:manage', moduleName: 'visits' },
  { name: 'ipd:read', moduleName: 'ipd' },
  { name: 'ipd:manage', moduleName: 'ipd' },
  { name: 'pharmacy:read', moduleName: 'pharmacy' },
  { name: 'pharmacy:manage', moduleName: 'pharmacy' },
  { name: 'lab:read', moduleName: 'lab' },
  { name: 'lab:manage', moduleName: 'lab' },
  { name: 'radiology:read', moduleName: 'radiology' },
  { name: 'radiology:manage', moduleName: 'radiology' },
  { name: 'billing:read', moduleName: 'billing' },
  { name: 'billing:manage', moduleName: 'billing' },
  { name: 'hr:read', moduleName: 'hr' },
  { name: 'hr:manage', moduleName: 'hr' },
  { name: 'departments:read', moduleName: 'departments' },
  { name: 'departments:manage', moduleName: 'departments' },
  { name: 'notifications:manage', moduleName: 'notifications' },
  { name: 'audit:read', moduleName: 'audit' },
  { name: 'roles:read', moduleName: 'roles' },
  { name: 'roles:manage', moduleName: 'roles' },
  { name: 'users:read', moduleName: 'users' },
  { name: 'users:manage', moduleName: 'users' },
];

const DEPARTMENTS = ['General Medicine', 'Cardiology', 'Orthopedics', 'Pediatrics', 'Neurology', 'Gynecology', 'Radiology', 'Laboratory', 'Emergency'];

async function main() {
  console.log('🌱 Seeding MediCore HMS demo data...\n');

  // ── Permissions (global) ──────────────────────────────────────────────────
  for (const perm of PERM_DEFS) {
    await prisma.permission.upsert({ where: { name: perm.name }, update: {}, create: perm });
  }
  console.log(`✅ System permissions seeded (${PERM_DEFS.length})`);

  // ── Tenant ────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { code: 'DEMO0001' },
    update: {},
    create: {
      name: 'MediCore Demo Hospital',
      code: 'DEMO0001',
      type: 'MultiSpeciality',
      email: 'admin@medicore.com',
      phone: '+91-9000000000',
      address: 'Plot 1, Health City, Hyderabad, Telangana',
      status: 'Active',
      officeLat: 17.4239,
      officeLng: 78.4738,
      geofenceRadiusMeters: 300,
    },
  });
  console.log(`✅ Tenant: ${tenant.name} (${tenant.code})`);

  // ── Roles ─────────────────────────────────────────────────────────────────
  const rolesMap = {};
  for (const name of ROLES) {
    const role = await prisma.role.upsert({
      where: { id: (await prisma.role.findFirst({ where: { tenantId: tenant.id, name } }))?.id ?? 0n },
      update: {},
      create: { tenantId: tenant.id, name, description: `${name} role` },
    });
    rolesMap[name] = role;
  }
  console.log(`✅ Roles seeded (${ROLES.length})`);

  // ── Role → Permission assignments ─────────────────────────────────────────
  // Fetch all permissions by name for lookup
  const allPerms = await prisma.permission.findMany();
  const permByName = Object.fromEntries(allPerms.map(p => [p.name, p]));

  const ROLE_PERMS = {
    Doctor:        ['dashboard:read','patients:read','patients:manage','appointments:read','appointments:manage','visits:read','visits:manage','ipd:read','ipd:manage','pharmacy:read','lab:read','lab:manage','radiology:read','radiology:manage','billing:read','notifications:manage'],
    Nurse:         ['dashboard:read','patients:read','patients:manage','appointments:read','visits:read','visits:manage','ipd:read','ipd:manage','lab:read','notifications:manage'],
    Receptionist:  ['dashboard:read','patients:read','patients:manage','appointments:read','appointments:manage','doctors:read','billing:read','billing:manage','notifications:manage'],
    Pharmacist:    ['dashboard:read','pharmacy:read','pharmacy:manage','patients:read','notifications:manage'],
    LabTechnician: ['dashboard:read','lab:read','lab:manage','patients:read','notifications:manage'],
    Radiologist:   ['dashboard:read','radiology:read','radiology:manage','patients:read','notifications:manage'],
    Accountant:    ['dashboard:read','billing:read','billing:manage','patients:read','notifications:manage'],
    HRManager:     ['dashboard:read','hr:read','hr:manage','departments:read','departments:manage','notifications:manage'],
    Patient:       ['appointments:read','notifications:manage'],
  };

  for (const [roleName, permNames] of Object.entries(ROLE_PERMS)) {
    const role = rolesMap[roleName];
    if (!role) continue;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const validPerms = permNames.filter(n => permByName[n]);
    if (validPerms.length > 0) {
      await prisma.rolePermission.createMany({
        data: validPerms.map(n => ({ roleId: role.id, permissionId: permByName[n].id })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`✅ Role-permission assignments seeded`);

  // ── Admin user ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@1234', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@medicore.com' },
    update: {},
    create: { email: 'admin@medicore.com', passwordHash, firstName: 'Super', lastName: 'Admin', isActive: true, emailVerified: true },
  });

  const existingTU = await prisma.tenantUser.findFirst({ where: { tenantId: tenant.id, userId: adminUser.id } });
  if (!existingTU) {
    await prisma.tenantUser.create({ data: { tenantId: tenant.id, userId: adminUser.id, roleId: rolesMap['HospitalAdmin'].id } });
  }
  console.log(`✅ Admin user: admin@medicore.com / Admin@1234`);

  // ── Departments ───────────────────────────────────────────────────────────
  const deptMap = {};
  for (const name of DEPARTMENTS) {
    const dept = await prisma.department.upsert({
      where: { id: (await prisma.department.findFirst({ where: { tenantId: tenant.id, name } }))?.id ?? 0n },
      update: {},
      create: { tenantId: tenant.id, name, status: 'Active' },
    });
    deptMap[name] = dept;
  }
  console.log(`✅ Departments seeded (${DEPARTMENTS.length})`);

  // ── Sample Doctor ─────────────────────────────────────────────────────────
  const doctorPassword = await bcrypt.hash('Doctor@1234', 10);
  let doctorUser = await prisma.user.findUnique({ where: { email: 'drsmith@medicore.com' } });
  if (!doctorUser) {
    doctorUser = await prisma.user.create({ data: { email: 'drsmith@medicore.com', passwordHash: doctorPassword, firstName: 'Dr. John', lastName: 'Smith', isActive: true, emailVerified: true } });
    await prisma.tenantUser.create({ data: { tenantId: tenant.id, userId: doctorUser.id, roleId: rolesMap['Doctor'].id } });
    await prisma.doctor.create({ data: { tenantId: tenant.id, userId: doctorUser.id, departmentId: deptMap['General Medicine'].id, specialization: 'General Physician', qualification: 'MBBS, MD', consultationFee: 500, experienceYears: 10, status: 'Active' } });
  }
  console.log(`✅ Sample doctor: drsmith@medicore.com / Doctor@1234`);

  // ── Sample Wards/Rooms/Beds ───────────────────────────────────────────────
  let generalWard = await prisma.ward.findFirst({ where: { tenantId: tenant.id, name: 'General Ward A' } });
  if (!generalWard) {
    generalWard = await prisma.ward.create({ data: { tenantId: tenant.id, name: 'General Ward A', wardType: 'General', floorNumber: 1, status: 'Active' } });
    const room1 = await prisma.room.create({ data: { tenantId: tenant.id, wardId: generalWard.id, roomNumber: 'G-101', roomType: 'General', status: 'Available' } });
    for (let i = 1; i <= 4; i++) {
      await prisma.bed.create({ data: { tenantId: tenant.id, roomId: room1.id, bedNumber: `G-101-B${i}`, status: 'Available' } });
    }
    const icuWard = await prisma.ward.create({ data: { tenantId: tenant.id, name: 'ICU', wardType: 'ICU', floorNumber: 2, status: 'Active' } });
    const icuRoom = await prisma.room.create({ data: { tenantId: tenant.id, wardId: icuWard.id, roomNumber: 'ICU-01', roomType: 'ICU', status: 'Available' } });
    for (let i = 1; i <= 6; i++) {
      await prisma.bed.create({ data: { tenantId: tenant.id, roomId: icuRoom.id, bedNumber: `ICU-B${i}`, status: 'Available' } });
    }
  }
  console.log('✅ Sample ward/rooms/beds seeded');

  // ── Sample Lab Tests ──────────────────────────────────────────────────────
  const labTests = [
    { name: 'Complete Blood Count (CBC)', code: 'CBC', sample: 'Blood', price: 250, tat: 4 },
    { name: 'Blood Glucose (Fasting)', code: 'FBS', sample: 'Blood', price: 80, tat: 2 },
    { name: 'Lipid Profile', code: 'LIP', sample: 'Blood', price: 450, tat: 6 },
    { name: 'Liver Function Test', code: 'LFT', sample: 'Blood', price: 550, tat: 6 },
    { name: 'Urine Routine', code: 'URIN', sample: 'Urine', price: 100, tat: 2 },
    { name: 'Thyroid Profile (T3/T4/TSH)', code: 'THYRD', sample: 'Blood', price: 600, tat: 24 },
  ];

  let labCat = await prisma.labCategory.findFirst({ where: { tenantId: tenant.id, categoryName: 'Routine' } });
  if (!labCat) labCat = await prisma.labCategory.create({ data: { tenantId: tenant.id, categoryName: 'Routine', description: 'Routine investigations' } });

  for (const t of labTests) {
    const exists = await prisma.labTest.findUnique({ where: { testCode: t.code } });
    if (!exists) {
      await prisma.labTest.create({ data: { tenantId: tenant.id, categoryId: labCat.id, testCode: t.code, testName: t.name, sampleType: t.sample, price: t.price, turnaroundHours: t.tat, status: 'Active' } });
    }
  }
  console.log(`✅ Sample lab tests seeded (${labTests.length})`);

  // ── Sample Radiology Services ─────────────────────────────────────────────
  const radServices = [
    { name: 'X-Ray Chest (PA View)', code: 'XR-CHEST', price: 300 },
    { name: 'CT Scan Brain', code: 'CT-BRAIN', price: 4500 },
    { name: 'MRI Brain', code: 'MRI-BRAIN', price: 8000 },
    { name: 'Ultrasound Abdomen', code: 'USG-ABD', price: 800 },
    { name: 'ECG', code: 'ECG', price: 250 },
  ];
  for (const s of radServices) {
    const exists = await prisma.radiologyService.findFirst({ where: { tenantId: tenant.id, serviceCode: s.code } });
    if (!exists) await prisma.radiologyService.create({ data: { tenantId: tenant.id, serviceName: s.name, serviceCode: s.code, price: s.price } });
  }
  console.log(`✅ Sample radiology services seeded (${radServices.length})`);

  // ── Sample Medicines ──────────────────────────────────────────────────────
  const medicines = [
    { name: 'Paracetamol 500mg', code: 'PARA500', generic: 'Paracetamol', unit: 'Tablet' },
    { name: 'Amoxicillin 250mg', code: 'AMOX250', generic: 'Amoxicillin', unit: 'Capsule' },
    { name: 'Metformin 500mg', code: 'MET500', generic: 'Metformin', unit: 'Tablet' },
    { name: 'Amlodipine 5mg', code: 'AML5', generic: 'Amlodipine', unit: 'Tablet' },
    { name: 'Omeprazole 20mg', code: 'OMP20', generic: 'Omeprazole', unit: 'Capsule' },
    { name: 'NS 500ml IV', code: 'NS500', generic: 'Normal Saline', unit: 'Bag' },
  ];

  let medCat = await prisma.medicineCategory.findFirst({ where: { tenantId: tenant.id, categoryName: 'General' } });
  if (!medCat) medCat = await prisma.medicineCategory.create({ data: { tenantId: tenant.id, categoryName: 'General' } });

  for (const m of medicines) {
    const exists = await prisma.medicine.findUnique({ where: { medicineCode: m.code } });
    if (!exists) {
      const med = await prisma.medicine.create({ data: { tenantId: tenant.id, categoryId: medCat.id, medicineCode: m.code, medicineName: m.name, genericName: m.generic, unit: m.unit, reorderLevel: 20, isActive: true } });
      await prisma.medicineBatch.create({ data: { medicineId: med.id, batchNumber: `SEED-${m.code}-01`, expiryDate: new Date('2026-12-31'), purchasePrice: 5, sellingPrice: 10, quantity: 500, availableQuantity: 500 } });
    }
  }
  console.log(`✅ Sample medicines seeded (${medicines.length})`);

  // ── Sample Billing Categories ─────────────────────────────────────────────
  const billCategories = ['Consultation', 'Laboratory', 'Radiology', 'Pharmacy', 'Room Charges', 'Nursing', 'Procedure', 'Miscellaneous'];
  for (const name of billCategories) {
    const exists = await prisma.billingCategory.findFirst({ where: { tenantId: tenant.id, categoryName: name } });
    if (!exists) await prisma.billingCategory.create({ data: { tenantId: tenant.id, categoryName: name } });
  }
  console.log(`✅ Sample billing categories seeded (${billCategories.length})`);

  // ── HR Seed ───────────────────────────────────────────────────────────────
  const designations = ['Senior Doctor', 'Junior Doctor', 'Staff Nurse', 'Head Nurse', 'Pharmacist', 'Lab Technician', 'Receptionist', 'HR Manager', 'Accountant'];
  for (const name of designations) {
    const exists = await prisma.designation.findFirst({ where: { tenantId: tenant.id, designationName: name } });
    if (!exists) await prisma.designation.create({ data: { tenantId: tenant.id, designationName: name } });
  }
  const leaveTypes = [{ name: 'Casual Leave', quota: 12 }, { name: 'Sick Leave', quota: 10 }, { name: 'Earned Leave', quota: 15 }];
  for (const lt of leaveTypes) {
    const exists = await prisma.leaveType.findFirst({ where: { tenantId: tenant.id, leaveName: lt.name } });
    if (!exists) await prisma.leaveType.create({ data: { tenantId: tenant.id, leaveName: lt.name, annualQuota: lt.quota } });
  }
  console.log('✅ HR designations and leave types seeded');

  // ── Demo staff user + linked Employee (for Mobile Attendance self check-in) ─
  const staffPasswordHash = await bcrypt.hash('Staff@1234', 10);
  const staffUser = await prisma.user.upsert({
    where: { email: 'frontoffice@medicore.com' },
    update: {},
    create: { email: 'frontoffice@medicore.com', passwordHash: staffPasswordHash, firstName: 'Priya', lastName: 'Rao', isActive: true, emailVerified: true },
  });
  const existingStaffTU = await prisma.tenantUser.findFirst({ where: { tenantId: tenant.id, userId: staffUser.id } });
  if (!existingStaffTU) {
    await prisma.tenantUser.create({ data: { tenantId: tenant.id, userId: staffUser.id, roleId: rolesMap['Receptionist'].id } });
  }
  const frontOfficeDept = await prisma.department.findFirst({ where: { tenantId: tenant.id, name: 'General Medicine' } });
  const receptionistDesig = await prisma.designation.findFirst({ where: { tenantId: tenant.id, designationName: 'Receptionist' } });
  const existingEmployee = await prisma.employee.findFirst({ where: { userId: staffUser.id } });
  if (!existingEmployee) {
    await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        userId: staffUser.id,
        employeeCode: 'EMP-0001',
        firstName: 'Priya',
        lastName: 'Rao',
        email: 'frontoffice@medicore.com',
        departmentId: frontOfficeDept?.id ?? null,
        designationId: receptionistDesig?.id ?? null,
        joiningDate: new Date('2025-01-01'),
        employmentType: 'Permanent',
        status: 'Active',
      },
    });
  }
  console.log('✅ Demo staff login linked to Employee record (for Mobile Attendance)');

  console.log('\n🎉 Seed complete!\n');
  console.log('─'.repeat(50));
  console.log('Admin Login:   admin@medicore.com  |  Admin@1234');
  console.log('Doctor Login:  drsmith@medicore.com |  Doctor@1234');
  console.log('Staff Login:   frontoffice@medicore.com |  Staff@1234  (for Mobile Attendance self check-in)');
  console.log('Tenant Code:   DEMO0001');
  console.log('─'.repeat(50));
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
