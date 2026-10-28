import { useEffect, useMemo, useState } from 'react';
import ConfirmSheet from '../components/ConfirmSheet';
import HeaderActions from '../components/HeaderActions';
import ProgressBoard from '../components/progress/ProgressBoard';
import ProgressFilters from '../components/progress/ProgressFilters';
import ProgressSheet from '../components/progress/ProgressSheet';
import SyncDot from '../components/SyncDot';
import TabBar from '../components/TabBar';
import Toast from '../components/Toast';
import { progressRepo } from '../data';
import type { ProgressItem } from '../data/types';
import { useProgressData } from '../hooks/useProgressData';
import { useRole } from '../hooks/useRole';
import {
  completeItem,
  doneStatusIds,
  editItem,
  filterItems,
  moveItem,
  newItem,
  nextSortOrder,
  patchItem,
  reopenItem,
  sortItemsStable,
  summarize,
  type ProgressFilter,
  type ProgressInput,
  type ProgressPatch,
  type ProgressSort,
} from '../lib/progress';
import { todayStr } from '../lib/tasks';
import { PROGRESS_TEXT as T } from '../text/productProgress';

type View = 'open' | 'done';

const SORT_KEY = 'renmai.progressSort';
const LAST_PROJECT_KEY = 'renmai.progressLastProject';

function loadSort(): ProgressSort {
  try {
    const saved = localStorage.getItem(SORT_KEY);
    if (saved === 'ops' || saved === 'tech' || saved === 'due' || saved === 'manual') return saved;
  } catch {
    // 拿不到就用預設
  }
  return 'ops';
}

