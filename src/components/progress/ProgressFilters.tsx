import { SORT_LABEL, UNASSIGNED, type ProgressFilter, type ProgressSort } from '../../lib/progress';
import type { SplitOptions } from '../../lib/tasks';

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
 * 大項目與負責人篩選，加上排序。onChange 只回報被改的那一項（patch），
 * 由呼叫端用「前一個狀態」合併，避免連續操作時蓋掉彼此。
 */
export default function ProgressFilters({
  options,
  filter,
  sort,
  showSort,
  onChange,
  onSort,
}: {
  options: SplitOptions;
  filter: ProgressFilter;
  sort: ProgressSort;
  showSort: boolean;
  onChange: (patch: Partial<ProgressFilter>) => void;
  onSort: (sort: ProgressSort) => void;
}) {
  const toggleOwner = (id: string) => onChange({ ownerId: filter.ownerId === id ? undefined : id });
  const toggleProject = (id: string) => onChange({ projectId: filter.projectId === id ? undefined : id });

  return (
    <div className="flex flex-col gap-2 pb-3">
      <div role="group" aria-label="依大項目篩選" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        <Chip active={!filter.projectId} onClick={() => onChange({ projectId: undefined })}>
          所有大項目
        </Chip>
        {options.projects.map((p) => (
          <Chip key={p.id} active={filter.projectId === p.id} onClick={() => toggleProject(p.id)}>
            {p.name}
          </Chip>
        ))}
      </div>
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
      {showSort && (
        <div role="group" aria-label="排序" className="flex items-center gap-2 text-sm text-ink-2">
          <span className="shrink-0">排序</span>
          <div className="flex rounded-full bg-ground p-0.5">
            {(Object.keys(SORT_LABEL) as ProgressSort[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={sort === s}
                onClick={() => onSort(s)}
                className={`rounded-full px-3 py-1 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ${
                  sort === s ? 'bg-white font-medium text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : ''
                }`}
              >
                {SORT_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
