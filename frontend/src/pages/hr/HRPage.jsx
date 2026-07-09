// HRPage.jsx
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hrApi } from '../../api/index.js';
import { StatCard, PageHeader } from '../../components/ui/LoadingScreen.jsx';
import { Users, CalendarCheck, Clock, DollarSign } from 'lucide-react';

export default function HRPage() {
  const navigate = useNavigate();
  const { data: employees } = useQuery({ queryKey: ['employees-count'], queryFn: () => hrApi.listEmployees({ limit: 1 }).then(r => r.data.meta?.pagination?.total ?? 0) });
  const { data: leaves } = useQuery({ queryKey: ['leaves-pending'], queryFn: () => hrApi.listLeaves({ status: 'Pending', limit: 1 }).then(r => r.data.meta?.pagination?.total ?? 0) });
  const { data: payrolls } = useQuery({ queryKey: ['payrolls-pending'], queryFn: () => hrApi.listPayrolls({ limit: 1 }).then(r => r.data.meta?.pagination?.total ?? 0) });

  const tiles = [
    { label: 'Employees', to: '/hr/employees', icon: Users, color: 'blue', value: employees ?? '—' },
    { label: 'Attendance', to: '/hr/attendance', icon: CalendarCheck, color: 'green', value: 'Track' },
    { label: 'Leave Requests', to: '/hr/leaves', icon: Clock, color: 'orange', value: leaves ?? '—' },
    { label: 'Payroll', to: '/hr/payroll', icon: DollarSign, color: 'purple', value: payrolls ?? '—' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="HR & Payroll" subtitle="Human resources management" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map(t => (
          <button key={t.to} onClick={() => navigate(t.to)} className="text-left hover:scale-[1.02] transition-transform">
            <StatCard label={t.label} value={t.value} icon={t.icon} color={t.color} />
          </button>
        ))}
      </div>
      <div className="card card-body text-center py-12 text-slate-400 text-sm">
        Select a module above to manage HR operations
      </div>
    </div>
  );
}
