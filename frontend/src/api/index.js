import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, ''),
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)));
  failedQueue = [];
}

// Transparent token refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject })).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        isRefreshing = false;
        processQueue(error);
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = data.data;

        localStorage.setItem('access_token', accessToken);
        if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken);

        processQueue(null, accessToken);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr);
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const message = error.response?.data?.message || error.message || 'An error occurred';
    if (error.response?.status !== 401) toast.error(message);
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  register: (d) => api.post('/auth/register', d),
  login: (d) => api.post('/auth/login', d),
  refresh: (token) => api.post('/auth/refresh', { refreshToken: token }),
  logout: (token) => api.post('/auth/logout', { refreshToken: token }),
  me: () => api.get('/auth/me'),
  updateProfile: (d) => api.patch('/auth/me', d),
  changePassword: (d) => api.post('/auth/change-password', d),
  inviteStaff: (d) => api.post('/auth/staff/invite', d),
};

export const dashboardApi = { get: () => api.get('/dashboard') };

export const patientApi = {
  list: (p) => api.get('/patients', { params: p }),
  get: (id) => api.get(`/patients/${id}`),
  timeline: (id) => api.get(`/patients/${id}/timeline`),
  create: (d) => api.post('/patients', d),
  update: (id, d) => api.patch(`/patients/${id}`, d),
  remove: (id) => api.delete(`/patients/${id}`),
  addAllergy: (id, d) => api.post(`/patients/${id}/allergies`, d),
  removeAllergy: (id, aid) => api.delete(`/patients/${id}/allergies/${aid}`),
  addHistory: (id, d) => api.post(`/patients/${id}/medical-history`, d),
};

export const departmentApi = {
  list: (p) => api.get('/departments', { params: p }),
  get: (id) => api.get(`/departments/${id}`),
  create: (d) => api.post('/departments', d),
  update: (id, d) => api.patch(`/departments/${id}`, d),
  remove: (id) => api.delete(`/departments/${id}`),
};

export const doctorApi = {
  list: (p) => api.get('/doctors', { params: p }),
  get: (id) => api.get(`/doctors/${id}`),
  create: (d) => api.post('/doctors', d),
  update: (id, d) => api.patch(`/doctors/${id}`, d),
  remove: (id) => api.delete(`/doctors/${id}`),
  listSchedules: (id) => api.get(`/doctors/${id}/schedules`),
  addSchedule: (id, d) => api.post(`/doctors/${id}/schedules`, d),
  removeSchedule: (id, sid) => api.delete(`/doctors/${id}/schedules/${sid}`),
};

export const appointmentApi = {
  list: (p) => api.get('/appointments', { params: p }),
  get: (id) => api.get(`/appointments/${id}`),
  create: (d) => api.post('/appointments', d),
  update: (id, d) => api.patch(`/appointments/${id}`, d),
  checkIn: (id) => api.post(`/appointments/${id}/check-in`),
  cancel: (id) => api.post(`/appointments/${id}/cancel`),
  remove: (id) => api.delete(`/appointments/${id}`),
  doctorQueue: (did, date) => api.get(`/appointments/doctor/${did}/queue`, { params: { date } }),
};

export const visitApi = {
  list: (p) => api.get('/visits', { params: p }),
  get: (id) => api.get(`/visits/${id}`),
  create: (d) => api.post('/visits', d),
  recordVitals: (id, d) => api.post(`/visits/${id}/vitals`, d),
  upsertMedicalRecord: (id, d) => api.put(`/visits/${id}/medical-record`, d),
  addClinicalNote: (id, d) => api.post(`/visits/${id}/clinical-notes`, d),
  createPrescription: (id, d) => api.post(`/visits/${id}/prescriptions`, d),
  complete: (id) => api.post(`/visits/${id}/complete`),
};

export const ipdApi = {
  listWards: (p) => api.get('/ipd/wards', { params: p }),
  listRooms: (p) => api.get('/ipd/rooms', { params: p }),
  listBeds: (p) => api.get('/ipd/beds', { params: p }),
  occupancy: () => api.get('/ipd/occupancy'),
  listAdmissions: (p) => api.get('/ipd/admissions', { params: p }),
  getAdmission: (id) => api.get(`/ipd/admissions/${id}`),
  admit: (d) => api.post('/ipd/admissions', d),
  transfer: (id, d) => api.post(`/ipd/admissions/${id}/transfer`, d),
  discharge: (id, d) => api.post(`/ipd/admissions/${id}/discharge`, d),
};

