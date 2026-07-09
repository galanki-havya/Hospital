import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Stethoscope, CalendarDays, ClipboardList,
  BedDouble, Pill, FlaskConical, RadioTower, CreditCard,
  UsersRound, Bell, ChevronLeft, Building2, Activity,
  ShieldCheck, AlertTriangle, Scissors, Shield, Droplets,
  Package, Calendar, DollarSign, Gift, CreditCard as Loan,
  Briefcase, Star, Ambulance, MessageSquare, Moon, Apple,
  FolderOpen, FileText, QrCode, Truck,
  Video, Globe, MessageCircle, Zap, Settings,
  Brain, Mic, Fingerprint, Smartphone, CreditCard as IDCard, FolderLock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import clsx from 'clsx';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/notifications', icon: Bell,            label: 'Notifications' },
    ],
  },
  {
    label: 'Clinical',
    items: [
      { to: '/emergency',    icon: AlertTriangle,  label: 'Emergency',    alert: true },
      { to: '/patients',     icon: Users,          label: 'Patients' },
      { to: '/doctors',      icon: Stethoscope,    label: 'Doctors' },
      { to: '/appointments', icon: CalendarDays,   label: 'Appointments' },
      { to: '/visits',       icon: ClipboardList,  label: 'Visits / EMR' },
      { to: '/ipd',          icon: BedDouble,      label: 'IPD & Beds' },
      { to: '/ot',           icon: Scissors,       label: 'OT / Surgery' },
    ],
  },
  {
    label: 'Diagnostics & Pharma',
    items: [
      { to: '/pharmacy',    icon: Pill,        label: 'Pharmacy' },
      { to: '/lab',         icon: FlaskConical, label: 'Laboratory' },
      { to: '/radiology',   icon: RadioTower,  label: 'Radiology' },
      { to: '/blood-bank',  icon: Droplets,    label: 'Blood Bank' },
    ],
  },
  {
    label: 'Finance & Insurance',
    items: [
      { to: '/billing',    icon: CreditCard, label: 'Billing' },
      { to: '/insurance',  icon: Shield,     label: 'Insurance / TPA' },
    ],
  },
  {
    label: 'Inventory & Stores',
    items: [
      { to: '/inventory',  icon: Package,  label: 'Inventory' },
    ],
  },
  {
    label: 'HR & Payroll',
    items: [
      { to: '/hr',                     icon: UsersRound,  label: 'HR & Payroll' },
      { to: '/hr/extended',            icon: Calendar,    label: 'Shifts · Revenue · Loans' },
      { to: '/salary',                 icon: DollarSign,  label: 'Salary · PF · ESI · TDS' },
      { to: '/hr/id-cards',            icon: IDCard,      label: 'ID Card Generation' },
      { to: '/hr/employee-documents',  icon: FolderLock,  label: 'Employee Documents' },
      { to: '/biometric',              icon: Fingerprint, label: 'Biometric Integration' },
    ],
  },
  {
    label: 'Clinical Core',
    items: [
      { to: '/encounters',  icon: Activity,      label: 'Encounters' },
      { to: '/beds/live',   icon: BedDouble,     label: 'Live Bed Status' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/operations',  icon: Activity,   label: 'Operations Hub' },
      { to: '/cssd',        icon: Zap,        label: 'CSSD' },
    ],
  },
  {
    label: 'Digital Health',
    items: [
      { to: '/e-prescription',         icon: FileText,      label: 'e-Prescription' },
      { to: '/telemedicine',           icon: Video,         label: 'Telemedicine & Voice' },
      { to: '/online-booking',         icon: Globe,         label: 'Online Booking (QR)' },
      { to: '/notifications/channels', icon: MessageCircle, label: 'SMS / WhatsApp' },
      { to: '/patient-app',            icon: Smartphone,    label: 'Patient Mobile App' },
    ],
  },
  {
    label: 'AI & Advanced',
    items: [
      { to: '/ai-prescription', icon: Brain, label: 'AI Prescription Assist' },
      { to: '/voice-notes',     icon: Mic,   label: 'Voice-to-Text Notes' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/services', icon: Settings, label: 'Service Master' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin/roles', icon: ShieldCheck, label: 'Roles & Access' },
      { to: '/audit',       icon: Shield,      label: 'Audit Log' },
    ],
  },
];

export default function Sidebar({ open, onToggle }) {
  const { tenant } = useAuth();

  return (
    <aside className={clsx(
      'flex flex-col bg-slate-900 text-slate-300 transition-all duration-200 shrink-0 z-20',
      open ? 'w-60' : 'w-16'
    )}>
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-600 shrink-0">
          <Activity className="w-4 h-4 text-white" />
        </div>
        {open && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">MediCore</p>
            <p className="text-xs text-slate-400 truncate">{tenant?.name || 'HMS'}</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className={clsx('ml-auto p-1 rounded hover:bg-slate-700 transition-colors', !open && 'hidden')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            {open && (
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? item.alert
                            ? 'bg-red-600 text-white'
                            : 'bg-primary-600 text-white'
                          : item.alert
                            ? 'text-red-400 hover:bg-red-900/40 hover:text-red-300'
                            : 'text-slate-400 hover:bg-slate-700/60 hover:text-white'
                      )
                    }
                    title={!open ? item.label : undefined}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {open && <span className="truncate">{item.label}</span>}
                    {/* Pulse dot for Emergency when collapsed */}
                    {!open && item.alert && (
                      <span className="absolute ml-6 mt-[-14px] w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Tenant badge */}
      {open && tenant && (
        <div className="px-3 py-3 border-t border-slate-700/50">
          <div className="flex items-center gap-2 px-2 py-2 bg-slate-800 rounded-lg">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-mono text-slate-300 truncate">{tenant.code}</p>
              <p className="text-[10px] text-slate-500 capitalize">
                {tenant.type?.replace(/([A-Z])/g, ' $1').trim()}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
