import type { ReactNode } from 'react';

/**
 * 排序選擇。手機用一排可以直接點的選項；電腦版（寬的畫面）收成一個小下拉選單，才放得進同一列。
 * extra 是排序旁邊的額外按鈕（例如「依 Deadline 重排」）。
 */
export default function SortControl<T extends string>({
  value,
  options,
  onChange,
  extra,
}: {
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
  extra?: ReactNode;
}) {
  const keys = Object.keys(options) as T[];
  return (
    <div className="flex items-center gap-2 text-sm text-ink-2 md:shrink-0">
      <span className="shrink-0">排序</span>
      <div role="group" aria-label="排序" className="flex overflow-x-auto rounded-full bg-ground p-0.5 [scrollbar-width:none] md:hidden">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className={`rounded-full px-3 py-1 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ${
              value === k ? 'bg-white font-medium text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : ''
            }`}
          >
            {options[k]}
          </button>
        ))}
      </div>
      <select
        aria-label="排序"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="hidden rounded-lg border-[0.5px] border-hairline bg-white px-2 py-1 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink md:block"
      >
        {keys.map((k) => (
          <option key={k} value={k}>
            {options[k]}
          </option>
        ))}
      </select>
      {extra}
    </div>
  );
}