export const pharmacyApi = {
  listMedicines: (p) => api.get('/pharmacy/medicines', { params: p }),
  getMedicine: (id) => api.get(`/pharmacy/medicines/${id}`),
  createMedicine: (d) => api.post('/pharmacy/medicines', d),
  updateMedicine: (id, d) => api.patch(`/pharmacy/medicines/${id}`, d),
  listBatches: (id) => api.get(`/pharmacy/medicines/${id}/batches`),
  addBatch: (id, d) => api.post(`/pharmacy/medicines/${id}/batches`, d),
  stockAlerts: () => api.get('/pharmacy/alerts'),
  listSales: (p) => api.get('/pharmacy/sales', { params: p }),
  getSale: (id) => api.get(`/pharmacy/sales/${id}`),
  createSale: (d) => api.post('/pharmacy/sales', d),
  listSuppliers: (p) => api.get('/pharmacy/suppliers', { params: p }),
};

export const labApi = {
  listTests: (p) => api.get('/lab/tests', { params: p }),
  listOrders: (p) => api.get('/lab/orders', { params: p }),
  getOrder: (id) => api.get(`/lab/orders/${id}`),
  createOrder: (d) => api.post('/lab/orders', d),
  updateItemStatus: (oid, iid, d) => api.patch(`/lab/orders/${oid}/items/${iid}/status`, d),
  submitResult: (oid, iid, d) => api.post(`/lab/orders/${oid}/items/${iid}/result`, d),
};

export const radiologyApi = {
  listServices: (p) => api.get('/radiology/services', { params: p }),
  listOrders: (p) => api.get('/radiology/orders', { params: p }),
  getOrder: (id) => api.get(`/radiology/orders/${id}`),
  createOrder: (d) => api.post('/radiology/orders', d),
  updateStatus: (id, d) => api.patch(`/radiology/orders/${id}/status`, d),
  upsertReport: (id, d) => api.put(`/radiology/orders/${id}/report`, d),
};

export const billingApi = {
  listBills: (p) => api.get('/billing', { params: p }),
  getBill: (id) => api.get(`/billing/${id}`),
  createBill: (d) => api.post('/billing', d),
  addItem: (id, d) => api.post(`/billing/${id}/items`, d),
  recordPayment: (id, d) => api.post(`/billing/${id}/payments`, d),
  revenueStats: () => api.get('/billing/stats'),
  listCategories: () => api.get('/billing/categories'),
};

export const hrApi = {
  listEmployees: (p) => api.get('/hr/employees', { params: p }),
  getEmployee: (id) => api.get(`/hr/employees/${id}`),
  createEmployee: (d) => api.post('/hr/employees', d),
  updateEmployee: (id, d) => api.patch(`/hr/employees/${id}`, d),
  listDesignations: () => api.get('/hr/designations'),
  markAttendance: (d) => api.post('/hr/attendance', d),
  listAttendance: (p) => api.get('/hr/attendance', { params: p }),
  getSelfAttendance: () => api.get('/hr/attendance/self'),
  selfCheckIn: (d) => api.post('/hr/attendance/self-checkin', d),
  selfCheckOut: (d) => api.post('/hr/attendance/self-checkout', d),
  applyLeave: (d) => api.post('/hr/leaves', d),
  listLeaves: (p) => api.get('/hr/leaves', { params: p }),
  updateLeaveStatus: (id, d) => api.patch(`/hr/leaves/${id}/status`, d),
  listPayrolls: (p) => api.get('/hr/payroll', { params: p }),
  generatePayroll: (d) => api.post('/hr/payroll', d),
  markPaid: (id) => api.post(`/hr/payroll/${id}/mark-paid`),
  listLeaveTypes: () => api.get('/hr/leave-types'),
};

export const notificationApi = {
  list: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/mark-all-read'),
};

export const auditApi = {
  list: (p) => api.get('/audit', { params: p }),
};

export const rolesApi = {
  listRoles: () => api.get('/roles'),
  listPermissions: () => api.get('/roles/permissions'),
  seedPermissions: () => api.post('/roles/permissions/seed'),
  createRole: (d) => api.post('/roles', d),
  setRolePermissions: (roleId, permissionIds) => api.put(`/roles/${roleId}/permissions`, { permissionIds }),
  listUsers: (p) => api.get('/roles/users', { params: p }),
  changeUserRole: (tenantUserId, roleId) => api.patch(`/roles/users/${tenantUserId}/role`, { roleId }),
  toggleUserActive: (userId) => api.patch(`/roles/users/${userId}/toggle-active`),
};

