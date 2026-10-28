import type { ProgressItem, ProgressOption } from '../data/types';
import type { StatusColor } from './statusTone';
import { nextOrder } from './reorder';
import { todayStr } from './tasks';

// 產品進度：營運端排「優先級」，技術端排「技術等級」，兩個欄位分開、由不同的人填。
// 大項目、營運優先級、技術等級、狀態都是管理員在「產品進度設定」維護的選項，項目用編號引用。
// 第一次啟動的預設選項在 src/text/productProgress.ts；畫面上其他的文字也在那個檔案。

export const STATUS_COLORS: readonly StatusColor[] = ['gray', 'green', 'yellow', 'red', 'purple', 'blue'];

export const parseColor = (v: string | undefined): StatusColor =>
  STATUS_COLORS.find((c) => c === v) ?? 'gray';

/** 產品進度的選項，依種類分好、依順序排好 */
export interface ProgressOptions {
  projects: ProgressOption[];
  priorities: ProgressOption[];
  techLevels: ProgressOption[];
  statuses: ProgressOption[];
}

export const EMPTY_PROGRESS_OPTIONS: ProgressOptions = {
  projects: [],
  priorities: [],
  techLevels: [],
  statuses: [],
};

export function splitProgressOptions(options: ProgressOption[]): ProgressOptions {
  const sorted = (kind: ProgressOption['kind']) =>
    options.filter((o) => o.kind === kind && !o.deletedAt).sort((a, b) => a.order - b.order);
  return {
    projects: sorted('project'),
    priorities: sorted('priority'),
    techLevels: sorted('tech'),
    statuses: sorted('status'),
  };
}

export const optionById = (list: ProgressOption[], id: string | undefined): ProgressOption | undefined =>
  id ? list.find((o) => o.id === id) : undefined;

/** 標籤上顯示的顏色；選項不存在（被刪了）或沒設定就是灰 */
export const colorOf = (list: ProgressOption[], id: string | undefined): StatusColor | undefined => {
  const option = optionById(list, id);
  return option ? parseColor(option.color) : undefined;
};

/** 代表「完成」的狀態編號 */
export const doneStatusIds = (opts: ProgressOptions): Set<string> =>
  new Set(opts.statuses.filter((s) => s.isDone).map((s) => s.id));

export const isDone = (item: ProgressItem, opts: ProgressOptions): boolean => doneStatusIds(opts).has(item.status);

/** 打勾完成用哪個狀態：第一個代表完成的狀態；沒有就不能打勾 */
export const completeStatusId = (opts: ProgressOptions): string | undefined =>
  opts.statuses.find((s) => s.isDone)?.id;

/** 取消完成退回哪個狀態：完成狀態前面緊鄰的那個；找不到就用第一個非完成的狀態 */
export function reopenStatusId(opts: ProgressOptions): string | undefined {
  const doneIndex = opts.statuses.findIndex((s) => s.isDone);
  const before = doneIndex > 0 ? opts.statuses.slice(0, doneIndex).reverse().find((s) => !s.isDone) : undefined;
  return (before ?? opts.statuses.find((s) => !s.isDone))?.id;
}

// ── 排序、篩選、分組 ──

export type ProgressSort = 'ops' | 'tech' | 'due' | 'manual';

const NO_DATE = '9999-99-99';
const UNSET = 99;

const rankIn = (list: ProgressOption[], id: string | undefined) => {
  const k = id ? list.findIndex((o) => o.id === id) : -1;
  return k < 0 ? UNSET : k;
};

/**
 * 同一個大項目內的排序（清單上排在越前面的選項越優先）。
 * - ops：營運優先級（第一個在前），同級再看技術等級（排前面的先），再看目標日期
 * - tech：技術等級（排前面的先），同級再看營運優先級
 * - due：目標日期近的在前（沒有的最後），同日再看營運優先級
 * - manual：手動拖曳排的順序（sortOrder 小的在上面）；還沒排過的排最後，依建立時間
 * 最後都用建立時間定順序，讓結果穩定。沒填的排最後。
 */
export function sortItems(items: ProgressItem[], sort: ProgressSort, opts: ProgressOptions): ProgressItem[] {
  const ops = (i: ProgressItem) => rankIn(opts.priorities, i.opsPriority);
  const tech = (i: ProgressItem) => rankIn(opts.techLevels, i.techLevel);
  const due = (i: ProgressItem) => i.dueDate ?? NO_DATE;
  const manual = (i: ProgressItem) => i.sortOrder ?? 1e15;
  const compare = {
    manual: (a: ProgressItem, b: ProgressItem) => manual(a) - manual(b),
    ops: (a: ProgressItem, b: ProgressItem) => ops(a) - ops(b) || tech(a) - tech(b) || due(a).localeCompare(due(b)),
    tech: (a: ProgressItem, b: ProgressItem) => tech(a) - tech(b) || ops(a) - ops(b) || due(a).localeCompare(due(b)),
    due: (a: ProgressItem, b: ProgressItem) => due(a).localeCompare(due(b)) || ops(a) - ops(b) || tech(a) - tech(b),
  }[sort];
  return [...items].sort((a, b) => compare(a, b) || a.createdAt.localeCompare(b.createdAt));
}

/** 列上直接改過的項目，暫時沿用修改前的值排序，列不會立刻跳位置（和待辦一樣） */
export function sortItemsStable(
  items: ProgressItem[],
  sort: ProgressSort,
  opts: ProgressOptions,
  frozen: ReadonlyMap<string, ProgressItem>
): ProgressItem[] {
  const current = new Map(items.map((i) => [i.id, i]));
  return sortItems(
    items.map((i) => frozen.get(i.id) ?? i),
    sort,
    opts
  ).map((i) => current.get(i.id)!);
}

