import type { Task, TaskOption } from '../data/types';

// ── 日期（一律用 YYYY-MM-DD 字串，不受時區影響） ──

export function toDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayStr = (now = new Date()): string => toDateStr(now);

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later' | 'none';

/** 3 天內（含）算「快到期」 */
export const SOON_DAYS = 3;

export function dueState(dueDate: string | undefined, today: string): DueState {
  if (!dueDate) return 'none';
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  if (dueDate <= addDays(today, SOON_DAYS)) return 'soon';
  return 'later';
}

/** 列表上的 Deadline 顯示：今天、明天，其他是月/日（跨年才加年份） */
export function dueLabel(dueDate: string, today: string): string {
  if (dueDate === today) return '今天';
  if (dueDate === addDays(today, 1)) return '明天';
  const [y, m, d] = dueDate.split('-').map(Number);
  return y === Number(today.slice(0, 4)) ? `${m}/${d}` : `${y}/${m}/${d}`;
}

// ── 選項 ──

export interface SplitOptions {
  categories: TaskOption[];
  members: TaskOption[];
  priorities: TaskOption[];
  statuses: TaskOption[];
}

export function splitOptions(options: TaskOption[]): SplitOptions {
  const sorted = (kind: TaskOption['kind']) =>
    options.filter((o) => o.kind === kind && !o.deletedAt).sort((a, b) => a.order - b.order);
  return {
    categories: sorted('category'),
    members: sorted('member'),
    priorities: sorted('priority'),
    statuses: sorted('status'),
  };
}

export const optionName = (
  list: { id: string; name: string }[],
  id: string | undefined
): string | undefined =>
  id ? list.find((o) => o.id === id)?.name : undefined;

export type PriorityTone = 'high' | 'low' | 'normal';

/** 清單的第一個＝最高優先，最後一個＝最低優先（超過兩個選項時才有「最低」） */
export function priorityTone(priorities: TaskOption[], id: string | undefined): PriorityTone {
  if (!id || priorities.length === 0) return 'normal';
  if (priorities[0].id === id) return 'high';
  if (priorities.length > 2 && priorities[priorities.length - 1].id === id) return 'low';
  return 'normal';
}

/** 名稱叫「卡住」的狀態會特別標紅（沿用原本試算表的規則） */
export const BLOCKED_STATUS_NAME = '卡住';

/** 有多少未刪除的任務在使用這個選項（刪除前檢查用） */
export function optionUsage(tasks: Task[], option: TaskOption): number {
  const field = {
    category: 'categoryId',
    member: 'ownerId',
    priority: 'priorityId',
    status: 'statusId',
  }[option.kind] as 'categoryId' | 'ownerId' | 'priorityId' | 'statusId';
  return tasks.filter((t) => !t.deletedAt && t[field] === option.id).length;
}

// ── 排序、篩選、分組 ──

const NO_DATE = '9999-99-99';

/** 待辦排序：Deadline 近的在前（沒有的最後），再依優先級，再依建立時間 */
export function sortBoard(tasks: Task[], priorities: TaskOption[]): Task[] {
  const priIndex = (t: Task) => {
    const i = priorities.findIndex((p) => p.id === t.priorityId);
    return i < 0 ? 99 : i;
  };
  return [...tasks].sort(
    (a, b) =>
      (a.dueDate ?? NO_DATE).localeCompare(b.dueDate ?? NO_DATE) ||
      priIndex(a) - priIndex(b) ||
      a.createdAt.localeCompare(b.createdAt)
  );
}

/**
 * 待辦排序，但被「直接在列上修改」的任務暫時沿用修改前的值來排。
 * 這樣改了 Deadline 後那一列不會立刻跳到別的位置（連續編輯時畫面不亂跳）；
 * 切換畫面或篩選時清掉 frozen，才會依新的值重新排序。
 */
export function sortBoardStable(
  tasks: Task[],
  priorities: TaskOption[],
  frozen: ReadonlyMap<string, Task>
): Task[] {
  const current = new Map(tasks.map((t) => [t.id, t]));
  return sortBoard(
    tasks.map((t) => frozen.get(t.id) ?? t),
    priorities
  ).map((t) => current.get(t.id)!);
}

/** 完成區排序：最近完成的在前 */
export function sortDone(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      (b.doneAt ?? '').localeCompare(a.doneAt ?? '') || b.updatedAt.localeCompare(a.updatedAt)
  );
}

