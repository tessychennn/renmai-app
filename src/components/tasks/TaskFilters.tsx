import type { SplitOptions, TaskFilter, TaskSort } from '../../lib/tasks';
import { TASK_SORT_LABEL, UNASSIGNED } from '../../lib/tasks';
import SortControl from '../SortControl';

const chip =
  'shrink-0 whitespace-nowrap rounded-full border-[0.5px] px-3 py-1.5 text-sm md:px-2.5 md:py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${chip} ${active ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-ink'}`}
    >
      {children}
    </button>
  );
}

/**
 * 負責人與分類篩選。待辦、完成、日曆三個畫面共用同一組條件。
 * onChange 只回報被改的那一項（patch），由呼叫端用「前一個狀態」合併，避免連續操作時蓋掉彼此。
 */
export default function TaskFilters({
  options,
  filter,
  onChange,
  sort,
  onSort,
  onResetOrder,
}: {
  options: SplitOptions;
  filter: TaskFilter;
  onChange: (patch: Partial<TaskFilter>) => void;
  /** 有給排序才顯示排序列（只有待辦看板需要） */
  sort?: TaskSort;
  onSort?: (sort: TaskSort) => void;
  /** 手動排序時顯示「依 Deadline 重排」 */
  onResetOrder?: () => void;
}) {
  const toggleOwner = (id: string) => onChange({ ownerId: filter.ownerId === id ? undefined : id });
  const toggleCategory = (id: string) => onChange({ categoryId: filter.categoryId === id ? undefined : id });

  return (
    <div className="flex flex-col gap-2 pb-3 md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:gap-y-2 md:pb-0">
      <div role="group" aria-label="依負責人篩選" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        <Chip active={!filter.ownerId} onClick={() => onChange({ ownerId: undefined })}>
          所有負責人
        </Chip>
        {options.members.map((m) => (
          <Chip key={m.id} active={filter.ownerId === m.id} onClick={() => toggleOwner(m.id)}>
            {m.name}
          </Chip>
        ))}
        <Chip active={filter.ownerId === UNASSIGNED} onClick={() => toggleOwner(UNASSIGNED)}>
          未指派
        </Chip>
      </div>
      <div role="group" aria-label="依分類篩選" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        <Chip active={!filter.categoryId} onClick={() => onChange({ categoryId: undefined })}>
          所有分類
        </Chip>
        {options.categories.map((c) => (
          <Chip key={c.id} active={filter.categoryId === c.id} onClick={() => toggleCategory(c.id)}>
            {c.name}
          </Chip>
        ))}
      </div>
      {sort && onSort && (
        <SortControl
          value={sort}
          options={TASK_SORT_LABEL}
          onChange={onSort}
          extra={
            sort === 'manual' && onResetOrder ? (
              <button
                type="button"
                onClick={onResetOrder}
                className="shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-ink-2 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
              >
                依 Deadline 重排
              </button>
            ) : null
          }
        />
      )}
    </div>
  );
}
