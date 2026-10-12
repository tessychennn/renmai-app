import type {
  OpsPriority,
  ProgressItem,
  ProgressStatus,
  TaskOption,
  TechLevel,
} from '../data/types';
import { type StatusColor } from './statusTone';
import { todayStr } from './tasks';

// 進度追蹤：營運端排「優先級」，技術端排「技術等級」，兩個欄位分開、由不同的人填。

export interface Choice<T extends string> {
  value: T;
  label: string;
  /** 下拉選單裡的說明 */
  hint: string;
  color: StatusColor;
}

export const OPS_PRIORITIES: readonly Choice<OpsPriority>[] = [
  { value: 'P0', label: 'P0', hint: '緊急：壞了或擋住營運，立刻處理', color: 'red' },
  { value: 'P1', label: 'P1', hint: '本月一定要做', color: 'yellow' },
  { value: 'P2', label: 'P2', hint: '排隊，有空檔就做', color: 'blue' },
  { value: 'P3', label: 'P3', hint: '想做但不急，或先擱著', color: 'gray' },
];

export const TECH_LEVELS: readonly Choice<TechLevel>[] = [
  { value: 'S', label: 'S', hint: '半天以內', color: 'green' },
  { value: 'M', label: 'M', hint: '1 到 3 天', color: 'yellow' },
  { value: 'L', label: 'L', hint: '1 到 2 週', color: 'red' },
  { value: 'XL', label: 'XL', hint: '兩週以上', color: 'purple' },
  { value: 'R', label: '需研究', hint: '還估不出來，要先研究', color: 'gray' },
];

export const PROGRESS_STATUSES: readonly Choice<ProgressStatus>[] = [
  { value: 'proposed', label: '提出', hint: '營運剛提出，技術端還沒看', color: 'gray' },
  { value: 'assessing', label: '評估中', hint: '技術端正在評估', color: 'purple' },
  { value: 'scheduled', label: '排程中', hint: '評估完，排進開發', color: 'yellow' },
  { value: 'building', label: '開發中', hint: '正在做', color: 'blue' },
  { value: 'testing', label: '測試中', hint: '做好了，在測試', color: 'green' },
  { value: 'done', label: '完成', hint: '已上線', color: 'gray' },
  { value: 'paused', label: '暫緩', hint: '先擱置', color: 'gray' },
];

const parser =
  <T extends string>(list: readonly Choice<T>[]) =>
  (v: string | null | undefined): T | undefined =>
    list.find((c) => c.value === v)?.value;

export const parseOpsPriority = parser(OPS_PRIORITIES);
export const parseTechLevel = parser(TECH_LEVELS);
export const parseProgressStatus = parser(PROGRESS_STATUSES);

export const labelOf = <T extends string>(list: readonly Choice<T>[], value: T | undefined): string | undefined =>
  value ? list.find((c) => c.value === value)?.label : undefined;

export const colorOf = <T extends string>(list: readonly Choice<T>[], value: T | undefined): StatusColor | undefined =>
  value ? list.find((c) => c.value === value)?.color : undefined;

// ── 排序、篩選、分組 ──

export type ProgressSort = 'ops' | 'tech' | 'due';

export const SORT_LABEL: Record<ProgressSort, string> = {
  ops: '營運優先',
  tech: '技術等級',
  due: '目標日期',
};

const NO_DATE = '9999-99-99';
const UNSET = 99;

const opsRank = (i: ProgressItem) => {
  const k = OPS_PRIORITIES.findIndex((c) => c.value === i.opsPriority);
  return k < 0 ? UNSET : k;
};

/** 技術等級由小到大（S 最先）；沒填的、需研究的排最後 */
const techRank = (i: ProgressItem) => {
  const k = TECH_LEVELS.findIndex((c) => c.value === i.techLevel);
  return k < 0 ? UNSET : k;
};

/**
 * 同一個大項目內的排序。
 * - ops：營運優先級（P0 在前），同級再看技術等級（簡單的先），再看目標日期
 * - tech：技術等級（簡單的先），同級再看營運優先級
 * - due：目標日期近的在前（沒有的最後），同日再看營運優先級
 * 最後都用建立時間定順序，讓結果穩定。
 */
export function sortItems(items: ProgressItem[], sort: ProgressSort): ProgressItem[] {
  const due = (i: ProgressItem) => i.dueDate ?? NO_DATE;
  const compare = {
    ops: (a: ProgressItem, b: ProgressItem) =>
      opsRank(a) - opsRank(b) || techRank(a) - techRank(b) || due(a).localeCompare(due(b)),
    tech: (a: ProgressItem, b: ProgressItem) =>
      techRank(a) - techRank(b) || opsRank(a) - opsRank(b) || due(a).localeCompare(due(b)),
    due: (a: ProgressItem, b: ProgressItem) =>
      due(a).localeCompare(due(b)) || opsRank(a) - opsRank(b) || techRank(a) - techRank(b),
  }[sort];
  return [...items].sort((a, b) => compare(a, b) || a.createdAt.localeCompare(b.createdAt));
}