function readLastProject(): string | undefined {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export default function ProgressPage() {
  const { loading, items, options: opts, reload } = useProgressData();
  const role = useRole();
  const [view, setView] = useState<View>('open');
  const [sort, setSort] = useState<ProgressSort>(loadSort);
  const [filter, setFilter] = useState<ProgressFilter>({});
  const [sheet, setSheet] = useState<{ item?: ProgressItem } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProgressItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const today = todayStr();

  // 直接在列上改過的項目，暫時沿用修改前的值排序，列不會立刻跳位置；切換畫面、篩選或排序時清掉
  const [frozen, setFrozen] = useState<Map<string, ProgressItem>>(() => new Map());

  const filtered = useMemo(() => filterItems(items, filter), [items, filter]);
  const doneIds = useMemo(() => doneStatusIds(opts), [opts]);
  const open = useMemo(
    () => sortItemsStable(filtered.filter((i) => !doneIds.has(i.status)), sort, opts, frozen),
    [filtered, doneIds, sort, opts, frozen]
  );
  const done = useMemo(
    () =>
      filtered
        .filter((i) => doneIds.has(i.status))
        .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '') || b.updatedAt.localeCompare(a.updatedAt)),
    [filtered, doneIds]
  );
  const summary = useMemo(() => summarize(filtered, opts, today), [filtered, opts, today]);

  const changeFilter = (patch: Partial<ProgressFilter>) => {
    setFilter((f) => ({ ...f, ...patch }));
    setFrozen(new Map());
  };

  const changeSort = (next: ProgressSort) => {
    setFrozen(new Map());
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // 存不了只在這次生效
    }
  };

  const changeView = (next: View) => {
    setFrozen(new Map());
    setView(next);
  };

  const patch = async (item: ProgressItem, change: ProgressPatch) => {
    setFrozen((prev) => (prev.has(item.id) ? prev : new Map(prev).set(item.id, item)));
    await progressRepo.save(patchItem(item, change, opts));
    reload();
  };

  const toggle = async (item: ProgressItem) => {
    const next = doneIds.has(item.status) ? reopenItem(item, opts) : completeItem(item, opts);
    if (next) await progressRepo.save(next);
    reload();
  };

  /** 拖曳調整順序：之後自動切到「手動排序」，才看得到自己排的順序 */
  const reorder = async (displayed: ProgressItem[], activeId: string, overId: string) => {
    const changed = moveItem(displayed, activeId, overId);
    if (changed.length === 0) return;
    await progressRepo.saveMany(changed);
    setFrozen(new Map());
    setSort('manual');
    try {
      localStorage.setItem(SORT_KEY, 'manual');
    } catch {
      // 存不了只在這次生效
    }
    reload();
  };

  const save = async (input: ProgressInput, keepAdding: boolean) => {
    if (sheet?.item) {
      await progressRepo.save(editItem(sheet.item, input, opts));
      setSheet(null);
    } else {
      // 新增的放在同一個大項目的最後面（手動排序時就在最下面）
      const created = newItem(input, role.email, opts);
      await progressRepo.save({ ...created, sortOrder: nextSortOrder(items, input.projectId) });
      try {
        localStorage.setItem(LAST_PROJECT_KEY, input.projectId);
      } catch {
        // 記不住上次的大項目而已
      }
      setToast(T.toastAdded(input.name.trim()));
      if (!keepAdding) setSheet(null);
    }
    reload();
  };

  const remove = async () => {
    if (!confirmDelete) return;
    await progressRepo.remove(confirmDelete.id);
    setConfirmDelete(null);
    setSheet(null);
    setToast(T.toastDeleted);
    reload();
  };

  const emptyFor = (fallback: string) =>
    items.length === 0 ? T.emptyNone : filter.projectId ? T.emptyFiltered : fallback;

  const tabs: { value: View; label: string; count: number }[] = [
    { value: 'open', label: T.viewOpen, count: items.filter((i) => !doneIds.has(i.status)).length },
    { value: 'done', label: T.viewDone, count: items.filter((i) => doneIds.has(i.status)).length },
  ];

  return (
    <div className="min-h-dvh">
      <header
        className="glass sticky top-0 z-10 border-b-[0.5px] border-hairline"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex items-center justify-between pt-3 pb-2 md:pt-2 md:pb-1.5">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              {T.pageTitle}
              <SyncDot />
            </h1>
            <HeaderActions progressSettings />
          </div>

          {/* 電腦版（寬的畫面）：進行中／完成、大項目篩選、排序放在同一列，上方佔的高度少一點 */}
          <div className="md:flex md:items-center md:gap-4 md:pb-2">
            <div role="tablist" aria-label={T.pageTitle} className="mb-3 flex w-full rounded-full bg-ground p-1 md:mb-0 md:w-fit md:shrink-0">
              {tabs.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={view === t.value}
                  onClick={() => changeView(t.value)}
                  className={`flex-1 rounded-full px-5 py-1.5 text-sm font-medium whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink md:flex-none ${
                    view === t.value ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-ink-2'
                  }`}
                >
                  {t.label}
                  <span className="ml-1 font-normal text-ink-2">{t.count}</span>
                </button>
              ))}
            </div>

            <ProgressFilters
              opts={opts}
              filter={filter}
              sort={sort}
              showSort={view === 'open'}
              onChange={changeFilter}
              onSort={changeSort}
            />
          </div>
        </div>
      </header>

      <main
        className="mx-auto max-w-6xl px-5 pt-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 144px)' }}
      >
        {loading ? null : view === 'open' ? (
          <>
            {open.length > 0 && (
              <p className="mb-3 text-sm text-ink-2">
                {T.summaryOpen} <b className="font-semibold text-ink">{summary.open}</b> {T.summaryUnit}
                {summary.needsAssessment > 0 && (
                  <>
                    ，{T.summaryNeedsAssessment} <b className="font-semibold text-ink">{summary.needsAssessment}</b>{' '}
                    {T.summaryUnit}
                  </>
                )}
                {summary.urgent > 0 && (
                  <>
                    ，{opts.priorities[0]?.name} <b className="font-semibold text-danger">{summary.urgent}</b> {T.summaryUnit}
                  </>
                )}
                {summary.overdue > 0 && (
                  <>
                    ，{T.summaryOverdue} <b className="font-semibold text-danger">{summary.overdue}</b> {T.summaryUnit}
                  </>
                )}
              </p>
            )}
            <ProgressBoard
              items={open}
              opts={opts}
              draggable
              today={today}
              emptyText={emptyFor(T.emptyOpen)}
              onToggle={(i) => void toggle(i)}
              onOpen={(i) => setSheet({ item: i })}
              onPatch={(i, change) => void patch(i, change)}
              onReorder={(group, a, b) => void reorder(group, a, b)}
            />
          </>
        ) : (
          <ProgressBoard
            items={done}
            opts={opts}
            today={today}
            emptyText={emptyFor(T.emptyDone)}
            onToggle={(i) => void toggle(i)}
            onOpen={(i) => setSheet({ item: i })}
            onPatch={(i, change) => void patch(i, change)}
          />
        )}
      </main>

      {view !== 'done' && (
        <button
          type="button"
          aria-label={T.addButtonLabel}
          onClick={() => setSheet({})}
          className="fixed right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          // 只有這一頁可用時沒有分頁列，按鈕貼近底部
          style={{
            bottom:
              role.people || role.todo
                ? 'calc(env(safe-area-inset-bottom) + 76px)'
                : 'calc(env(safe-area-inset-bottom) + 20px)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}

      <TabBar />

      {sheet && (
        <ProgressSheet
          key={sheet.item?.id ?? 'new'}
          item={sheet.item}
          opts={opts}
          defaults={{ projectId: filter.projectId ?? readLastProject() }}
          onSave={save}
          onDelete={sheet.item ? () => setConfirmDelete(sheet.item!) : undefined}
          onClose={() => setSheet(null)}
        />
      )}

      <ConfirmSheet
        open={confirmDelete !== null}
        title={confirmDelete ? T.confirmDeleteTitle(confirmDelete.name) : ''}
        message={T.confirmDeleteMessage}
        actions={[{ label: T.buttonDelete, danger: true, onClick: () => void remove() }]}
        onClose={() => setConfirmDelete(null)}
      />

      <Toast message={toast} />
    </div>
  );
}