export const emergencyApi = {
  stats:           ()       => api.get('/emergency/stats'),
  list:            (p)      => api.get('/emergency', { params: p }),
  get:             (id)     => api.get(`/emergency/${id}`),
  create:          (d)      => api.post('/emergency', d),
  update:          (id, d)  => api.patch(`/emergency/${id}`, d),
  addTriage:       (id, d)  => api.post(`/emergency/${id}/triage`, d),
};

export const otApi = {
  stats: () => api.get('/ot/stats'),
  listRooms: (p) => api.get('/ot/rooms', { params: p }),
  createRoom: (d) => api.post('/ot/rooms', d),
  updateRoom: (id, d) => api.patch(`/ot/rooms/${id}`, d),
  listSchedules: (p) => api.get('/ot', { params: p }),
  getSchedule: (id) => api.get(`/ot/${id}`),
  createSchedule: (d) => api.post('/ot', d),
  updateSchedule: (id, d) => api.patch(`/ot/${id}`, d),
  updateStatus: (id, d) => api.patch(`/ot/${id}/status`, d),
};

export const insuranceApi = {
  stats: () => api.get('/insurance/stats'),
  listPayers: (p) => api.get('/insurance/payers', { params: p }),
  createPayer: (d) => api.post('/insurance/payers', d),
  updatePayer: (id, d) => api.patch(`/insurance/payers/${id}`, d),
  listClaims: (p) => api.get('/insurance/claims', { params: p }),
  createClaim: (d) => api.post('/insurance/claims', d),
  updateClaimStatus: (id, d) => api.patch(`/insurance/claims/${id}/status`, d),
};

export const bloodBankApi = {
  stats: () => api.get('/blood-bank/stats'),
  listDonors: (p) => api.get('/blood-bank/donors', { params: p }),
  createDonor: (d) => api.post('/blood-bank/donors', d),
  updateDonor: (id, d) => api.patch(`/blood-bank/donors/${id}`, d),
  listUnits: (p) => api.get('/blood-bank/units', { params: p }),
  addUnit: (d) => api.post('/blood-bank/units', d),
  issueUnit: (id, d) => api.post(`/blood-bank/units/${id}/issue`, d),
};

export const inventoryApi = {
  stats: () => api.get('/inventory/stats'),
  listCategories: (p) => api.get('/inventory/categories', { params: p }),
  createCategory: (d) => api.post('/inventory/categories', d),
  listItems: (p) => api.get('/inventory/items', { params: p }),
  getItem: (id) => api.get(`/inventory/items/${id}`),
  createItem: (d) => api.post('/inventory/items', d),
  updateItem: (id, d) => api.patch(`/inventory/items/${id}`, d),
  lowStock: () => api.get('/inventory/items/low-stock'),
  listPOs: (p) => api.get('/inventory/purchase-orders', { params: p }),
  createPO: (d) => api.post('/inventory/purchase-orders', d),
  receivePO: (id, d) => api.post(`/inventory/purchase-orders/${id}/receive`, d),
};

export const shiftApi = {
  listTemplates: (p) => api.get('/hr-ext/shift-templates', { params: p }),
  createTemplate: (d) => api.post('/hr-ext/shift-templates', d),
  updateTemplate: (id, d) => api.patch(`/hr-ext/shift-templates/${id}`, d),
  listAssignments: (p) => api.get('/hr-ext/shift-assignments', { params: p }),
  assignShift: (d) => api.post('/hr-ext/shift-assignments', d),
};

export const doctorRevenueApi = {
  listRules: (p) => api.get('/hr-ext/doctor-revenue/rules', { params: p }),
  createRule: (d) => api.post('/hr-ext/doctor-revenue/rules', d),
  listEntries: (p) => api.get('/hr-ext/doctor-revenue/entries', { params: p }),
  createEntry: (d) => api.post('/hr-ext/doctor-revenue/entries', d),
  markPaid: (id) => api.post(`/hr-ext/doctor-revenue/entries/${id}/mark-paid`),
};