export interface ProgressFilter {
  /** 大項目的編號 */
  projectId?: string;
}

export function filterItems(items: ProgressItem[], filter: ProgressFilter): ProgressItem[] {
  return items.filter((i) => !filter.projectId || i.projectId === filter.projectId);
}

export interface ProjectGroup {
  /** null = 項目的大項目不在清單裡（例如被刪掉了） */
  project: ProgressOption | null;
  items: ProgressItem[];
}

/** 依大項目清單的順序分組，空的大項目不列出；找不到大項目的歸在最後一組 */
export function groupByProject(items: ProgressItem[], projects: ProgressOption[]): ProjectGroup[] {
  const groups: ProjectGroup[] = projects
    .map((project) => ({ project, items: items.filter((i) => i.projectId === project.id) }))
    .filter((g) => g.items.length > 0);
  const known = new Set(projects.map((p) => p.id));
  const orphans = items.filter((i) => !known.has(i.projectId));
  if (orphans.length > 0) groups.push({ project: null, items: orphans });
  return groups;
}

export interface ProgressSummary {
  open: number;
  /** 技術端還沒填技術等級的（開會時要先討論的） */
  needsAssessment: number;
  /** 營運標了最高優先級（優先級清單的第一個）還沒完成的 */
  urgent: number;
  /** 目標日期已過還沒完成的 */
  overdue: number;
}

export function summarize(items: ProgressItem[], opts: ProgressOptions, today = todayStr()): ProgressSummary {
  const done = doneStatusIds(opts);
  const open = items.filter((i) => !done.has(i.status));
  const top = opts.priorities[0]?.id;
  return {
    open: open.length,
    needsAssessment: open.filter((i) => !i.techLevel).length,
    urgent: top ? open.filter((i) => i.opsPriority === top).length : 0,
    overdue: open.filter((i) => i.dueDate && i.dueDate < today).length,
  };
}

// ── 建立與修改 ──

export interface ProgressInput {
  name: string;
  projectId: string;
  opsPriority?: string;
  techLevel?: string;
  status: string;
  dueDate?: string;
  opsNote?: string;
  techNote?: string;
}

const clean = (v: string | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

function fieldsOf(input: ProgressInput) {
  return {
    name: input.name.trim(),
    projectId: input.projectId,
    opsPriority: clean(input.opsPriority),
    techLevel: clean(input.techLevel),
    status: input.status,
    dueDate: clean(input.dueDate),
    opsNote: clean(input.opsNote),
    techNote: clean(input.techNote),
  };
}

/** 完成日跟著狀態走：改成完成就記下今天，改回去就清掉 */
function withDoneDate(
  prev: ProgressItem | undefined,
  next: ProgressItem,
  opts: ProgressOptions,
  now: Date
): ProgressItem {
  const done = doneStatusIds(opts);
  if (done.has(next.status)) {
    return { ...next, doneAt: prev && done.has(prev.status) && prev.doneAt ? prev.doneAt : todayStr(now) };
  }
  const { doneAt: _doneAt, ...rest } = next;
  return rest;
}

export function newItem(
  input: ProgressInput,
  createdBy: string | undefined,
  opts: ProgressOptions,
  now = new Date()
): ProgressItem {
  const iso = now.toISOString();
  return withDoneDate(
    undefined,
    {
      id: crypto.randomUUID(),
      ...fieldsOf(input),
      createdBy: clean(createdBy),
      createdAt: iso,
      updatedAt: iso,
    },
    opts,
    now
  );
}

export function editItem(item: ProgressItem, input: ProgressInput, opts: ProgressOptions, now = new Date()): ProgressItem {
  return withDoneDate(item, { ...item, ...fieldsOf(input), updatedAt: now.toISOString() }, opts, now);
}

/** 列上直接修改的欄位。undefined 的欄位不動；空字串代表清掉。 */
export interface ProgressPatch {
  opsPriority?: string;
  techLevel?: string;
  status?: string;
  dueDate?: string;
}

export function patchItem(
  item: ProgressItem,
  patch: ProgressPatch,
  opts: ProgressOptions,
  now = new Date()
): ProgressItem {
  const next: ProgressItem = { ...item, updatedAt: now.toISOString() };
  for (const key of ['opsPriority', 'techLevel', 'dueDate'] as const) {
    const value = patch[key];
    if (value === undefined) continue;
    if (value) next[key] = value;
    else delete next[key];
  }
  if (patch.status !== undefined) next.status = patch.status;
  return withDoneDate(item, next, opts, now);
}

/** 打勾完成。完成日自動記錄。沒有任何「代表完成」的狀態時回傳 null（不能打勾）。 */
export function completeItem(item: ProgressItem, opts: ProgressOptions, now = new Date()): ProgressItem | null {
  const status = completeStatusId(opts);
  return status ? patchItem(item, { status }, opts, now) : null;
}

/** 取消完成：退回完成狀態前面的那個狀態 */
export function reopenItem(item: ProgressItem, opts: ProgressOptions, now = new Date()): ProgressItem | null {
  const status = reopenStatusId(opts);
  return status ? patchItem(item, { status }, opts, now) : null;
}

// ── 手動拖曳排序 ──

export { moveItem } from './reorder';

/** 新增項目時放在同一個大項目的最後面 */
export function nextSortOrder(items: ProgressItem[], projectId: string): number {
  return nextOrder(items.filter((i) => i.projectId === projectId));
}
