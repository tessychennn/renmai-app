import type { ChipTone } from '../lib/clients';
import { STATUS_BADGE } from '../lib/statusTone';

// 狀態用固定的顏色；完成與沒有狀態的（只是列入客戶）維持黑白灰
const STYLES: Record<ChipTone, string> = {
  ...STATUS_BADGE,
  outline: 'border-ink/25 bg-white text-ink',
  done: 'border-hairline bg-ground text-ink-2',
};

export default function StatusChip({
  label,
  tone,
  className = '',
}: {
  label: string;
  tone: ChipTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border-[0.5px] px-2.5 py-0.5 text-xs font-medium ${STYLES[tone]} ${className}`}
    >
      {label}
    </span>
  );
}
