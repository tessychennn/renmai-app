import type { ChipTone } from '../lib/prospects';

// 色彩克制：只有需要處理的（需聯繫、卡住）用警示紅，其餘走黑白灰
const STYLES: Record<ChipTone, string> = {
  alert: 'border-danger/40 bg-white text-danger',
  outline: 'border-ink/25 bg-white text-ink',
  strong: 'border-ink bg-ink text-white',
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
