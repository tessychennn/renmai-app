import type { CollabStatus } from '../data/types';
import { statusLabel } from '../lib/collab';

// 色彩克制：只有「需聯繫」用警示紅（它就是提醒），其餘走黑白灰
const STYLES: Record<CollabStatus, string> = {
  contact: 'border-danger/40 bg-white text-danger',
  contacting: 'border-ink/25 bg-white text-ink',
  scheduled: 'border-ink bg-ink text-white',
  done: 'border-hairline bg-ground text-ink-2',
};

export default function StatusChip({
  status,
  className = '',
}: {
  status: CollabStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border-[0.5px] px-2.5 py-0.5 text-xs font-medium ${STYLES[status]} ${className}`}
    >
      {statusLabel(status)}
    </span>
  );
}