export const incentiveApi = {
  listRules: (p) => api.get('/hr-ext/incentive-rules', { params: p }),
  createRule: (d) => api.post('/hr-ext/incentive-rules', d),
  listEntries: (p) => api.get('/hr-ext/incentive-entries', { params: p }),
  createEntry: (d) => api.post('/hr-ext/incentive-entries', d),
  markPaid: (id) => api.post(`/hr-ext/incentive-entries/${id}/mark-paid`),
};

export const loanApi = {
  listLoans: (p) => api.get('/hr-ext/loans', { params: p }),
  createLoan: (d) => api.post('/hr-ext/loans', d),
  markRepaymentPaid: (id) => api.post(`/hr-ext/loans/repayments/${id}/mark-paid`),
};

export const recruitmentApi = {
  listJobs: (p) => api.get('/hr-ext/jobs', { params: p }),
  createJob: (d) => api.post('/hr-ext/jobs', d),
  listApplications: (p) => api.get('/hr-ext/jobs/applications', { params: p }),
  createApplication: (d) => api.post('/hr-ext/jobs/applications', d),
  updateApplicationStatus: (id, d) => api.patch(`/hr-ext/jobs/applications/${id}/status`, d),
};

export const performanceApi = {
  list: (p) => api.get('/hr-ext/performance', { params: p }),
  create: (d) => api.post('/hr-ext/performance', d),
  updateStatus: (id, d) => api.patch(`/hr-ext/performance/${id}/status`, d),
};

export const dietApi = {
  listPlans: (p) => api.get('/diet/plans', { params: p }),
  createPlan: (d) => api.post('/diet/plans', d),
  updatePlan: (id, d) => api.patch(`/diet/plans/${id}`, d),
  listAssignments: (p) => api.get('/diet/assignments', { params: p }),
  assignDiet: (d) => api.post('/diet/assignments', d),
};

export const ambulanceApi = {
  listFleet: (p) => api.get('/ambulance/fleet', { params: p }),
  createAmbulance: (d) => api.post('/ambulance/fleet', d),
  updateAmbulance: (id, d) => api.patch(`/ambulance/fleet/${id}`, d),
  listCalls: (p) => api.get('/ambulance/calls', { params: p }),
  createCall: (d) => api.post('/ambulance/calls', d),
  updateCall: (id, d) => api.patch(`/ambulance/calls/${id}`, d),
};

export const visitorApi = {
  list: (p) => api.get('/visitors', { params: p }),
  checkIn: (d) => api.post('/visitors/check-in', d),
  checkOut: (id) => api.patch(`/visitors/${id}/check-out`),
};

export const complaintApi = {
  stats: () => api.get('/complaints/stats'),
  list: (p) => api.get('/complaints', { params: p }),
  create: (d) => api.post('/complaints', d),
  update: (id, d) => api.patch(`/complaints/${id}`, d),
};

export const mortuaryApi = {
  list: (p) => api.get('/mortuary', { params: p }),
  create: (d) => api.post('/mortuary', d),
  release: (id, d) => api.patch(`/mortuary/${id}/release`, d),
};

export const documentApi = {
  list: (p) => api.get('/documents', { params: p }),
  create: (d) => api.post('/documents', d),
  verify: (id) => api.patch(`/documents/${id}/verify`),
};

export const letterApi = {
  listTemplates: (p) => api.get('/letters/templates', { params: p }),
  createTemplate: (d) => api.post('/letters/templates', d),
  updateTemplate: (id, d) => api.patch(`/letters/templates/${id}`, d),
  listIssuances: (p) => api.get('/letters/issuances', { params: p }),
  issueFromTemplate: (id, d) => api.post(`/letters/templates/${id}/issue`, d),
};

export const qrApi = {
  generate: (d) => api.post('/qr/generate', d),
  verify: (token) => api.post('/qr/verify', { token }),
};

export const voiceNoteApi = {
  list: (p) => api.get('/voice-notes', { params: p }),
  create: (d) => api.post('/voice-notes', d),
  update: (id, d) => api.patch(`/voice-notes/${id}`, d),
  delete: (id) => api.delete(`/voice-notes/${id}`),
};

