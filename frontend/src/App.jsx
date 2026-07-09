import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { usePlatformAuth } from './context/PlatformAuthContext.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import LoadingScreen from './components/ui/LoadingScreen.jsx';

// Platform (Developer/SuperAdmin) console — separate auth system, see
// context/PlatformAuthContext.jsx and backend/src/middleware/authenticatePlatform.js
import PlatformLoginPage from './pages/platform/PlatformLoginPage.jsx';
import PlatformConsolePage from './pages/platform/PlatformConsolePage.jsx';

// Pages
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import PatientsPage from './pages/patients/PatientsPage.jsx';
import PatientDetailPage from './pages/patients/PatientDetailPage.jsx';
import DoctorsPage from './pages/doctors/DoctorsPage.jsx';
import DoctorDetailPage from './pages/doctors/DoctorDetailPage.jsx';
import AppointmentsPage from './pages/appointments/AppointmentsPage.jsx';
import VisitsPage from './pages/visits/VisitsPage.jsx';
import VisitDetailPage from './pages/visits/VisitDetailPage.jsx';
import IPDPage from './pages/ipd/IPDPage.jsx';
import AdmissionsPage from './pages/ipd/AdmissionsPage.jsx';
import PharmacyPage from './pages/pharmacy/PharmacyPage.jsx';
import PharmacySalesPage from './pages/pharmacy/PharmacySalesPage.jsx';
import LabOrdersPage from './pages/lab/LabOrdersPage.jsx';
import LabTestsPage from './pages/lab/LabTestsPage.jsx';
import RadiologyPage from './pages/radiology/RadiologyPage.jsx';
import BillingPage from './pages/billing/BillingPage.jsx';
import BillDetailPage from './pages/billing/BillDetailPage.jsx';
import HRPage from './pages/hr/HRPage.jsx';
import EmployeesPage from './pages/hr/EmployeesPage.jsx';
import AttendancePage from './pages/hr/AttendancePage.jsx';
import LeavePage from './pages/hr/LeavePage.jsx';
import PayrollPage from './pages/hr/PayrollPage.jsx';
import NotificationsPage from './pages/notifications/NotificationsPage.jsx';
import RolesPage from './pages/admin/RolesPage.jsx';
import EmergencyPage from './pages/emergency/EmergencyPage.jsx';

import OTPage from './pages/ot/OTPage.jsx';
import InsurancePage from './pages/insurance/InsurancePage.jsx';
import BloodBankPage from './pages/bloodbank/BloodBankPage.jsx';
import InventoryPage from './pages/inventory/InventoryPage.jsx';
import HRExtPage from './pages/hr/HRExtPage.jsx';
import OperationsPage from './pages/operations/OperationsPage.jsx';
import SalaryPage from './pages/salary/SalaryPage.jsx';
import NotificationChannelsPage from './pages/notifications-ext/NotificationChannelsPage.jsx';
import EPrescriptionPage from './pages/eprescription/EPrescriptionPage.jsx';
import TelemedicinePage from './pages/telemedicine/TelemedicinePage.jsx';
import PublicBookingPage from './pages/booking/PublicBookingPage.jsx';
import BookingAdminPage from './pages/booking/BookingAdminPage.jsx';
import CssdPage from './pages/cssd/CssdPage.jsx';
import EncountersPage from './pages/encounters/EncountersPage.jsx';
import { ServiceMasterPage, LiveBedPage, AuditLogPage } from './pages/services/SystemPages.jsx';
import AIPrescriptionPage from './pages/ai/AIPrescriptionPage.jsx';
import VoiceNotesPage from './pages/voice/VoiceNotesPage.jsx';
import BiometricPage from './pages/biometric/BiometricPage.jsx';
import PatientAppPage from './pages/mobileapp/PatientAppPage.jsx';
import IDCardPage from './pages/hr/IDCardPage.jsx';
import EmployeeDocumentsPage from './pages/hr/EmployeeDocumentsPage.jsx';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

function PlatformPrivateRoute({ children }) {
  const { isAuthenticated, loading } = usePlatformAuth();
  if (loading) return <LoadingScreen />;
  return isAuthenticated ? children : <Navigate to="/platform/login" replace />;
}

function PlatformPublicRoute({ children }) {
  const { isAuthenticated, loading } = usePlatformAuth();
  if (loading) return <LoadingScreen />;
  return isAuthenticated ? <Navigate to="/platform" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      {/* Private – wrapped in sidebar layout */}
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        <Route path="patients" element={<PatientsPage />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />

        <Route path="doctors" element={<DoctorsPage />} />
        <Route path="doctors/:id" element={<DoctorDetailPage />} />

        <Route path="appointments" element={<AppointmentsPage />} />

        <Route path="visits" element={<VisitsPage />} />
        <Route path="visits/:id" element={<VisitDetailPage />} />

        <Route path="ipd" element={<IPDPage />} />
        <Route path="ipd/admissions" element={<AdmissionsPage />} />

        <Route path="pharmacy" element={<PharmacyPage />} />
        <Route path="pharmacy/sales" element={<PharmacySalesPage />} />

        <Route path="lab" element={<LabOrdersPage />} />
        <Route path="lab/tests" element={<LabTestsPage />} />

        <Route path="radiology" element={<RadiologyPage />} />

        <Route path="billing" element={<BillingPage />} />
        <Route path="billing/:id" element={<BillDetailPage />} />

        <Route path="hr" element={<HRPage />} />
        <Route path="hr/employees" element={<EmployeesPage />} />
        <Route path="hr/attendance" element={<AttendancePage />} />
        <Route path="hr/leaves" element={<LeavePage />} />
        <Route path="hr/payroll" element={<PayrollPage />} />
        <Route path="hr/extended" element={<HRExtPage />} />

        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="admin/roles" element={<RolesPage />} />
        <Route path="emergency" element={<EmergencyPage />} />

        {/* ── New Modules ── */}
        <Route path="ot" element={<OTPage />} />
        <Route path="insurance" element={<InsurancePage />} />
        <Route path="blood-bank" element={<BloodBankPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="salary" element={<SalaryPage />} />
        <Route path="notifications/channels" element={<NotificationChannelsPage />} />
        <Route path="e-prescription" element={<EPrescriptionPage />} />
        <Route path="telemedicine" element={<TelemedicinePage />} />
        <Route path="online-booking" element={<BookingAdminPage />} />
        <Route path="cssd" element={<CssdPage />} />
        <Route path="encounters" element={<EncountersPage />} />
        <Route path="services" element={<ServiceMasterPage />} />
        <Route path="beds/live" element={<LiveBedPage />} />
        <Route path="audit" element={<AuditLogPage />} />
        <Route path="ai-prescription" element={<AIPrescriptionPage />} />
        <Route path="voice-notes" element={<VoiceNotesPage />} />
        <Route path="biometric" element={<BiometricPage />} />
        <Route path="patient-app" element={<PatientAppPage />} />
        <Route path="hr/id-cards" element={<IDCardPage />} />
        <Route path="hr/employee-documents" element={<EmployeeDocumentsPage />} />
      </Route>

      {/* Platform Console — Developer/SuperAdmin only, entirely separate auth
          from the tenant app above. Not linked from the tenant sidebar; visit
          /platform/login directly. */}
      <Route path="/platform/login" element={<PlatformPublicRoute><PlatformLoginPage /></PlatformPublicRoute>} />
      <Route path="/platform" element={<PlatformPrivateRoute><PlatformConsolePage /></PlatformPrivateRoute>} />

      {/* Public Booking — no auth required */}
      <Route path="/book/:slug" element={<PublicBookingPage />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
