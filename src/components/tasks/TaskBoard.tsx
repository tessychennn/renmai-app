import type { Task } from '../../data/types';
import { groupByCategory, type SplitOptions } from '../../lib/tasks';
import TaskRow from './TaskRow';

// 分類的小圓點顏色：低飽和，沿用原本試算表分頁的色調。依分類在清單中的位置固定配色。
const DOTS = ['#8FA3B5', '#9DB09A', '#C9A98C', '#B7A9BD', '#7FA5A1', '#B5B0A8', '#C79A94', '#A3A57F'];

export function categoryDot(options: SplitOptions, categoryId: string): string {
  const i = options.categories.findIndex((c) => c.id === categoryId);
  return i < 0 ? '#B5B0A8' : DOTS[i % DOTS.length];
}

/**
 * 依分類分區塊的看板（待辦與完成區共用）。
 * 手機一欄；平板兩欄；電腦三欄，和原本試算表「每排 3 個分類」一致。
 */
export default function TaskBoard({
  tasks,
  options,
  today,
  emptyText,
  onToggle,
  onOpen,
}: {
  tasks: Task[];
  options: SplitOptions;
  today: string;
  emptyText: string;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}) {
  const groups = groupByCategory(tasks, options.categories);
  if (groups.length === 0) {
    return <p className="mt-24 text-center text-ink-2">{emptyText}</p>;
  }
  return (
    <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <section
          key={g.category?.id ?? 'orphan'}
          aria-label={g.category?.name ?? '分類已刪除'}
          className="overflow-hidden rounded-2xl border-[0.5px] border-hairline bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        >
          <h2 className="flex items-center gap-2 border-b-[0.5px] border-hairline bg-ground/60 px-3 py-2 text-sm font-semibold">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: g.category ? categoryDot(options, g.category.id) : '#B5B0A8' }}
            />
            {g.category?.name ?? '（分類已刪除）'}
            <span className="font-normal text-ink-2">{g.tasks.length}</span>
          </h2>
          <ul>
            {g.tasks.map((t) => (
              <TaskRow key={t.id} task={t} options={options} today={today} onToggle={onToggle} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
