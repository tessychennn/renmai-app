import { useEffect, useMemo, useState } from 'react';
import ConfirmSheet from '../components/ConfirmSheet';
import HeaderActions from '../components/HeaderActions';
import SyncDot from '../components/SyncDot';
import TabBar from '../components/TabBar';
import CalendarView from '../components/tasks/CalendarView';
import TaskBoard from '../components/tasks/TaskBoard';
import TaskFilters from '../components/tasks/TaskFilters';
import TaskSheet from '../components/tasks/TaskSheet';
import Toast from '../components/Toast';
import { taskRepo } from '../data';
import type { Task } from '../data/types';
import { useRole } from '../hooks/useRole';
import { useTaskData } from '../hooks/useTaskData';
import {
  completeTask,
  dueState,
  editTask,
  filterTasks,
  newTask,
  restoreTask,
  sortBoard,
  sortDone,
  todayStr,
  UNASSIGNED,
  type TaskFilter,
  type TaskInput,
} from '../lib/tasks';

type View = 'board' | 'done' | 'calendar';

const VIEW_KEY = 'renmai.taskView';
const LAST_CATEGORY_KEY = 'renmai.taskLastCategory';

function loadView(): View {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === 'board' || saved === 'done' || saved === 'calendar') return saved;
  } catch {
    // 拿不到就用預設
  }
  return 'board';
}

function readLastCategory(): string | undefined {
  try {
    return localStorage.getItem(LAST_CATEGORY_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export default function TasksPage() {
  const { loading, tasks, options, reload } = useTaskData();
  const role = useRole();
  const [view, setView] = useState<View>(loadView);
  const [filter, setFilter] = useState<TaskFilter>({});
  const [sheet, setSheet] = useState<{ task?: Task } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const today = todayStr();

  // 登入的人是哪位成員：用成員設定裡的 Email 對照（沒設就不記錄操作者）
  const memberName = useMemo(() => {
    const email = role.email?.toLowerCase();
    if (!email) return undefined;
    return options.members.find((m) => m.email?.toLowerCase() === email)?.name;
  }, [role.email, options.members]);

  const filtered = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);
  const open = useMemo(
    () => sortBoard(filtered.filter((t) => !t.done), options.priorities),
    [filtered, options.priorities]
  );
  const done = useMemo(() => sortDone(filtered.filter((t) => t.done)), [filtered]);

  const overdue = open.filter((t) => dueState(t.dueDate, today) === 'overdue').length;
  const dueToday = open.filter((t) => t.dueDate === today).length;
  const blocked = options.statuses.find((s) => s.name === '卡住');
  const blockedCount = blocked ? open.filter((t) => t.statusId === blocked.id).length : 0;

  const changeView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // 存不了只在這次生效
    }
  };

  const toggle = async (task: Task) => {
    await taskRepo.save(task.done ? restoreTask(task) : completeTask(task, memberName));
    reload();
  };

  const save = async (input: TaskInput, keepAdding: boolean) => {
    if (sheet?.task) {
      await taskRepo.save(editTask(sheet.task, input));
      setSheet(null);
    } else {
      await taskRepo.save(newTask(input, memberName));
      try {
        localStorage.setItem(LAST_CATEGORY_KEY, input.categoryId);
      } catch {
        // 記不住上次的分類而已
      }
      setToast(`已加入「${input.name.trim()}」`);
      if (!keepAdding) setSheet(null);
    }
    reload();
  };

  const remove = async () => {
    if (!confirmDelete) return;
    await taskRepo.remove(confirmDelete.id);
    setConfirmDelete(null);
    setSheet(null);
    setToast('已刪除');
    reload();
  };

  const hasFilter = Boolean(filter.ownerId || filter.categoryId);
  const noTasksText = tasks.length === 0 ? '還沒有待辦。按右下角的 + 新增第一個。' : '';
  const emptyFor = (fallback: string) => noTasksText || (hasFilter ? '這個篩選條件下沒有項目。' : fallback);

  const tabs: { value: View; label: string; count?: number }[] = [
    { value: 'board', label: '待辦', count: tasks.filter((t) => !t.done).length },
    { value: 'done', label: '完成', count: tasks.filter((t) => t.done).length },
    { value: 'calendar', label: '日曆' },
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
              待辦
              <SyncDot />
            </h1>
            <HeaderActions taskSettings />
          </div>

          <div role="tablist" aria-label="待辦檢視" className="mb-3 flex w-full rounded-full bg-ground p-1 md:w-fit">
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
                {t.count !== undefined && <span className="ml-1 font-normal text-ink-2">{t.count}</span>}
              </button>
            ))}
          </div>

          <TaskFilters
            options={options}
            filter={filter}
            onChange={(patch) => setFilter((f) => ({ ...f, ...patch }))}
          />
        </div>
      </header>

      <main
        className="mx-auto max-w-6xl px-5 pt-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 144px)' }}
      >
        {loading ? null : view === 'board' ? (
          <>
            {open.length > 0 && (
              <p className="mb-3 text-sm text-ink-2">
                未完成 <b className="font-semibold text-ink">{open.length}</b> 項
                {overdue > 0 && (
                  <>
                    ，逾期 <b className="font-semibold text-danger">{overdue}</b> 項
                  </>
                )}
                {dueToday > 0 && (
                  <>
                    ，今天到期 <b className="font-semibold text-ink">{dueToday}</b> 項
                  </>
                )}
                {blockedCount > 0 && (
                  <>
                    ，卡住 <b className="font-semibold text-danger">{blockedCount}</b> 項
                  </>
                )}
              </p>
            )}
            <TaskBoard
              tasks={open}
              options={options}
              today={today}
              emptyText={emptyFor('目前沒有待辦事項。')}
              onToggle={(t) => void toggle(t)}
              onOpen={(t) => setSheet({ task: t })}
            />
          </>
        ) : view === 'done' ? (
          <TaskBoard
            tasks={done}
            options={options}
            today={today}
            emptyText={emptyFor('還沒有完成的項目。')}
            onToggle={(t) => void toggle(t)}
            onOpen={(t) => setSheet({ task: t })}
          />
        ) : (
          <CalendarView
            tasks={filtered}
            options={options}
            today={today}
            onToggle={(t) => void toggle(t)}
            onOpen={(t) => setSheet({ task: t })}
          />
        )}
      </main>

      {view !== 'done' && (
        <button
          type="button"
          aria-label="新增待辦"
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
        <TaskSheet
          key={sheet.task?.id ?? 'new'}
          task={sheet.task}
          options={options}
          defaults={{
            categoryId: filter.categoryId ?? readLastCategory(),
            ownerId: filter.ownerId && filter.ownerId !== UNASSIGNED ? filter.ownerId : undefined,
          }}
          onSave={save}
          onDelete={sheet.task ? () => setConfirmDelete(sheet.task!) : undefined}
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
