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
  editItem,
  filterItems,
  newItem,
  patchItem,
  sortItemsStable,
  summarize,
  UNASSIGNED,
  type ProgressFilter,
  type ProgressInput,
  type ProgressPatch,
  type ProgressSort,
} from '../lib/progress';
import { todayStr } from '../lib/tasks';

type View = 'open' | 'done';

const SORT_KEY = 'renmai.progressSort';
const LAST_PROJECT_KEY = 'renmai.progressLastProject';

function loadSort(): ProgressSort {
  try {
    const saved = localStorage.getItem(SORT_KEY);
    if (saved === 'ops' || saved === 'tech' || saved === 'due') return saved;
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
  const { loading, items, options, reload } = useProgressData();
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

  // 登入的人是哪位成員：用成員設定裡的 Email 對照（沒設就不記錄提出者）
  const memberName = useMemo(() => {
    const email = role.email?.toLowerCase();
    if (!email) return undefined;
    return options.members.find((m) => m.email?.toLowerCase() === email)?.name;
  }, [role.email, options.members]);

  // 直接在列上改過的項目，暫時沿用修改前的值排序，列不會立刻跳位置；切換畫面、篩選或排序時清掉
  const [frozen, setFrozen] = useState<Map<string, ProgressItem>>(() => new Map());

  const filtered = useMemo(() => filterItems(items, filter), [items, filter]);
  const open = useMemo(
    () => sortItemsStable(filtered.filter((i) => i.status !== 'done'), sort, frozen),
    [filtered, sort, frozen]
  );
  const done = useMemo(
    () =>
      filtered
        .filter((i) => i.status === 'done')
        .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '') || b.updatedAt.localeCompare(a.updatedAt)),
    [filtered]
  );
  const summary = useMemo(() => summarize(filtered, today), [filtered, today]);

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
    await progressRepo.save(patchItem(item, change));
    reload();
  };

  const save = async (input: ProgressInput, keepAdding: boolean) => {
    if (sheet?.item) {
      await progressRepo.save(editItem(sheet.item, input));
      setSheet(null);
    } else {
      await progressRepo.save(newItem(input, memberName));
      try {
        localStorage.setItem(LAST_PROJECT_KEY, input.projectId);
      } catch {
        // 記不住上次的大項目而已
      }
      setToast(`已加入「${input.name.trim()}」`);
      if (!keepAdding) setSheet(null);
    }
    reload();
  };

  const remove = async () => {
    if (!confirmDelete) return;
    await progressRepo.remove(confirmDelete.id);
    setConfirmDelete(null);
    setSheet(null);
    setToast('已刪除');
    reload();
  };

  const hasFilter = Boolean(filter.ownerId || filter.projectId);
  const emptyFor = (fallback: string) =>
    items.length === 0 ? '還沒有項目。按右下角的 + 新增第一個。' : hasFilter ? '這個篩選條件下沒有項目。' : fallback;

  const tabs: { value: View; label: string; count: number }[] = [
    { value: 'open', label: '進度', count: items.filter((i) => i.status !== 'done').length },
    { value: 'done', label: '完成', count: items.filter((i) => i.status === 'done').length },
  ];

  return (
    <div className="min-h-dvh">
      <header
        className="glass sticky top-0 z-10 border-b-[0.5px] border-hairline"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex items-center justify-between pt-3 pb-2">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              進度
              <SyncDot />
            </h1>
            <HeaderActions taskSettings />
          </div>

          <div role="tablist" aria-label="進度檢視" className="mb-3 flex w-full rounded-full bg-ground p-1 md:w-fit">
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
            options={options}
            filter={filter}
            sort={sort}
            showSort={view === 'open'}
            onChange={changeFilter}
            onSort={changeSort}
          />
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
                進行中 <b className="font-semibold text-ink">{summary.open}</b> 項
                {summary.needsAssessment > 0 && (
                  <>
                    ，待技術評估 <b className="font-semibold text-ink">{summary.needsAssessment}</b> 項
                  </>
                )}
                {summary.urgent > 0 && (
                  <>
                    ，P0 緊急 <b className="font-semibold text-danger">{summary.urgent}</b> 項
                  </>
                )}
                {summary.overdue > 0 && (
                  <>
                    ，逾期 <b className="font-semibold text-danger">{summary.overdue}</b> 項
                  </>
                )}
              </p>
            )}
            <ProgressBoard
              items={open}
              options={options}
              today={today}
              emptyText={emptyFor('目前沒有進行中的項目。')}
              onOpen={(i) => setSheet({ item: i })}
              onPatch={(i, change) => void patch(i, change)}
            />
          </>
        ) : (
          <ProgressBoard
            items={done}
            options={options}
            today={today}
            emptyText={emptyFor('還沒有完成的項目。')}
            onOpen={(i) => setSheet({ item: i })}
            onPatch={(i, change) => void patch(i, change)}
          />
        )}
      </main>

      {view !== 'done' && (
        <button
          type="button"
          aria-label="新增進度項目"
          onClick={() => setSheet({})}
          className="fixed right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}
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
          options={options}
          defaults={{
            projectId: filter.projectId ?? readLastProject(),
            ownerId: filter.ownerId && filter.ownerId !== UNASSIGNED ? filter.ownerId : undefined,
          }}
          onSave={save}
          onDelete={sheet.item ? () => setConfirmDelete(sheet.item!) : undefined}
          onClose={() => setSheet(null)}
        />
      )}

      <ConfirmSheet
        open={confirmDelete !== null}
        title={confirmDelete ? `刪除「${confirmDelete.name}」？` : ''}
        message="刪除後無法復原。"
        actions={[{ label: '刪除', danger: true, onClick: () => void remove() }]}
        onClose={() => setConfirmDelete(null)}
      />

      <Toast message={toast} />
    </div>
  );
}
