import { Loader2, AlertCircle, Inbox } from 'lucide-react';
import clsx from 'clsx';

export function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        </div>
        <p className="text-sm text-slate-500">Loading MediCore…</p>
      </div>
    </div>
  );
}

export default LoadingScreen;

export function Spinner({ size = 'sm', className }) {
  const sizes = { xs: 'w-3 h-3', sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return <Loader2 className={clsx('animate-spin text-primary-600', sizes[size], className)} />;
}

export function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <AlertCircle className="w-10 h-10 text-red-400" />
      <p className="text-slate-600 text-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary btn-sm">
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = 'No records found', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <Inbox className="w-10 h-10 text-slate-300" />
      <p className="font-medium text-slate-600">{title}</p>
      {description && <p className="text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative bg-white rounded-2xl shadow-2xl w-full', sizes[size])}>
        {title && (
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors text-lg leading-none">
              ×
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-end pt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="btn-secondary btn-sm disabled:opacity-40"
      >
        ‹ Prev
      </button>
      <span className="text-sm text-slate-500">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="btn-secondary btn-sm disabled:opacity-40"
      >
        Next ›
      </button>
    </div>
  );
}

const statusMap = {
  // appointment/visit statuses
  Scheduled: 'badge-blue',
  CheckedIn: 'badge-purple',
  Completed: 'badge-green',
  Cancelled: 'badge-red',
  NoShow: 'badge-gray',
  InProgress: 'badge-yellow',
  // admission
  Admitted: 'badge-blue',
  Discharged: 'badge-green',
  // bills
  Draft: 'badge-gray',
  PartiallyPaid: 'badge-yellow',
  Paid: 'badge-green',
  // lab/radiology
  Ordered: 'badge-blue',
  Collected: 'badge-purple',
  Processing: 'badge-yellow',
  Pending: 'badge-yellow',
  Verified: 'badge-green',
  Final: 'badge-green',
  // beds
  Available: 'badge-green',
  Occupied: 'badge-red',
  Reserved: 'badge-yellow',
  Maintenance: 'badge-gray',
  // employees / generic
  Active: 'badge-green',
  Inactive: 'badge-gray',
  Resigned: 'badge-red',
  // leave
  Approved: 'badge-green',
  Rejected: 'badge-red',
  // pharmacy
  'Low Stock': 'badge-red',
  // priority
  Routine: 'badge-gray',
  Urgent: 'badge-yellow',
  STAT: 'badge-red',
};

export function StatusBadge({ status }) {
  const cls = statusMap[status] ?? 'badge-gray';
  return <span className={cls}>{status}</span>;
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, color = 'blue', delta, suffix = '' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    teal: 'bg-teal-50 text-teal-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={clsx('p-2.5 rounded-xl', colors[color])}>
        {Icon && <Icon className="w-5 h-5" />}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">
          {value}{suffix}
        </p>
        {delta !== undefined && (
          <p className={clsx('text-xs mt-0.5', delta >= 0 ? 'text-green-600' : 'text-red-500')}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} this month
          </p>
        )}
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">🔍</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-8 w-64"
      />
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = true }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <p className="text-sm text-slate-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
        <button onClick={onConfirm} className={danger ? 'btn-danger' : 'btn-primary'}>Confirm</button>
      </div>
    </Modal>
  );
}
