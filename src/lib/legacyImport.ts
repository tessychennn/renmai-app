import type { Task, TaskOption, TaskOptionKind } from '../data/types';

// 匯入原本 Google 試算表（Apps Script）匯出的 JSON。
// 格式見 docs 裡的 exportJson 說明：{ categories, members, priorities, statuses, tasks }。

interface LegacyTask {
  id?: unknown;
  name?: unknown;
  category?: unknown;
  owner?: unknown;
  due?: unknown;
  priority?: unknown;
  status?: unknown;
  note?: unknown;
  createdBy?: unknown;
  createdAt?: unknown;
  done?: unknown;
  doneAt?: unknown;
  doneBy?: unknown;
}

export interface ImportPlan {
  /** 需要新增的選項（已存在同名的會直接沿用，不重複建立） */
  newOptions: TaskOption[];
  /** 需要新增的任務（編號已存在的會略過，所以可以重複匯入） */
  newTasks: Task[];
  skippedExisting: number;
  warnings: string[];
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter(Boolean) : [];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 簡單穩定的雜湊：同一個名稱每次匯入都得到同一個編號，重複匯入不會產生重複選項 */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/** 試算表的建立時間是 "yyyy-MM-dd HH:mm"（台北時間） */
function toIso(createdAt: string, fallback: Date): string {
  const m = createdAt.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (m) {
    const d = new Date(`${m[1]}T${m[2]}:00+08:00`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return fallback.toISOString();
}

export function planLegacyImport(
  raw: unknown,
  existingOptions: TaskOption[],
  existingTaskIds: Set<string>,
  now = new Date()
): ImportPlan {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { tasks?: unknown }).tasks)) {
    throw new Error('這不是試算表匯出的內容：找不到 tasks 清單。');
  }
  const data = raw as {
    categories?: unknown;
    members?: unknown;
    priorities?: unknown;
    statuses?: unknown;
    tasks: LegacyTask[];
  };
  const nowIso = now.toISOString();
  const warnings: string[] = [];
  const newOptions: TaskOption[] = [];

  /** 名稱 → 編號。已存在同名的沿用；沒有的建立（順序接在現有的後面） */
  const maps = {} as Record<TaskOptionKind, Map<string, string>>;
  const nextOrder = {} as Record<TaskOptionKind, number>;
  const kinds: TaskOptionKind[] = ['category', 'member', 'priority', 'status'];
  for (const kind of kinds) {
    const live = existingOptions.filter((o) => o.kind === kind && !o.deletedAt);
    maps[kind] = new Map(live.map((o) => [o.name, o.id]));
    nextOrder[kind] = live.reduce((max, o) => Math.max(max, o.order), -1) + 1;
  }
  const ensure = (kind: TaskOptionKind, name: string): string | undefined => {
    if (!name) return undefined;
    const known = maps[kind].get(name);
    if (known) return known;
    const id = `legacy-${kind}-${hash(name)}`;
    maps[kind].set(name, id);
    newOptions.push({ id, kind, name, order: nextOrder[kind]++, updatedAt: nowIso });
    return id;
  };

  // 先照試算表設定區的順序建立選項，這樣新增的選項順序和原本一致
  strList(data.categories).forEach((n) => ensure('category', n));
  strList(data.members).forEach((n) => ensure('member', n));
  strList(data.priorities).forEach((n) => ensure('priority', n));
  strList(data.statuses).forEach((n) => ensure('status', n));

  const newTasks: Task[] = [];
  let skippedExisting = 0;
  data.tasks.forEach((r, i) => {
    const legacyId = str(r.id);
    const name = str(r.name);
    if (!name) {
      warnings.push(`第 ${i + 1} 筆沒有名稱，已略過。`);
      return;
    }
    const id = `legacy-${legacyId || hash(name + i)}`;
    if (existingTaskIds.has(id)) {
      skippedExisting++;
      return;
    }
    const categoryId = ensure('category', str(r.category));
    if (!categoryId) {
      warnings.push(`「${name}」沒有分類，已略過。`);
      return;
    }
    const due = str(r.due);
    const doneAt = str(r.doneAt);
    const createdAt = toIso(str(r.createdAt), now);
    const done = r.done === true;
    newTasks.push({
      id,
      name,
      categoryId,
      ownerId: ensure('member', str(r.owner)),
      dueDate: DATE_RE.test(due) ? due : undefined,
      priorityId: ensure('priority', str(r.priority)),
      statusId: ensure('status', str(r.status)),
      note: str(r.note) || undefined,
      createdBy: str(r.createdBy) || undefined,
      createdAt,
      updatedAt: createdAt,
      done,
      doneAt: done && DATE_RE.test(doneAt) ? doneAt : undefined,
      doneBy: done ? str(r.doneBy) || undefined : undefined,
    });
  });

  return { newOptions, newTasks, skippedExisting, warnings };
}
