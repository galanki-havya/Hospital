import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ipdApi } from '../../api/index.js';
import { PageHeader, StatCard, Spinner, ErrorState, StatusBadge } from '../../components/ui/LoadingScreen.jsx';
import { BedDouble, Building2, DoorOpen } from 'lucide-react';
import clsx from 'clsx';

const bedStatusColor = {
  Available: 'bg-green-100 text-green-700 border-green-200',
  Occupied: 'bg-red-100 text-red-700 border-red-200',
  Reserved: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Maintenance: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function IPDPage() {
  const navigate = useNavigate();
  const { data: occupancy, isLoading: occLoading } = useQuery({
    queryKey: ['bed-occupancy'],
    queryFn: () => ipdApi.occupancy().then(r => r.data.data),
    refetchInterval: 30_000,
  });
  const { data: bedsData, isLoading: bedsLoading } = useQuery({
    queryKey: ['beds-all'],
    queryFn: () => ipdApi.listBeds({ limit: 100 }).then(r => r.data.data),
  });
  const { data: wardsData } = useQuery({
    queryKey: ['wards-all'],
    queryFn: () => ipdApi.listWards({ limit: 100 }).then(r => r.data.data),
  });

  if (occLoading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  const occ = occupancy ?? {};

  return (
    <div className="space-y-6">
      <PageHeader title="IPD — Wards & Beds" subtitle="Inpatient department management">
        <button onClick={() => navigate('/ipd/admissions')} className="btn-primary">
          <BedDouble className="w-4 h-4" /> Manage Admissions
        </button>
      </PageHeader>

      {/* Occupancy KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Beds" value={occ.total ?? 0} icon={BedDouble} color="blue" />
        <StatCard label="Available" value={occ.available ?? 0} icon={BedDouble} color="green" />
        <StatCard label="Occupied" value={occ.occupied ?? 0} icon={BedDouble} color="red" />
        <StatCard label="Occupancy Rate" value={occ.occupancyRate ?? 0} suffix="%" icon={Building2} color="purple" />
      </div>

      {/* Occupancy bar */}
      <div className="card card-body">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Bed Occupancy</h3>
          <span className="text-sm text-slate-500">{occ.occupied} of {occ.total} beds occupied</span>
        </div>
        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
          <div className="bg-red-400 h-full transition-all" style={{ width: `${occ.total ? (occ.occupied / occ.total) * 100 : 0}%` }} />
          <div className="bg-yellow-300 h-full transition-all" style={{ width: `${occ.total ? (occ.reserved / occ.total) * 100 : 0}%` }} />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Occupied ({occ.occupied})</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-300 inline-block" /> Reserved ({occ.reserved ?? 0})</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Available ({occ.available})</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" /> Maintenance ({occ.maintenance ?? 0})</span>
        </div>
      </div>

      {/* Beds grid */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-900">Bed Status Map</h3>
        </div>
        <div className="p-6">
          {bedsLoading ? <Spinner /> : (
            <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-12 gap-2">
              {bedsData?.map(bed => (
                <div key={bed.id}
                  className={clsx('border rounded-lg p-2 text-center cursor-default transition-all hover:scale-105', bedStatusColor[bed.status] ?? 'bg-slate-50 border-slate-200')}
                  title={`${bed.bedNumber} — ${bed.status}\n${bed.room?.ward?.name ?? ''} / ${bed.room?.roomNumber ?? ''}`}
                >
                  <BedDouble className="w-4 h-4 mx-auto mb-0.5" />
                  <p className="text-[9px] font-mono leading-tight">{bed.bedNumber}</p>
                </div>
              ))}
              {(!bedsData || bedsData.length === 0) && (
                <p className="col-span-12 text-sm text-slate-400 text-center py-4">No beds configured. Add wards → rooms → beds to get started.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Wards list */}
      {wardsData && wardsData.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-slate-900">Wards</h3></div>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Ward Name</th><th>Type</th><th>Floor</th><th>Status</th></tr></thead>
              <tbody>
                {wardsData.map(w => (
                  <tr key={w.id}>
                    <td className="font-medium text-slate-900">{w.name}</td>
                    <td><span className="badge badge-blue">{w.wardType}</span></td>
                    <td>{w.floorNumber ?? '—'}</td>
                    <td><StatusBadge status={w.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
