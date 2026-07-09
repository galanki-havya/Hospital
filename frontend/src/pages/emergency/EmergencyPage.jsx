import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  AlertTriangle, Plus, Stethoscope, Clock, Activity,
  ChevronDown, ChevronRight, RefreshCw, User,
} from 'lucide-react';
import { emergencyApi, patientApi, doctorApi } from '../../api/index.js';
import { useListQuery } from '../../hooks/useListQuery.js';
import {
  PageHeader, Spinner, EmptyState, ErrorState,
  Pagination, Modal, StatusBadge, StatCard,
} from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';
import clsx from 'clsx';

const SEV = {
  Critical: { cls: 'bg-red-600 text-white border-red-700',      dot: 'bg-red-500',    label: 'CRITICAL', order: 0 },
  High:     { cls: 'bg-orange-500 text-white border-orange-600', dot: 'bg-orange-400', label: 'HIGH',     order: 1 },
  Medium:   { cls: 'bg-yellow-400 text-slate-900 border-yellow-500', dot: 'bg-yellow-400', label: 'MEDIUM', order: 2 },
  Low:      { cls: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-400', label: 'LOW',    order: 3 },
};

const STATUS_FLOW = ['Waiting', 'InTreatment', 'Admitted', 'Discharged'];

const STATUS_STYLE = {
  Waiting:     'badge-yellow',
  InTreatment: 'badge-blue',
  Admitted:    'badge-purple',
  Discharged:  'badge-green',
};

function getAge(dob) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
}

