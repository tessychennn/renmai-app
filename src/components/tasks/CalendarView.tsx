import { useMemo, useState } from 'react';
import type { Task } from '../../data/types';
import { monthGrid, shiftMonth, tasksByDate, type SplitOptions } from '../../lib/tasks';
import TaskRow from './TaskRow';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function taskTone(t: Task, today: string): string {
  if (t.done) return 'text-ink-2 line-through';
  if (t.dueDate && t.dueDate < today) return 'text-danger';
  return 'text-ink';
}

function dotColor(t: Task, today: string): string {
  if (t.done) return 'bg-ink-2/30';
  if (t.dueDate && t.dueDate < today) return 'bg-danger';
  if (t.dueDate === today) return 'bg-amber-600';
  return 'bg-ink-2';
}

/**
 * 月曆：依 Deadline 顯示任務（已完成的用淡色刪除線）。
 * 手機格子只顯示小圓點，點日期在下方看當天清單；電腦格子直接顯示任務名稱。
 */
export default function CalendarView({
  tasks,
  options,
  today,
  onToggle,
  onOpen,
}: {
  tasks: Task[];
  options: SplitOptions;
  today: string;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}) {
  const [view, setView] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }));
  const [selected, setSelected] = useState(today);

  const weeks = useMemo(() => monthGrid(view.year, view.month), [view]);
  const byDate = useMemo(() => tasksByDate(tasks), [tasks]);

  const goTo = (year: number, month: number, date?: string) => {
    setView({ year, month });
    const pad = (n: number) => String(n).padStart(2, '0');
    const inThisMonth = today.startsWith(`${year}-${pad(month)}`);
    setSelected(date ?? (inThisMonth ? today : `${year}-${pad(month)}-01`));
  };
  const shift = (delta: number) => {
    const next = shiftMonth(view.year, view.month, delta);
    goTo(next.year, next.month);
  };
  const select = (date: string) => {
    const month = Number(date.slice(5, 7));
    if (month !== view.month) goTo(Number(date.slice(0, 4)), month, date);
    else setSelected(date);
  };

  const dayTasks = [...(byDate.get(selected) ?? [])].sort((a, b) => Number(a.done) - Number(b.done));
  const [, sm, sd] = selected.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(`${selected}T00:00:00`).getDay()];

  const navButton =
    'flex h-9 w-9 items-center justify-center rounded-full border-[0.5px] border-hairline bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink';

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={() => shift(-1)} aria-label="上個月" className={navButton}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m10 3-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="min-w-[8rem] text-center text-lg font-semibold">
          {view.year} 年 {view.month} 月
        </h2>
        <button type="button" onClick={() => shift(1)} aria-label="下個月" className={navButton}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => goTo(Number(today.slice(0, 4)), Number(today.slice(5, 7)), today)}
          className="ml-auto rounded-full border-[0.5px] border-hairline bg-white px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
        >
          今天
        </button>
      </div>

      <div
        role="grid"
        aria-label={`${view.year} 年 ${view.month} 月`}
        className="overflow-hidden rounded-2xl border-[0.5px] border-hairline bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      >
        <div role="row" className="grid grid-cols-7 border-b-[0.5px] border-hairline bg-ground/60 text-center text-xs text-ink-2">
          {WEEKDAYS.map((w) => (
            <div key={w} role="columnheader" className="py-1.5">
              {w}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} role="row" className="grid grid-cols-7">
            {week.map((day) => {
              const list = byDate.get(day.date) ?? [];
              const isToday = day.date === today;
              const isSelected = day.date === selected;
              return (
                <button
                  key={day.date}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={`${Number(day.date.slice(5, 7))}月${Number(day.date.slice(8))}日，${list.length} 項`}
                  onClick={() => select(day.date)}
                  className={`min-h-14 border-r-[0.5px] border-t-[0.5px] border-hairline p-1 text-left align-top last:border-r-0 md:min-h-24 ${
                    day.inMonth ? 'bg-white' : 'bg-ground/60 text-ink-2/60'
                  } ${isSelected ? 'relative z-[1] outline outline-2 -outline-offset-2 outline-ink' : ''} focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                      isToday ? 'bg-ink font-semibold text-white' : ''
                    }`}
                  >
                    {Number(day.date.slice(8))}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-0.5 md:hidden">
                    {list.slice(0, 4).map((t) => (
                      <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${dotColor(t, today)}`} />
                    ))}
                  </span>
                  <span className="mt-1 hidden space-y-0.5 md:block">
                    {list.slice(0, 3).map((t) => (
                      <span key={t.id} className={`block truncate rounded bg-ground px-1 text-xs ${taskTone(t, today)}`}>
                        {t.done ? '✓ ' : ''}
                        {t.name}
                      </span>
                    ))}
                    {list.length > 3 && <span className="block px-1 text-xs text-ink-2">還有 {list.length - 3} 項</span>}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <section aria-label="選取日期的項目" className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-ink-2">
          {sm} 月 {sd} 日 週{weekday}
        </h3>
        {dayTasks.length === 0 ? (
          <p className="rounded-2xl border-[0.5px] border-hairline bg-white px-4 py-6 text-center text-ink-2">
            這天沒有項目。
          </p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border-[0.5px] border-hairline bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            {dayTasks.map((t) => (
              <TaskRow key={t.id} task={t} options={options} today={today} onToggle={onToggle} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
