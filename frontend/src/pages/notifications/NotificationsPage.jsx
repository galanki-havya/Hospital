import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCheck, BellOff } from 'lucide-react';
import { notificationApi } from '../../api/index.js';
import { PageHeader, Spinner, EmptyState } from '../../components/ui/LoadingScreen.jsx';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

const typeColors = {
  System: 'bg-slate-100 text-slate-500',
  Appointment: 'bg-blue-100 text-blue-600',
  Billing: 'bg-green-100 text-green-600',
  Lab: 'bg-purple-100 text-purple-600',
  Emergency: 'bg-red-100 text-red-600',
};

const typeIcons = {
  Appointment: '📅',
  Billing: '💳',
  Lab: '🧪',
  Emergency: '🚨',
  System: '🔔',
};

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.list().then(r => r.data.data),
  });

  const markRead = useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: () => qc.invalidateQueries(['notifications']),
  });

  const markAllRead = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => { qc.invalidateQueries(['notifications']); toast.success('All notifications marked as read'); },
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div>
      <PageHeader title="Notifications" subtitle={`${unreadCount} unread`}>
        {unreadCount > 0 && (
          <button onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending} className="btn-secondary">
            <CheckCheck className="w-4 h-4" /> Mark All Read
          </button>
        )}
      </PageHeader>

      <div className="space-y-1">
        {isLoading && (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        )}

        {!isLoading && notifications.length === 0 && (
          <div className="card card-body">
            <EmptyState
              title="No notifications"
              description="You're all caught up!"
              action={<BellOff className="w-8 h-8 text-slate-300 mx-auto" />}
            />
          </div>
        )}

        {notifications.map(n => (
          <div
            key={n.id}
            onClick={() => { if (!n.isRead) markRead.mutate(n.id); }}
            className={clsx(
              'flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer',
              n.isRead
                ? 'bg-white border-slate-100 hover:bg-slate-50'
                : 'bg-blue-50 border-blue-100 hover:bg-blue-100/60'
            )}
          >
            {/* Icon */}
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0', typeColors[n.notificationType] ?? 'bg-slate-100')}>
              {typeIcons[n.notificationType] ?? '🔔'}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <p className={clsx('text-sm font-medium flex-1', n.isRead ? 'text-slate-700' : 'text-slate-900')}>
                  {n.title}
                </p>
                {!n.isRead && (
                  <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-1.5" />
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5 leading-snug">{n.message}</p>
              <p className="text-xs text-slate-400 mt-1">
                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
              </p>
            </div>

            {/* Type badge */}
            <span className={clsx('text-[10px] font-semibold px-2 py-1 rounded-full shrink-0', typeColors[n.notificationType] ?? 'bg-slate-100 text-slate-500')}>
              {n.notificationType}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
