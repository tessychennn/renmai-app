import type { SplitOptions, TaskFilter, TaskSort } from '../../lib/tasks';
import { TASK_SORT_LABEL, UNASSIGNED } from '../../lib/tasks';

const chip =
  'shrink-0 whitespace-nowrap rounded-full border-[0.5px] px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink';

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
}: {
  options: SplitOptions;
  filter: TaskFilter;
  onChange: (patch: Partial<TaskFilter>) => void;
  /** 有給排序才顯示排序列（只有待辦看板需要） */
  sort?: TaskSort;
  onSort?: (sort: TaskSort) => void;
}) {
  const toggleOwner = (id: string) => onChange({ ownerId: filter.ownerId === id ? undefined : id });
  const toggleCategory = (id: string) => onChange({ categoryId: filter.categoryId === id ? undefined : id });

  return (
    <div className="flex flex-col gap-2 pb-3">
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
        <div role="group" aria-label="排序" className="flex items-center gap-2 text-sm text-ink-2">
          <span className="shrink-0">排序</span>
          <div className="flex overflow-x-auto rounded-full bg-ground p-0.5 [scrollbar-width:none]">
            {(Object.keys(TASK_SORT_LABEL) as TaskSort[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={sort === s}
                onClick={() => onSort(s)}
                className={`rounded-full px-3 py-1 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ${
                  sort === s ? 'bg-white font-medium text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : ''
                }`}
              >
                {TASK_SORT_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
