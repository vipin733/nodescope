import { format, formatDistanceToNow } from 'date-fns';

export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return format(d, 'HH:mm:ss');
  } catch (e) {
    return dateStr;
  }
}

export function formatTimeAgo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return formatDistanceToNow(d, { addSuffix: true });
  } catch (e) {
    return dateStr;
  }
}

export function formatDuration(ms?: number): string {
  if (ms === undefined) return '';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return Math.round(ms) + 'ms';
  return (ms / 1000).toFixed(2) + 's';
}

export function getStatusColor(status?: number): string {
  if (!status) return 'text-slate-400';
  if (status >= 500) return 'text-red-400';
  if (status >= 400) return 'text-amber-400';
  if (status >= 200 && status < 300) return 'text-green-400';
  return 'text-blue-400';
}
