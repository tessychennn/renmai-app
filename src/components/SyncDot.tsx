import { cloudEnabled } from '../cloud/config';
import { useSyncState } from '../sync/useSyncState';

const LABELS = {
  idle: '已同步',
  syncing: '同步中',
  offline: '沒有網路，恢復後會自動同步',
  error: '同步發生問題',
  'auth-required': '需要重新登入',
} as const;

/** 首頁右上角的小圓點：一眼看出雲端同步狀態。沒啟用雲端時不顯示。 */
export default function SyncDot() {
  const { status } = useSyncState();
  if (!cloudEnabled) return null;
  const style =
    status === 'error' || status === 'auth-required'
      ? 'bg-danger'
      : status === 'offline'
        ? 'border border-ink-2 bg-transparent'
        : status === 'syncing'
          ? 'animate-pulse bg-ink'
          : 'bg-ink/40';
  return (
    <span
      role="img"
      aria-label={`雲端同步：${LABELS[status]}`}
      className={`inline-block h-2 w-2 rounded-full ${style}`}
    />
  );
}