export const salaryApi = {
  listStructures: (p) => api.get('/salary/structures', { params: p }),
  createStructure: (d) => api.post('/salary/structures', d),
  updateStructure: (id, d) => api.patch(`/salary/structures/${id}`, d),
  previewBreakdown: (d) => api.post('/salary/structures/preview', d),
  listAssignments: (p) => api.get('/salary/assignments', { params: p }),
  assignStructure: (d) => api.post('/salary/assignments', d),
  listOvertime: (p) => api.get('/salary/overtime', { params: p }),
  createOvertime: (d) => api.post('/salary/overtime', d),
  approveOvertime: (id) => api.post(`/salary/overtime/${id}/approve`),
  listStatutory: (p) => api.get('/salary/statutory', { params: p }),
  generateStatutory: (d) => api.post('/salary/statutory/generate', d),
};

export const notifChannelApi = {
  stats: () => api.get('/notification-channels/stats'),
  listTemplates: (p) => api.get('/notification-channels/templates', { params: p }),
  createTemplate: (d) => api.post('/notification-channels/templates', d),
  updateTemplate: (id, d) => api.patch(`/notification-channels/templates/${id}`, d),
  listLogs: (p) => api.get('/notification-channels/logs', { params: p }),
  send: (d) => api.post('/notification-channels/send', d),
  fireEvent: (d) => api.post('/notification-channels/fire-event', d),
};

export const ePrescApi = {
  listSeals: (p) => api.get('/e-prescription/seals', { params: p }),
  upsertSeal: (d) => api.post('/e-prescription/seals', d),
  getSealByDoctor: (doctorId) => api.get(`/e-prescription/seals/doctor/${doctorId}`),
  printUrl: (prescriptionId) => `${api.defaults.baseURL}/e-prescription/print/${prescriptionId}`,
};

export const telemedicineApi = {
  createRoom: (d) => api.post('/telemedicine/create-room', d),
};

export const aiPrescApi = {
  suggest: (d) => api.post('/ai-prescription/suggest', d),
};

export const publicBookingApi = {
  getHospital: (slug) => api.get(`/public/book/${slug}`),  // no auth
  book: (slug, d) => api.post(`/public/book/${slug}`, d),
};

export const bookingSlugApi = {
  list: () => api.get('/booking-slugs'),
  create: (d) => api.post('/booking-slugs', d),
  update: (id, d) => api.patch(`/booking-slugs/${id}`, d),
};

export const cssdApi = {
  stats: () => api.get('/cssd/stats'),
  listItems: (p) => api.get('/cssd/items', { params: p }),
  createItem: (d) => api.post('/cssd/items', d),
  updateItem: (id, d) => api.patch(`/cssd/items/${id}`, d),
  listPacks: (p) => api.get('/cssd/packs', { params: p }),
  createPack: (d) => api.post('/cssd/packs', d),
  updatePackStatus: (id, status) => api.patch(`/cssd/packs/${id}/status`, { status }),
  listCycles: (p) => api.get('/cssd/cycles', { params: p }),
  createCycle: (d) => api.post('/cssd/cycles', d),
  completeCycle: (id, d) => api.post(`/cssd/cycles/${id}/complete`, d),
};

export const serviceApi = {
  list: (p) => api.get('/services', { params: p }),
  create: (d) => api.post('/services', d),
  update: (id, d) => api.patch(`/services/${id}`, d),
  remove: (id) => api.delete(`/services/${id}`),
};

export const encounterApi = {
  list: (p) => api.get('/encounters', { params: p }),
  getById: (id) => api.get(`/encounters/${id}`),
  create: (d) => api.post('/encounters', d),
  close: (id) => api.post(`/encounters/${id}/close`),
  patientHistory: (patientId) => api.get(`/encounters/patient/${patientId}/history`),
};

export const orderApi = {
  stats: () => api.get('/orders/stats'),
  list: (p) => api.get('/orders', { params: p }),
  create: (d) => api.post('/orders', d),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
};

export const paymentSplitApi = {
  getByBill: (billId) => api.get(`/payment-splits/bill/${billId}`),
  addSplits: (billId, splits) => api.post(`/payment-splits/bill/${billId}`, { splits }),
};

export const bedApi = {
  liveStatus: () => api.get('/beds/live'),
  history: (bedId) => api.get(`/beds/${bedId}/history`),
  changeStatus: (bedId, d) => api.post(`/beds/${bedId}/status`, d),
};

export const auditExtApi = {
  list: (p) => api.get('/audit-ext', { params: p }),
};

export const realtimeUrl = () => {
  const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
  return `${base}/realtime/stream`;
};
