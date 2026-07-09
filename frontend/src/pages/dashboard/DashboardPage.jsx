import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../api/index.js';
import {
  Users, Stethoscope, BedDouble, CreditCard,
  CalendarDays, FlaskConical, Pill, UsersRound,
  Activity, TrendingUp,
} from 'lucide-react';
import { StatCard, ErrorState, Spinner } from '../../components/ui/LoadingScreen.jsx';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext.jsx';

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

function RecentActivity({ items = [] }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-slate-900">Recent Activity</h3>
      </div>
      <div className="divide-y divide-slate-50">
        {items.length === 0 && <p className="text-sm text-slate-400 px-6 py-4">No recent activity</p>}
        {items.map((a) => (
          <div key={a.id} className="px-6 py-3 flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 shrink-0 mt-0.5">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-700 font-medium">{a.action}</p>
              <p className="text-xs text-slate-400">{a.user} · {a.module}</p>
            </div>
            <p className="text-xs text-slate-400 shrink-0 ml-auto">
              {format(new Date(a.at), 'HH:mm')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, tenant } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get().then((r) => r.data.data),
    refetchInterval: 120_000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );

  if (error) return <ErrorState message="Failed to load dashboard" onRetry={refetch} />;

  const d = data;

  const apptStatusData = d.appointments.byStatus.map((s) => ({
    name: s.status,
    value: s.count,
  }));

  const revenueData = (d.revenue.revenueByDay || []).map((r) => ({
    date: format(new Date(r.date), 'MMM d'),
    revenue: Number(r.total),
  }));

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Good {getGreeting()}, {user?.firstName} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{tenant?.name} · {format(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Patients" value={d.patients.total.toLocaleString()} icon={Users} color="blue" delta={d.patients.newThisMonth} />
        <StatCard label="Today's Appointments" value={d.appointments.today} icon={CalendarDays} color="purple" />
        <StatCard label="Active Admissions" value={d.ipd.activeAdmissions} icon={BedDouble} color="teal" />
        <StatCard label="Today's Revenue" value={`₹${(d.revenue.today || 0).toLocaleString()}`} icon={CreditCard} color="green" />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Beds Available" value={d.ipd.beds.available} icon={BedDouble} color="green" />
        <StatCard label="Pending Bills" value={d.revenue.pendingBills} icon={TrendingUp} color="orange" />
        <StatCard label="Lab Orders Today" value={d.lab.ordersToday} icon={FlaskConical} color="blue" />
        <StatCard
          label="Active Emergencies"
          value={d.emergency?.activeCases ?? 0}
          icon={Activity}
          color={d.emergency?.activeCases > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue area chart */}
        <div className="card lg:col-span-2">
          <div className="card-header">
            <h3 className="font-semibold text-slate-900">Revenue – Last 7 Days</h3>
            <span className="text-sm text-slate-500">
              This month: ₹{(d.revenue.thisMonth || 0).toLocaleString()}
            </span>
          </div>
          <div className="p-4 h-56">
            {revenueData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">No revenue data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [`₹${v.toLocaleString()}`, 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Appointment status pie */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-900">Appointments by Status</h3>
          </div>
          <div className="p-4 h-56 flex items-center justify-center">
            {apptStatusData.length === 0 ? (
              <p className="text-sm text-slate-400">No appointment data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={apptStatusData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={70} paddingAngle={2}>
                    {apptStatusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <RecentActivity items={d.recentActivity} />

        {/* Quick stats */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-900">At a Glance</h3>
          </div>
          <div className="p-6 space-y-4">
            {[
              { label: 'Pending Appointments Today', value: d.appointments.pending, color: 'text-blue-600' },
              { label: 'Bed Occupancy', value: `${d.ipd.beds.occupied} / ${d.ipd.beds.total}`, color: 'text-teal-600' },
              { label: 'Active Emergencies', value: d.emergency?.activeCases ?? 0, color: d.emergency?.activeCases > 0 ? 'text-red-600' : 'text-green-600' },
              { label: 'Pending Leave Requests', value: d.hr.pendingLeaves, color: 'text-orange-600' },
              { label: 'Pending Bills', value: d.revenue.pendingBills, color: 'text-red-600' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className="text-sm text-slate-600">{item.label}</span>
                <span className={`font-bold text-lg ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
