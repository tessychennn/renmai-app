import type { DueState } from '../../lib/tasks';

// 這兩個元件的做法：畫面上看到的是一個小小的標籤（字小、不佔空間），
// 真正的下拉選單／日期選擇器是蓋在上面、看不見的原生控制項。
// 好處：點下去是系統原生的選單（iPhone 是滾輪、電腦是下拉），而且控制項本身維持 16px 字級，
// iPhone 不會因為字太小在聚焦時把整個頁面放大。

const TONES = {
  normal: 'border-hairline bg-white text-ink',
  faint: 'border-dashed border-hairline bg-white text-ink-2',
  danger: 'border-danger/40 bg-white font-semibold text-danger',
} as const;

export type InlineTone = keyof typeof TONES;

export interface InlineOption {
  value: string;
  label: string;
}

export function InlineSelect({
  ariaLabel,
  value,
  options,
  text,
  tone = 'normal',
  onChange,
}: {
  ariaLabel: string;
  value: string;
  options: InlineOption[];
  /** 標籤上顯示的字（通常是目前選項的名稱） */
  text: string;
  tone?: InlineTone;
  onChange: (value: string) => void;
}) {
  return (
    <span
      className={`relative flex h-7 min-w-0 items-center gap-0.5 rounded-lg border-[0.5px] px-1 text-xs @md:px-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-ink ${TONES[tone]}`}
    >
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {/* 窄的時候省掉小箭頭，把空間留給文字；邊框本身就是「可以點」的提示 */}
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true" className="hidden shrink-0 text-ink-2 @md:block">
        <path d="m1.5 3 2.5 2.5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

const DUE_TONES: Record<DueState, string> = {
  overdue: 'border-transparent bg-danger/10 font-semibold text-danger',
  today: 'border-transparent bg-warn-soft text-ink',
  soon: 'border-transparent bg-soon text-ink',
  later: 'border-hairline bg-white text-ink',
  none: 'border-dashed border-hairline bg-white text-ink-2',
};

export function InlineDate({
  ariaLabel,
  value,
  text,
  state,
  onChange,
}: {
  ariaLabel: string;
  /** YYYY-MM-DD，沒有就空字串 */
  value: string;
  text: string;
  state: DueState;
  onChange: (value: string) => void;
}) {
  return (
    <span
      className={`relative flex h-7 min-w-0 items-center justify-center rounded-lg border-[0.5px] px-1 text-xs @md:px-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-ink ${DUE_TONES[state]}`}
    >
      <span className="truncate">{text}</span>
      <input
        type="date"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // 電腦版點到日期欄中間只會選到「月」或「日」，要主動叫出日曆選擇器
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // 瀏覽器不支援或被擋就用原生行為
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}