/** 列上直接改過的項目，暫時沿用修改前的值排序，列不會立刻跳位置（和待辦一樣） */
export function sortItemsStable(
  items: ProgressItem[],
  sort: ProgressSort,
  frozen: ReadonlyMap<string, ProgressItem>
): ProgressItem[] {
  const current = new Map(items.map((i) => [i.id, i]));
  return sortItems(
    items.map((i) => frozen.get(i.id) ?? i),
    sort
  ).map((i) => current.get(i.id)!);
}

export interface ProgressFilter {
  /** 大項目的選項編號 */
  projectId?: string;
  /** 負責人的選項編號；'unassigned' = 未指派 */
  ownerId?: string;
}

export const UNASSIGNED = 'unassigned';

export function filterItems(items: ProgressItem[], filter: ProgressFilter): ProgressItem[] {
  return items.filter((i) => {
    if (filter.projectId && i.projectId !== filter.projectId) return false;
    if (filter.ownerId === UNASSIGNED && i.ownerId) return false;
    if (filter.ownerId && filter.ownerId !== UNASSIGNED && i.ownerId !== filter.ownerId) return false;
    return true;
  });
}

export interface ProjectGroup {
  /** null = 項目的大項目已被刪除（找不到對應選項） */
  project: TaskOption | null;
  items: ProgressItem[];
}

/** 依大項目清單的順序分組，空的大項目不列出；找不到大項目的歸在最後一組 */
export function groupByProject(items: ProgressItem[], projects: TaskOption[]): ProjectGroup[] {
  const groups: ProjectGroup[] = projects
    .map((project) => ({ project, items: items.filter((i) => i.projectId === project.id) }))
    .filter((g) => g.items.length > 0);
  const known = new Set(projects.map((p) => p.id));
  const orphans = items.filter((i) => !known.has(i.projectId));
  if (orphans.length > 0) groups.push({ project: null, items: orphans });
  return groups;
}

/** 做完的與擱置中的不算「進行中的工作」 */
export const isOpen = (i: ProgressItem) => i.status !== 'done';

export interface ProgressSummary {
  open: number;
  /** 技術端還沒填技術等級的（開會時要先討論的） */
  needsAssessment: number;
  /** 營運標了 P0 還沒完成的 */
  urgent: number;
  /** 目標日期已過還沒完成的 */
  overdue: number;
}

export function summarize(items: ProgressItem[], today = todayStr()): ProgressSummary {
  const open = items.filter(isOpen);
  return {
    open: open.length,
    needsAssessment: open.filter((i) => !i.techLevel && i.status !== 'paused').length,
    urgent: open.filter((i) => i.opsPriority === 'P0').length,
    overdue: open.filter((i) => i.dueDate && i.dueDate < today && i.status !== 'paused').length,
  };
}

// ── 建立與修改 ──

export interface ProgressInput {
  name: string;
  projectId: string;
  opsPriority?: OpsPriority;
  techLevel?: TechLevel;
  status: ProgressStatus;
  ownerId?: string;
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
    opsPriority: input.opsPriority,
    techLevel: input.techLevel,
    status: input.status,
    ownerId: clean(input.ownerId),
    dueDate: clean(input.dueDate),
    opsNote: clean(input.opsNote),
    techNote: clean(input.techNote),
  };
}

/** 完成日跟著狀態走：改成完成就記下今天，改回去就清掉 */
function withDoneDate(prev: ProgressItem | undefined, next: ProgressItem, now: Date): ProgressItem {
  if (next.status === 'done') {
    return { ...next, doneAt: prev?.status === 'done' && prev.doneAt ? prev.doneAt : todayStr(now) };
  }
  const { doneAt: _doneAt, ...rest } = next;
  return rest;
}

export function newItem(input: ProgressInput, createdBy: string | undefined, now = new Date()): ProgressItem {
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
    now
  );
}

export function editItem(item: ProgressItem, input: ProgressInput, now = new Date()): ProgressItem {
  return withDoneDate(item, { ...item, ...fieldsOf(input), updatedAt: now.toISOString() }, now);
}

/** 列上直接修改的欄位。undefined 的欄位不動；空字串代表清掉。 */
export interface ProgressPatch {
  opsPriority?: OpsPriority | '';
  techLevel?: TechLevel | '';
  status?: ProgressStatus;
  ownerId?: string;
  dueDate?: string;
}

export function patchItem(item: ProgressItem, patch: ProgressPatch, now = new Date()): ProgressItem {
  const next: ProgressItem = { ...item, updatedAt: now.toISOString() };
  if (patch.opsPriority !== undefined) {
    if (patch.opsPriority) next.opsPriority = patch.opsPriority;
    else delete next.opsPriority;
  }
  if (patch.techLevel !== undefined) {
    if (patch.techLevel) next.techLevel = patch.techLevel;
    else delete next.techLevel;
  }
  if (patch.status !== undefined) next.status = patch.status;
  for (const key of ['ownerId', 'dueDate'] as const) {
    const value = patch[key];
    if (value === undefined) continue;
    if (value) next[key] = value;
    else delete next[key];
  }
  return withDoneDate(item, next, now);
}
