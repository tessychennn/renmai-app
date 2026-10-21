import { clientRepo, personRepo, syncLocal, taskOptionRepo, taskRepo } from '../data';
import { clientIdOf } from '../data/clientId';
import { personIdOfTask } from '../data/prospectId';
import type { Client, Person, TaskOption } from '../data/types';
import { CLIENT_LEVELS, CLIENT_STATUSES, type ClientStatus } from '../text/clients';
import type { StatusColor } from './statusTone';
import { splitOptions } from './tasks';

// 客戶：聯絡中的名單。可以從人脈記錄標記（編號由人物編號固定推出，兩支手機各自建立也是同一筆，
// 名字直接讀人物資料），也可以在客戶頁直接新增（自己存名字，不需要先有人脈記錄）。
// 狀態是固定的一份清單（src/text/clients.ts）。

export { clientIdOf };

export const clientStatusOf = (id: string | undefined): ClientStatus | undefined =>
  id ? CLIENT_STATUSES.find((s) => s.id === id) : undefined;

export const clientLevelOf = (id: string | undefined): ClientStatus | undefined =>
  id ? CLIENT_LEVELS.find((l) => l.id === id) : undefined;

/** 客戶的名字：自己存的優先；從人脈記錄來的讀人物資料 */
export function clientName(client: Client, persons: ReadonlyMap<string, Pick<Person, 'displayName'>>): string {
  return client.name?.trim() || (client.personId ? persons.get(client.personId)?.displayName : undefined) || '（已刪除的人）';
}

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
 * 建立或更新某個人（人脈記錄裡的）的客戶紀錄。
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

/** 人物編號 → 客戶紀錄（只含未刪除、連結到人脈記錄的） */
export function clientsByPerson(clients: Client[]): Map<string, Client> {
  const map = new Map<string, Client>();
  for (const c of clients) if (!c.deletedAt && c.personId) map.set(c.personId, c);
  return map;
}

export type ChipTone = StatusColor | 'outline' | 'done';

/** 人物卡上顯示的標籤：看客戶的狀態；沒有狀態就顯示「客戶」 */
export function clientChip(client: Client): { label: string; tone: ChipTone } {
  if (client.done) return { label: '完成', tone: 'done' };
  const status = clientStatusOf(client.statusId);
  return status ? { label: status.name, tone: status.color } : { label: '客戶', tone: 'outline' };
}

// ── 客戶頁：新增、篩選、排序、修改 ──

export interface NewClientInput {
  name: string;
  level?: string;
  statusId?: string;
  ownerId?: string;
  dueDate?: string;
  note?: string;
}

