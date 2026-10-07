import { personRepo, syncLocal, taskOptionRepo, taskRepo } from '../data';
import { personIdOfTask, prospectTaskId } from '../data/prospectId';
import type { Person, Task, TaskOption } from '../data/types';
import { completeTask, optionName, splitOptions } from './tasks';

// 人脈記錄裡「可合作」的人 ⇔ 業務開發裡的一筆待辦（任務編號 prospect-人物編號）。
// 狀態、負責人、備註都以那筆待辦為準；人物本身不再存合作欄位。

/** 業務開發的分類：優先用預設編號，其次用名稱，最後退而求其次用第一個分類 */
export function findBusinessCategoryId(categories: TaskOption[]): string | undefined {
  return (
    categories.find((c) => c.id === 'opt-category-c0')?.id ??
    categories.find((c) => c.name === '業務開發')?.id ??
    categories[0]?.id
  );
}

/** 長按或編輯時的選擇：指定狀態，或直接設為完成 */
export interface ProspectChoice {
  statusId?: string;
  done?: boolean;
}

/**
 * 建立或更新某個人對應的待辦。
 * 已存在（未刪除）就只改狀態／完成，其他欄位（負責人、備註、Deadline）保留；
 * 不存在（或曾被刪除）就建立新的。
 */
export function buildProspectTask(
  person: Person,
  categoryId: string,
  choice: ProspectChoice,
  existing: Task | null | undefined,
  now = new Date()
): Task {
  if (existing) {
    const base: Task = { ...existing, statusId: choice.statusId ?? existing.statusId };
    if (choice.done) return completeTask(base, undefined, now);
    // 從完成改回進行中：取消完成
    const reopened: Task = { ...base, done: false, updatedAt: now.toISOString() };
    delete reopened.doneAt;
    delete reopened.doneBy;
    return reopened;
  }
  const iso = now.toISOString();
  const task: Task = {
    id: prospectTaskId(person.id),
    name: person.displayName,
    categoryId,
    statusId: choice.statusId,
    createdAt: iso,
    updatedAt: iso,
    done: false,
  };
  return choice.done ? completeTask(task, undefined, now) : task;
}

/** 把某個人列入業務開發（或更新狀態） */
export async function setProspect(person: Person, choice: ProspectChoice): Promise<void> {
  const options = splitOptions(await taskOptionRepo.list());
  const categoryId = findBusinessCategoryId(options.categories);
  if (!categoryId) throw new Error('還沒有任何分類，請先到「待辦設定」新增「業務開發」分類。');
  const existing = await taskRepo.get(prospectTaskId(person.id));
  await taskRepo.save(buildProspectTask(person, categoryId, choice, existing));
}

export async function removeProspect(personId: string): Promise<void> {
  await taskRepo.remove(prospectTaskId(personId));
}

/** 人物編號 → 對應的待辦（只含未刪除的） */
export function prospectsByPerson(tasks: Task[]): Map<string, Task> {
  const map = new Map<string, Task>();
  for (const t of tasks) {
    const personId = personIdOfTask(t.id);
    if (!t.deletedAt && personId) map.set(personId, t);
  }
  return map;
}

export type ChipTone = 'alert' | 'strong' | 'outline' | 'done';

/** 人物卡上顯示的標籤：看待辦的狀態；沒有狀態就顯示「業務開發」 */
export function prospectChip(task: Task, statuses: TaskOption[]): { label: string; tone: ChipTone } {
  if (task.done) return { label: '完成', tone: 'done' };
  const status = optionName(statuses, task.statusId);
  if (!status) return { label: '業務開發', tone: 'outline' };
  if (status === '需聯繫' || status === '卡住') return { label: status, tone: 'alert' };
  if (status === '已約時間') return { label: status, tone: 'strong' };
  return { label: status, tone: 'outline' };
}

const LEGACY_STATUS_NAME = {
  contact: '需聯繫',
  contacting: '聯繫中',
  scheduled: '已約時間',
} as const;

/**
 * 把原本「合作機會」存在人物上的狀態、負責人、備註，搬成業務開發裡的待辦。可重複執行：
 * - 對應的待辦已經存在（包含被使用者刪掉的）就不再建立，刪掉的不會又冒出來。
 * - 人物上的舊欄位不清除，只是不再使用。
 * 回傳這次建立了幾筆。
 */
export async function migrateCollabToTasks(now = new Date()): Promise<number> {
  const persons = (await personRepo.list()).filter((p) => p.collabStatus);
  if (persons.length === 0) return 0;

  const options = splitOptions(await taskOptionRepo.list());
  const categoryId = findBusinessCategoryId(options.categories);
  if (!categoryId) return 0;

  const created: Task[] = [];
  for (const p of persons) {
    const id = prospectTaskId(p.id);
    if (await syncLocal.getTask(id)) continue; // 含墓碑
    const iso = now.toISOString();
    const done = p.collabStatus === 'done';
    const statusName = p.collabStatus && p.collabStatus !== 'done' ? LEGACY_STATUS_NAME[p.collabStatus] : undefined;
    const task: Task = {
      id,
      name: p.displayName,
      categoryId,
      ownerId: p.collabOwner ? options.members.find((m) => m.name === p.collabOwner)?.id : undefined,
      statusId: statusName ? options.statuses.find((s) => s.name === statusName)?.id : undefined,
      note: p.collabNote,
      createdAt: iso,
      updatedAt: iso,
      done: false,
    };
    created.push(done ? completeTask(task, undefined, now) : task);
  }
  await taskRepo.saveMany(created);
  return created.length;
}
