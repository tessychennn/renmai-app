import { clientRepo, personRepo, syncLocal, taskOptionRepo, taskRepo } from '../data';
import { clientIdOf } from '../data/clientId';
import { personIdOfTask } from '../data/prospectId';
import type { Client, Person, TaskOption } from '../data/types';
import { type StatusColor, statusColor } from './statusTone';
import { optionName, splitOptions } from './tasks';

// 客戶：人脈記錄裡被標記為「聯絡中」的人。每個人最多一筆，編號由人物編號固定推出，
// 所以兩支手機各自建立也是同一筆。名字不另存，直接讀人物資料。

export { clientIdOf };

/** 長按或編輯時的選擇：指定狀態，或直接設為完成 */
export interface ClientChoice {
  statusId?: string;
  done?: boolean;
}

const todayOf = (now: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * 建立或更新某個人的客戶紀錄。
 * 已存在（未刪除）就只改狀態／完成，其他欄位（負責人、備註、下次聯絡）保留；
 * 不存在（或曾被移出）就建立新的。
 */
export function buildClient(
  person: Pick<Person, 'id'>,
  choice: ClientChoice,
  existing: Client | null | undefined,
  now = new Date()
): Client {
  const iso = now.toISOString();
  const base: Client = existing
    ? { ...existing, statusId: choice.statusId ?? existing.statusId, updatedAt: iso }
    : {
        id: clientIdOf(person.id),
        personId: person.id,
        statusId: choice.statusId,
        done: false,
        createdAt: iso,
        updatedAt: iso,
      };
  if (choice.done) return { ...base, done: true, doneAt: base.done && base.doneAt ? base.doneAt : todayOf(now) };
  const reopened: Client = { ...base, done: false };
  delete reopened.doneAt;
  return reopened;
}

/** 把某個人列入客戶（或更新狀態） */
export async function setClient(person: Pick<Person, 'id'>, choice: ClientChoice): Promise<void> {
  const existing = await clientRepo.get(clientIdOf(person.id));
  await clientRepo.save(buildClient(person, choice, existing));
}

export async function removeClient(personId: string): Promise<void> {
  await clientRepo.remove(clientIdOf(personId));
}

/** 人物編號 → 客戶紀錄（只含未刪除的） */
export function clientsByPerson(clients: Client[]): Map<string, Client> {
  const map = new Map<string, Client>();
  for (const c of clients) if (!c.deletedAt) map.set(c.personId, c);
  return map;
}

export type ChipTone = StatusColor | 'outline' | 'done';

/** 人物卡上顯示的標籤：看客戶的狀態；沒有狀態就顯示「客戶」 */
export function clientChip(client: Client, statuses: TaskOption[]): { label: string; tone: ChipTone } {
  if (client.done) return { label: '完成', tone: 'done' };
  const status = optionName(statuses, client.statusId);
  if (!status) return { label: '客戶', tone: 'outline' };
  return { label: status, tone: statusColor(status) ?? 'outline' };
}

const LEGACY_STATUS_NAME = {
  contact: '需聯繫',
  contacting: '聯繫中',
  scheduled: '已約時間',
} as const;

/**
 * 把原本「合作機會」存在人物上的狀態、負責人、備註，搬成客戶紀錄。可重複執行：
 * - 客戶已經存在（包含被移出的）、或已經有對應的舊「業務開發」待辦（交給 migrateProspectTasks 處理）就跳過。
 * - 人物上的舊欄位不清除，只是不再使用。
 * 回傳這次建立了幾筆。
 */
export async function migrateCollabToClients(now = new Date()): Promise<number> {
  const persons = (await personRepo.list()).filter((p) => p.collabStatus);
  if (persons.length === 0) return 0;
  const options = splitOptions(await taskOptionRepo.list());
  const iso = now.toISOString();

  const created: Client[] = [];
  for (const p of persons) {
    if (await syncLocal.getClient(clientIdOf(p.id))) continue; // 含墓碑
    if (await syncLocal.getTask(`prospect-${p.id}`)) continue; // 舊的待辦版本，交給另一個搬移處理
    const statusName = p.collabStatus && p.collabStatus !== 'done' ? LEGACY_STATUS_NAME[p.collabStatus] : undefined;
    const done = p.collabStatus === 'done';
    created.push({
      id: clientIdOf(p.id),
      personId: p.id,
      ownerId: p.collabOwner ? options.members.find((m) => m.name === p.collabOwner)?.id : undefined,
      statusId: statusName ? options.statuses.find((s) => s.name === statusName)?.id : undefined,
      note: p.collabNote,
      done,
      doneAt: done ? todayOf(now) : undefined,
      createdAt: iso,
      updatedAt: iso,
    });
  }
  await clientRepo.saveMany(created);
  return created.length;
}

/**
 * 把「業務開發」裡由人脈記錄產生的待辦（編號 prospect-人物編號）搬成客戶紀錄，並把那筆待辦刪除，
 * 讓客戶不再出現在待辦裡。可重複執行：
 * - 客戶已經存在（包含被移出的）就不再建立，只把待辦收掉。
 * - 對應的人物已經不在就直接刪掉待辦。
 * 回傳這次建立了幾筆客戶。
 */
export async function migrateProspectTasks(now = new Date()): Promise<number> {
  const prospects = (await taskRepo.list()).filter((t) => personIdOfTask(t.id));
  if (prospects.length === 0) return 0;
  const iso = now.toISOString();

  let created = 0;
  for (const t of prospects) {
    const personId = personIdOfTask(t.id)!;
    if (!(await syncLocal.getClient(clientIdOf(personId))) && (await personRepo.get(personId))) {
      await clientRepo.save({
        id: clientIdOf(personId),
        personId,
        statusId: t.statusId,
        ownerId: t.ownerId,
        dueDate: t.dueDate,
        note: t.note,
        done: t.done,
        doneAt: t.doneAt,
        createdAt: t.createdAt || iso,
        updatedAt: iso,
      });
      created++;
    }
    await taskRepo.remove(t.id);
  }
  return created;
}

/** 啟動時與每次同步進來新資料後執行：舊資料全部搬進客戶 */
export async function migrateToClients(now = new Date()): Promise<number> {
  const a = await migrateCollabToClients(now);
  const b = await migrateProspectTasks(now);
  return a + b;
}

// ── 客戶頁：篩選、排序、修改 ──

export const UNASSIGNED = 'unassigned';

export interface ClientFilter {
  /** 負責人的選項編號；'unassigned' = 未指派 */
  ownerId?: string;
  statusId?: string;
}

export function filterClients(clients: Client[], filter: ClientFilter): Client[] {
  return clients.filter((c) => {
    if (filter.statusId && c.statusId !== filter.statusId) return false;
    if (filter.ownerId === UNASSIGNED && c.ownerId) return false;
    if (filter.ownerId && filter.ownerId !== UNASSIGNED && c.ownerId !== filter.ownerId) return false;
    return true;
  });
}

const NO_DATE = '9999-99-99';

/** 下次聯絡近的在前（沒有日期的最後），同日再依狀態清單的順序，最後依建立時間 */
export function sortClients(clients: Client[], statuses: TaskOption[]): Client[] {
  const rank = (c: Client) => {
    const i = statuses.findIndex((s) => s.id === c.statusId);
    return i < 0 ? 99 : i;
  };
  return [...clients].sort(
    (a, b) =>
      (a.dueDate ?? NO_DATE).localeCompare(b.dueDate ?? NO_DATE) ||
      rank(a) - rank(b) ||
      a.createdAt.localeCompare(b.createdAt)
  );
}

/** 列上直接修改的欄位。空字串代表清掉。 */
export interface ClientPatch {
  statusId?: string;
  ownerId?: string;
  dueDate?: string;
}

export function patchClient(client: Client, patch: ClientPatch, now = new Date()): Client {
  const next: Client = { ...client, updatedAt: now.toISOString() };
  for (const key of ['statusId', 'ownerId', 'dueDate'] as const) {
    const value = patch[key];
    if (value === undefined) continue;
    if (value) next[key] = value;
    else delete next[key];
  }
  return next;
}

export interface ClientInput {
  statusId?: string;
  ownerId?: string;
  dueDate?: string;
  note?: string;
}

const clean = (v: string | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

export function editClient(client: Client, input: ClientInput, now = new Date()): Client {
  return {
    ...client,
    statusId: clean(input.statusId),
    ownerId: clean(input.ownerId),
    dueDate: clean(input.dueDate),
    note: clean(input.note),
    updatedAt: now.toISOString(),
  };
}

/** 打勾完成；已完成的再按一次就取消 */
export function toggleClientDone(client: Client, now = new Date()): Client {
  const next: Client = { ...client, updatedAt: now.toISOString() };
  if (client.done) {
    next.done = false;
    delete next.doneAt;
  } else {
    next.done = true;
    next.doneAt = todayOf(now);
  }
  return next;
}