const clean = (v: string | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

/** 在客戶頁直接新增（不連結人脈記錄）：自己存名字，編號是隨機的 */
export function newStandaloneClient(input: NewClientInput, now = new Date()): Client {
  const iso = now.toISOString();
  return {
    id: `client-${crypto.randomUUID()}`,
    name: input.name.trim(),
    level: clean(input.level),
    statusId: clean(input.statusId),
    ownerId: clean(input.ownerId),
    dueDate: clean(input.dueDate),
    note: clean(input.note),
    done: false,
    createdAt: iso,
    updatedAt: iso,
  };
}

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

export type ClientSort = 'level' | 'due';

export const CLIENT_SORT_LABEL: Record<ClientSort, string> = {
  level: '重要等級',
  due: '下次聯絡',
};

/**
 * 客戶排序：
 * - level（預設）：等級排前面的在上面（重要在潛在上面，沒設定的最後），同級再依下次聯絡（沒有日期的最後）、
 *   狀態清單的順序、建立時間
 * - due：下次聯絡近的在前（沒有日期的最後），同日再依等級、狀態、建立時間
 */
export function sortClients(clients: Client[], sort: ClientSort = 'level'): Client[] {
  const levelRank = (c: Client) => {
    const i = CLIENT_LEVELS.findIndex((l) => l.id === c.level);
    return i < 0 ? 99 : i;
  };
  const statusRank = (c: Client) => {
    const i = CLIENT_STATUSES.findIndex((s) => s.id === c.statusId);
    return i < 0 ? 99 : i;
  };
  const due = (c: Client) => c.dueDate ?? NO_DATE;
  const compare =
    sort === 'due'
      ? (a: Client, b: Client) =>
          due(a).localeCompare(due(b)) || levelRank(a) - levelRank(b) || statusRank(a) - statusRank(b)
      : (a: Client, b: Client) =>
          levelRank(a) - levelRank(b) || due(a).localeCompare(due(b)) || statusRank(a) - statusRank(b);
  return [...clients].sort((a, b) => compare(a, b) || a.createdAt.localeCompare(b.createdAt));
}

/** 列上直接修改的欄位。空字串代表清掉。 */
export interface ClientPatch {
  level?: string;
  statusId?: string;
  ownerId?: string;
  dueDate?: string;
}

export function patchClient(client: Client, patch: ClientPatch, now = new Date()): Client {
  const next: Client = { ...client, updatedAt: now.toISOString() };
  for (const key of ['level', 'statusId', 'ownerId', 'dueDate'] as const) {
    const value = patch[key];
    if (value === undefined) continue;
    if (value) next[key] = value;
    else delete next[key];
  }
  return next;
}

export interface ClientInput {
  /** 只有自己存名字的客戶（沒有連結人脈記錄）能改名；連結的客戶名字跟著人物 */
  name?: string;
  level?: string;
  statusId?: string;
  ownerId?: string;
  dueDate?: string;
  note?: string;
}

export function editClient(client: Client, input: ClientInput, now = new Date()): Client {
  const next: Client = {
    ...client,
    level: clean(input.level),
    statusId: clean(input.statusId),
    ownerId: clean(input.ownerId),
    dueDate: clean(input.dueDate),
    note: clean(input.note),
    updatedAt: now.toISOString(),
  };
  if (!client.personId && clean(input.name)) next.name = clean(input.name);
  return next;
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

// ── 舊資料搬移 ──

/** 舊的待辦狀態（名稱）對應到客戶的新狀態；對不上的回傳 undefined（變成未設定） */
const FROM_TASK_STATUS: Record<string, string> = {
  需聯繫: 'need-contact',
  未開始: 'need-contact',
  聯繫中: 'contacting',
  進行中: 'contacting',
  等回覆: 'contacting',
};

/** 舊的預設待辦狀態編號，找不到選項清單時用來認名稱 */
const SEED_STATUS_NAME: Record<string, string> = {
  'opt-status-s0': '未開始',
  'opt-status-s1': '進行中',
  'opt-status-s3': '等回覆',
  'opt-status-s4': '需聯繫',
  'opt-status-s5': '聯繫中',
};

function convertTaskStatus(statusId: string | undefined, taskStatuses: TaskOption[]): string | undefined {
  if (!statusId) return undefined;
  if (CLIENT_STATUSES.some((s) => s.id === statusId)) return statusId; // 已經是新的
  const name = taskStatuses.find((s) => s.id === statusId)?.name ?? SEED_STATUS_NAME[statusId];
  return name ? FROM_TASK_STATUS[name] : undefined;
}

const LEGACY_COLLAB_STATUS = {
  contact: 'need-contact',
  contacting: 'contacting',
  scheduled: 'contacting',
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
    const done = p.collabStatus === 'done';
    created.push({
      id: clientIdOf(p.id),
      personId: p.id,
      ownerId: p.collabOwner ? options.members.find((m) => m.name === p.collabOwner)?.id : undefined,
      statusId: p.collabStatus && p.collabStatus !== 'done' ? LEGACY_COLLAB_STATUS[p.collabStatus] : undefined,
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
  const taskStatuses = await taskOptionRepo.list('status');

  let created = 0;
  for (const t of prospects) {
    const personId = personIdOfTask(t.id)!;
    if (!(await syncLocal.getClient(clientIdOf(personId))) && (await personRepo.get(personId))) {
      await clientRepo.save({
        id: clientIdOf(personId),
        personId,
        statusId: convertTaskStatus(t.statusId, taskStatuses),
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

/**
 * 客戶的狀態改成固定的四個之後，把還用著舊的待辦狀態編號的客戶轉過去（需聯繫→需聯繫、
 * 聯繫中／進行中／等回覆→聯繫中、未開始→需聯繫），對不上的變成未設定。可重複執行。
 * 回傳這次改了幾筆。
 */
export async function migrateClientStatuses(now = new Date()): Promise<number> {
  const taskStatuses = await taskOptionRepo.list('status');
  // 只轉「確定是舊的待辦狀態」的；認不得的編號（例如之後從狀態清單拿掉的）原樣保留，不要默默清掉
  const isOldTaskStatus = (id: string) => taskStatuses.some((s) => s.id === id) || id in SEED_STATUS_NAME;
  const clients = (await clientRepo.list()).filter(
    (c) => c.statusId && !CLIENT_STATUSES.some((s) => s.id === c.statusId) && isOldTaskStatus(c.statusId)
  );
  if (clients.length === 0) return 0;
  const iso = now.toISOString();
  await clientRepo.saveMany(
    clients.map((c) => {
      const next: Client = { ...c, statusId: convertTaskStatus(c.statusId, taskStatuses), updatedAt: iso };
      if (!next.statusId) delete next.statusId;
      return next;
    })
  );
  return clients.length;
}

/** 啟動時與每次同步進來新資料後執行：舊資料全部搬進客戶，狀態轉成新的四個 */
export async function migrateToClients(now = new Date()): Promise<number> {
  const a = await migrateCollabToClients(now);
  const b = await migrateProspectTasks(now);
  const c = await migrateClientStatuses(now);
  return a + b + c;
}