export interface TaskFilter {
  /** 負責人的選項編號；'unassigned' = 未指派 */
  ownerId?: string;
  categoryId?: string;
}

export const UNASSIGNED = 'unassigned';

export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  return tasks.filter((t) => {
    if (filter.categoryId && t.categoryId !== filter.categoryId) return false;
    if (filter.ownerId === UNASSIGNED && t.ownerId) return false;
    if (filter.ownerId && filter.ownerId !== UNASSIGNED && t.ownerId !== filter.ownerId) return false;
    return true;
  });
}

export interface CategoryGroup {
  /** null = 任務的分類已被刪除（找不到對應選項） */
  category: TaskOption | null;
  tasks: Task[];
}

/** 依分類清單的順序分組，空的分類不列出；找不到分類的任務歸在最後一組 */
export function groupByCategory(tasks: Task[], categories: TaskOption[]): CategoryGroup[] {
  const groups: CategoryGroup[] = categories
    .map((category) => ({ category, tasks: tasks.filter((t) => t.categoryId === category.id) }))
    .filter((g) => g.tasks.length > 0);
  const known = new Set(categories.map((c) => c.id));
  const orphans = tasks.filter((t) => !known.has(t.categoryId));
  if (orphans.length > 0) groups.push({ category: null, tasks: orphans });
  return groups;
}

// ── 日曆 ──

export interface CalendarDay {
  date: string;
  inMonth: boolean;
}

/** 一個月的日曆格（週日開頭，和原本試算表一致）；只回傳含有當月日期的週（4 到 6 週） */
export function monthGrid(year: number, month: number): CalendarDay[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = addDays(first.toISOString().slice(0, 10), -first.getUTCDay());
  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      row.push({ date, inMonth: Number(date.slice(5, 7)) === month });
    }
    if (!row.some((c) => c.inMonth)) break;
    weeks.push(row);
  }
  return weeks;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** 依 Deadline 把任務放進日期（已完成的也算，日曆上會用淡色＋✓ 顯示） */
export function tasksByDate(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    map.set(t.dueDate, [...(map.get(t.dueDate) ?? []), t]);
  }
  return map;
}

// ── 建立與修改任務 ──

export interface TaskInput {
  name: string;
  categoryId: string;
  ownerId?: string;
  dueDate?: string;
  priorityId?: string;
  statusId?: string;
  note?: string;
}

const clean = (v: string | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

function fieldsOf(input: TaskInput) {
  return {
    name: input.name.trim(),
    categoryId: input.categoryId,
    ownerId: clean(input.ownerId),
    dueDate: clean(input.dueDate),
    priorityId: clean(input.priorityId),
    statusId: clean(input.statusId),
    note: clean(input.note),
  };
}

export function newTask(input: TaskInput, createdBy: string | undefined, now = new Date()): Task {
  const iso = now.toISOString();
  return {
    id: crypto.randomUUID(),
    ...fieldsOf(input),
    createdBy: clean(createdBy),
    createdAt: iso,
    updatedAt: iso,
    done: false,
  };
}

export function editTask(task: Task, input: TaskInput, now = new Date()): Task {
  return { ...task, ...fieldsOf(input), updatedAt: now.toISOString() };
}

/** 列上直接修改的三個欄位。空字串代表清掉（未指派、沒有 Deadline、未設定）。 */
export interface InlinePatch {
  ownerId?: string;
  dueDate?: string;
  statusId?: string;
}

export function patchTask(task: Task, patch: InlinePatch, now = new Date()): Task {
  const next: Task = { ...task, updatedAt: now.toISOString() };
  for (const key of Object.keys(patch) as (keyof InlinePatch)[]) {
    const value = patch[key];
    if (value) next[key] = value;
    else delete next[key];
  }
  return next;
}

export function completeTask(task: Task, doneBy: string | undefined, now = new Date()): Task {
  return {
    ...task,
    done: true,
    doneAt: todayStr(now),
    doneBy: clean(doneBy),
    updatedAt: now.toISOString(),
  };
}

export function restoreTask(task: Task, now = new Date()): Task {
  const next: Task = { ...task, done: false, updatedAt: now.toISOString() };
  delete next.doneAt;
  delete next.doneBy;
  return next;
}
