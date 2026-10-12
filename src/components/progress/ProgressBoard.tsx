import type { ProgressItem } from '../../data/types';
import { groupByProject, type ProgressPatch } from '../../lib/progress';
import type { SplitOptions } from '../../lib/tasks';
import { optionDot } from '../tasks/TaskBoard';
import ProgressRow, { ProgressHeader } from './ProgressRow';

/**
 * 依大項目分區塊的進度清單。每個項目一排，營運優先級、技術等級、狀態都能直接下拉修改。
 * 手機一欄；平板兩欄；電腦三欄（和待辦看板一致）。
 */
export default function ProgressBoard({
  items,
  options,
  today,
  emptyText,
  onOpen,
  onPatch,
}: {
  items: ProgressItem[];
  options: SplitOptions;
  today: string;
  emptyText: string;
  onOpen: (item: ProgressItem) => void;
  onPatch: (item: ProgressItem, patch: ProgressPatch) => void;
}) {
  const groups = groupByProject(items, options.projects);
  if (groups.length === 0) {
    return <p className="mt-24 text-center text-ink-2">{emptyText}</p>;
  }
  return (
    <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <section
          key={g.project?.id ?? 'orphan'}
          aria-label={g.project?.name ?? '大項目已刪除'}
          className="@container overflow-hidden rounded-2xl border-[0.5px] border-hairline bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        >
          <h2 className="flex items-center gap-2 border-b-[0.5px] border-hairline bg-ground/60 px-3 py-2 text-sm font-semibold">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: g.project ? optionDot(options.projects, g.project.id) : '#B5B0A8' }}
            />
            {g.project?.name ?? '（大項目已刪除）'}
            <span className="font-normal text-ink-2">{g.items.length}</span>
          </h2>
          <ProgressHeader />
          <ul>
            {g.items.map((i) => (
              <ProgressRow key={i.id} item={i} options={options} today={today} onOpen={onOpen} onPatch={onPatch} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