function SeverityBadge({ severity }) {
  const cfg = SEV[severity] ?? SEV.Low;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border', cfg.cls)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full animate-pulse', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function TriageForm({ caseId, onSuccess, onClose }) {
  const { register, handleSubmit } = useForm();
  const mutation = useMutation({
    mutationFn: (d) => emergencyApi.addTriage(caseId, d),
    onSuccess: () => { toast.success('Triage recorded'); onSuccess(); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to save triage'),
  });

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Blood Pressure</label>
          <input {...register('bloodPressure')} className="input" placeholder="120/80" />
        </div>
        <div>
          <label className="label">Pulse Rate (bpm)</label>
          <input {...register('pulseRate')} type="number" className="input" placeholder="72" />
        </div>
        <div>
          <label className="label">Temperature (°C)</label>
          <input {...register('temperature')} type="number" step="0.1" className="input" placeholder="37.0" />
        </div>
        <div>
          <label className="label">Respiratory Rate</label>
          <input {...register('respiratoryRate')} type="number" className="input" placeholder="16" />
        </div>
        <div className="col-span-2">
          <label className="label">SpO₂ (%)</label>
          <input {...register('oxygenSaturation')} type="number" step="0.1" className="input" placeholder="98" />
          <p className="text-xs text-slate-400 mt-1">⚡ SpO₂ &lt;90 or HR &gt;150 will auto-escalate severity to Critical</p>
        </div>
        <div className="col-span-2">
          <label className="label">Clinical Notes</label>
          <textarea {...register('notes')} rows={3} className="input" placeholder="Observations, interventions taken…" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="btn-primary">
          <Activity className="w-4 h-4" />
          {mutation.isPending ? 'Saving…' : 'Record Triage'}
        </button>
      </div>
    </form>
  );
}

function CaseCard({ ec, doctors, onRefresh }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [triageModal, setTriageModal] = useState(false);

  const updateCase = useMutation({
    mutationFn: (d) => emergencyApi.update(ec.id, d),
    onSuccess: () => { qc.invalidateQueries(['emergency-cases']); qc.invalidateQueries(['emergency-stats']); toast.success('Updated'); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const currentStatusIdx = STATUS_FLOW.indexOf(ec.status);
  const nextStatus = STATUS_FLOW[currentStatusIdx + 1];
  const latestTriage = ec.triageRecords?.[0];

  return (
    <div className={clsx(
      'card border-l-4 transition-all',
      ec.severity === 'Critical' ? 'border-l-red-500' :
      ec.severity === 'High'     ? 'border-l-orange-400' :
      ec.severity === 'Medium'   ? 'border-l-yellow-400' :
                                   'border-l-green-400'
    )}>
      {/* Card header */}
      <div
        className="flex items-start gap-4 p-4 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Patient avatar */}
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
          {ec.patient?.firstName?.[0]}{ec.patient?.lastName?.[0]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900">
              {ec.patient?.firstName} {ec.patient?.lastName}
            </p>
            <span className="font-mono text-xs text-slate-400">{ec.patient?.uhid}</span>
            {ec.patient?.bloodGroup && (
              <span className="badge badge-red">{ec.patient.bloodGroup}</span>
            )}
            {ec.patient?.gender && (
              <span className="text-xs text-slate-400">
                {ec.patient.gender}{ec.patient.dob ? ` · ${getAge(ec.patient.dob)}y` : ''}
              </span>
            )}
          </div>

          <p className="text-sm text-slate-600 mt-1 line-clamp-1">
            {ec.chiefComplaint || <span className="italic text-slate-400">No complaint recorded</span>}
          </p>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <SeverityBadge severity={ec.severity} />
            <span className={clsx('badge', STATUS_STYLE[ec.status])}>{ec.status}</span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(ec.arrivalTime), { addSuffix: true })}
            </span>
            {ec.assignedDoctor && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Stethoscope className="w-3 h-3" />
                Dr. {ec.assignedDoctor.user?.firstName} {ec.assignedDoctor.user?.lastName}
              </span>
            )}
          </div>
        </div>

        {/* Quick triage vitals if available */}
        {latestTriage && (
          <div className="hidden md:flex gap-4 text-xs text-slate-500 shrink-0">
            {latestTriage.bloodPressure && (
              <div className="text-center"><p className="font-bold text-slate-700">{latestTriage.bloodPressure}</p><p>BP</p></div>
            )}
            {latestTriage.pulseRate && (
              <div className="text-center"><p className="font-bold text-slate-700">{latestTriage.pulseRate}</p><p>HR</p></div>
            )}
            {latestTriage.oxygenSaturation && (
              <div className="text-center">
                <p className={clsx('font-bold', Number(latestTriage.oxygenSaturation) < 90 ? 'text-red-600' : 'text-slate-700')}>
                  {Number(latestTriage.oxygenSaturation).toFixed(0)}%
                </p>
                <p>SpO₂</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Action row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status advance */}
            {nextStatus && (
              <button
                onClick={() => updateCase.mutate({ status: nextStatus })}
                disabled={updateCase.isPending}
                className="btn-primary btn-sm"
              >
                → Move to {nextStatus}
              </button>
            )}

            {/* Triage */}
            <button onClick={() => setTriageModal(true)} className="btn-secondary btn-sm">
              <Activity className="w-3.5 h-3.5" /> Record Triage
            </button>

            {/* Assign doctor */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Assign doctor:</label>
              <select
                value={ec.assignedDoctorId ?? ''}
                onChange={e => updateCase.mutate({ assignedDoctorId: e.target.value ? Number(e.target.value) : null })}
                className="input text-xs py-1 w-auto"
              >
                <option value="">Unassigned</option>
                {doctors?.map(d => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.user?.firstName} {d.user?.lastName}
                    {d.specialization ? ` — ${d.specialization}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Severity change */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Severity:</label>
              <select
                value={ec.severity}
                onChange={e => updateCase.mutate({ severity: e.target.value })}
                className="input text-xs py-1 w-auto"
              >
                {['Low','Medium','High','Critical'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Triage history */}
          {ec.triageRecords && ec.triageRecords.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Triage Records</p>
              <div className="space-y-2">
                {ec.triageRecords.map(t => (
                  <div key={t.id} className="bg-slate-50 rounded-lg px-4 py-3 text-sm">
                    <div className="grid grid-cols-5 gap-3 text-center">
                      {[
                        ['BP', t.bloodPressure],
                        ['HR', t.pulseRate ? `${t.pulseRate} bpm` : null],
                        ['Temp', t.temperature ? `${t.temperature}°C` : null],
                        ['RR', t.respiratoryRate ? `${t.respiratoryRate}/min` : null],
                        ['SpO₂', t.oxygenSaturation ? `${Number(t.oxygenSaturation).toFixed(0)}%` : null],
                      ].map(([label, val]) => val ? (
                        <div key={label}>
                          <p className={clsx(
                            'font-bold',
                            label === 'SpO₂' && Number(t.oxygenSaturation) < 90 ? 'text-red-600' :
                            label === 'HR'   && t.pulseRate > 150              ? 'text-red-600' :
                            'text-slate-800'
                          )}>{val}</p>
                          <p className="text-xs text-slate-400">{label}</p>
                        </div>
                      ) : null)}
                    </div>
                    {t.notes && (
                      <p className="mt-2 text-slate-600 text-xs border-t border-slate-100 pt-2">{t.notes}</p>
                    )}
                    <p className="text-right text-[10px] text-slate-400 mt-1">
                      {format(new Date(t.createdAt), 'dd MMM yyyy HH:mm')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Triage modal */}
      <Modal open={triageModal} onClose={() => setTriageModal(false)} title="Record Triage Vitals" size="md">
        <TriageForm
          caseId={ec.id}
          onSuccess={() => { setTriageModal(false); qc.invalidateQueries(['emergency-cases']); }}
          onClose={() => setTriageModal(false)}
        />
      </Modal>
    </div>
  );
}

function StatsBar({ stats }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Active Cases" value={stats.activeCount} icon={AlertTriangle} color="red" />
      <StatCard label="Today's Total" value={stats.todayTotal} icon={User} color="blue" />
      <StatCard
        label="Avg Wait Time"
        value={stats.avgWaitMinutes ?? '—'}
        suffix={stats.avgWaitMinutes != null ? ' min' : ''}
        icon={Clock}
        color="orange"
      />
      <div className="card p-5">
        <p className="text-xs text-slate-500 font-medium mb-3">By Severity</p>
        <div className="flex items-end gap-2 h-10">
          {['Critical','High','Medium','Low'].map(sev => {
            const count = stats.bySeverity?.find(b => b.severity === sev)?.count ?? 0;
            const max   = Math.max(...(stats.bySeverity?.map(b => b.count) ?? [1]), 1);
            const pct   = Math.max(8, (count / max) * 100);
            const colors = { Critical:'bg-red-500', High:'bg-orange-400', Medium:'bg-yellow-400', Low:'bg-green-400' };
            return (
              <div key={sev} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-xs font-bold text-slate-700">{count}</span>
                <div className="w-full rounded-t" style={{ height: `${pct}%`, backgroundColor: colors[sev].replace('bg-','').includes('-') ? undefined : undefined }}>
                  <div className={clsx('w-full h-full rounded-t', colors[sev])} />
                </div>
                <span className="text-[9px] text-slate-400">{sev.slice(0,3)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function EmergencyPage() {
  const qc = useQueryClient();
  const [intakeModal, setIntakeModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { items, total, page, totalPages, isLoading, error, refetch, setPage, updateFilter, filters } =
    useListQuery('emergency-cases', emergencyApi.list, { status: undefined, severity: undefined });

  const { data: stats } = useQuery({
    queryKey: ['emergency-stats'],
    queryFn: () => emergencyApi.stats().then(r => r.data.data),
    refetchInterval: autoRefresh ? 30_000 : false,
  });

  const { data: patients } = useQuery({
    queryKey: ['patients-all'],
    queryFn: () => patientApi.list({ limit: 200 }).then(r => r.data.data),
  });

  const { data: doctors } = useQuery({
    queryKey: ['doctors-all'],
    queryFn: () => doctorApi.list({ limit: 100 }).then(r => r.data.data),
  });

  // Auto-refresh queue every 30s when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => refetch(), 30_000);
    return () => clearInterval(timer);
  }, [autoRefresh, refetch]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const createCase = useMutation({
    mutationFn: emergencyApi.create,
    onSuccess: () => {
      qc.invalidateQueries(['emergency-cases']);
      qc.invalidateQueries(['emergency-stats']);
      toast.success('Emergency case created');
      setIntakeModal(false);
      reset();
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to register case'),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Emergency & Triage
          </h1>
          <p className="page-subtitle">{total} case{total !== 1 ? 's' : ''} · Live queue</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={clsx('btn-secondary btn-sm', autoRefresh && 'text-green-600 border-green-200 bg-green-50')}
            title={autoRefresh ? 'Auto-refresh ON (every 30s)' : 'Auto-refresh OFF'}
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', autoRefresh && 'animate-spin')} />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button onClick={() => refetch()} className="btn-secondary btn-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={() => setIntakeModal(true)} className="btn-danger">
            <Plus className="w-4 h-4" /> New Emergency
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Filters */}
      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Severity filter */}
            {['All','Critical','High','Medium','Low'].map(sev => (
              <button
                key={sev}
                onClick={() => updateFilter('severity', sev === 'All' ? undefined : sev)}
                className={clsx(
                  'text-xs font-semibold px-3 py-1.5 rounded-full border transition-all',
                  filters.severity === sev || (sev === 'All' && !filters.severity)
                    ? sev === 'All'
                      ? 'bg-slate-800 text-white border-slate-800'
                      : SEV[sev]?.cls + ' border-current'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                )}
              >
                {sev === 'All' ? 'All Severity' : sev}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <select
              onChange={e => updateFilter('status', e.target.value || undefined)}
              className="input text-sm w-auto"
            >
              <option value="">All Status</option>
              {STATUS_FLOW.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {isLoading && <Spinner />}
          </div>
        </div>

        {/* Case list */}
        <div className="p-4 space-y-3">
          {error && <ErrorState message="Failed to load emergency cases" onRetry={refetch} />}

          {!error && items.length === 0 && !isLoading && (
            <EmptyState
              title="No active emergency cases"
              description="Register a new emergency case using the button above"
            />
          )}

          {items.map(ec => (
            <CaseCard
              key={ec.id}
              ec={ec}
              doctors={doctors}
              onRefresh={refetch}
            />
          ))}

          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>

      {/* Emergency intake modal */}
      <Modal open={intakeModal} onClose={() => setIntakeModal(false)} title="Register Emergency Case" size="lg">
        <form
          onSubmit={handleSubmit(d => createCase.mutate({
            ...d,
            patientId:        Number(d.patientId),
            assignedDoctorId: d.assignedDoctorId ? Number(d.assignedDoctorId) : null,
          }))}
          className="space-y-4"
        >
          {/* Severity — shown first and prominently */}
          <div>
            <label className="label">Severity *</label>
            <div className="grid grid-cols-4 gap-2">
              {['Low','Medium','High','Critical'].map(sev => (
                <label key={sev} className="cursor-pointer">
                  <input
                    {...register('severity', { required: 'Severity is required' })}
                    type="radio"
                    value={sev}
                    className="sr-only peer"
                  />
                  <div className={clsx(
                    'text-center py-2.5 rounded-xl border-2 text-xs font-bold transition-all',
                    'peer-checked:scale-105 peer-checked:shadow-md',
                    sev === 'Critical' ? 'peer-checked:bg-red-600 peer-checked:text-white peer-checked:border-red-700 border-red-200 text-red-500' :
                    sev === 'High'     ? 'peer-checked:bg-orange-500 peer-checked:text-white peer-checked:border-orange-600 border-orange-200 text-orange-500' :
                    sev === 'Medium'   ? 'peer-checked:bg-yellow-400 peer-checked:text-slate-900 peer-checked:border-yellow-500 border-yellow-200 text-yellow-600' :
                                         'peer-checked:bg-green-500 peer-checked:text-white peer-checked:border-green-600 border-green-200 text-green-600'
                  )}>
                    {sev}
                  </div>
                </label>
              ))}
            </div>
            {errors.severity && <p className="error-msg mt-1">{errors.severity.message}</p>}
          </div>

          <div>
            <label className="label">Patient *</label>
            <select
              {...register('patientId', { required: 'Patient is required' })}
              className={clsx('input', errors.patientId && 'input-error')}
            >
              <option value="">Select patient</option>
              {patients?.map(p => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} ({p.uhid}) — {p.phone || 'no phone'}
                </option>
              ))}
            </select>
            {errors.patientId && <p className="error-msg">{errors.patientId.message}</p>}
          </div>

          <div>
            <label className="label">Chief Complaint</label>
            <textarea
              {...register('chiefComplaint')}
              rows={3}
              className="input"
              placeholder="Describe the presenting complaint…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Assign Doctor</label>
              <select {...register('assignedDoctorId')} className="input">
                <option value="">Unassigned</option>
                {doctors?.map(d => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.user?.firstName} {d.user?.lastName}
                    {d.specialization ? ` — ${d.specialization}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Arrival Time</label>
              <input
                {...register('arrivalTime')}
                type="datetime-local"
                className="input"
                defaultValue={new Date().toISOString().slice(0, 16)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIntakeModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createCase.isPending} className="btn-danger">
              <AlertTriangle className="w-4 h-4" />
              {createCase.isPending ? 'Registering…' : 'Register Emergency'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
