// 本機資料 ↔ 雲端資料列的轉換。刻意不 import aws-amplify，方便單元測試。
import type { Schema } from '../../amplify/data/resource';
import type {
  CollabOwner,
  CollabStatus,
  Group,
  Person,
  Task,
  TaskOption,
  TaskOptionKind,
} from '../data/types';

const STATUSES: readonly CollabStatus[] = ['contact', 'contacting', 'scheduled', 'done'];
const OWNERS: readonly CollabOwner[] = ['Tessy', 'Serina'];

// 雲端欄位是純字串；讀回來時擋掉不認得的值，避免髒資料讓畫面壞掉
const parseStatus = (v: string | null | undefined): CollabStatus | undefined =>
  STATUSES.find((s) => s === v);
const parseOwner = (v: string | null | undefined): CollabOwner | undefined =>
  OWNERS.find((o) => o === v);

const strings = (values: readonly (string | null)[] | null | undefined): string[] =>
  (values ?? []).filter((v): v is string => v !== null);

export function rowToPerson(row: Schema['Person']['type']): Person {
  return {
    id: row.id,
    displayName: row.displayName,
    lineName: row.lineName ?? undefined,
    avatarPhotoId: row.avatarPhotoId ?? undefined,
    photoIds: strings(row.photoIds),
    groupIds: strings(row.groupIds),
    occasion: row.occasion ?? undefined,
    metDate: row.metDate ?? undefined,
    note: row.note ?? undefined,
    collabStatus: parseStatus(row.collabStatus),
    collabOwner: parseOwner(row.collabOwner),
    collabNote: row.collabNote ?? undefined,
    createdAt: row.clientCreatedAt,
    updatedAt: row.clientUpdatedAt,
    deletedAt: row.deletedAt ?? undefined,
  };
}

export function rowToGroup(row: Schema['Group']['type']): Group {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    order: row.order,
    updatedAt: row.clientUpdatedAt,
    deletedAt: row.deletedAt ?? undefined,
  };
}

/** 欄位一律明確送出（沒有的送 null），使用者清掉場合、備註、合作狀態時才會真的清掉雲端的值 */
export function personToFields(p: Person) {
  return {
    displayName: p.displayName,
    lineName: p.lineName ?? null,
    avatarPhotoId: p.avatarPhotoId ?? null,
    photoIds: p.photoIds,
    groupIds: p.groupIds,
    occasion: p.occasion ?? null,
    metDate: p.metDate ?? null,
    note: p.note ?? null,
    collabStatus: p.collabStatus ?? null,
    collabOwner: p.collabOwner ?? null,
    collabNote: p.collabNote ?? null,
    clientCreatedAt: p.createdAt,
    clientUpdatedAt: p.updatedAt,
    deletedAt: p.deletedAt ?? null,
  };
}

const OPTION_KINDS: readonly TaskOptionKind[] = ['category', 'member', 'priority', 'status'];

export function rowToTask(row: Schema['Task']['type']): Task {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    ownerId: row.ownerId ?? undefined,
    dueDate: row.dueDate ?? undefined,
    priorityId: row.priorityId ?? undefined,
    statusId: row.statusId ?? undefined,
    note: row.note ?? undefined,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.clientCreatedAt,
    updatedAt: row.clientUpdatedAt,
    done: row.done,
    doneAt: row.doneAt ?? undefined,
    doneBy: row.doneBy ?? undefined,
    deletedAt: row.deletedAt ?? undefined,
  };
}

/** 欄位一律明確送出（沒有的送 null），清掉 Deadline、備註等才會真的清掉雲端的值 */
export function taskToFields(t: Task) {
  return {
    name: t.name,
    categoryId: t.categoryId,
    ownerId: t.ownerId ?? null,
    dueDate: t.dueDate ?? null,
    priorityId: t.priorityId ?? null,
    statusId: t.statusId ?? null,
    note: t.note ?? null,
    createdBy: t.createdBy ?? null,
    done: t.done,
    doneAt: t.doneAt ?? null,
    doneBy: t.doneBy ?? null,
    clientCreatedAt: t.createdAt,
    clientUpdatedAt: t.updatedAt,
    deletedAt: t.deletedAt ?? null,
  };
}

/** 雲端出現不認得的種類就回傳 null，由呼叫端略過，避免髒資料讓畫面壞掉 */
export function rowToOption(row: Schema['TaskOption']['type']): TaskOption | null {
  const kind = OPTION_KINDS.find((k) => k === row.kind);
  if (!kind) return null;
  return {
    id: row.id,
    kind,
    name: row.name,
    order: row.order,
    email: row.email ?? undefined,
    updatedAt: row.clientUpdatedAt,
    deletedAt: row.deletedAt ?? undefined,
  };
}

export function optionToFields(o: TaskOption) {
  return {
    kind: o.kind,
    name: o.name,
    order: o.order,
    email: o.email ?? null,
    clientUpdatedAt: o.updatedAt,
    deletedAt: o.deletedAt ?? null,
  };
}

export const hasCollabData = (p: Person): boolean =>
  p.collabStatus !== undefined || p.collabOwner !== undefined || p.collabNote !== undefined;

export function groupToFields(g: Group) {
  return {
    name: g.name,
    color: g.color,
    order: g.order,
    clientUpdatedAt: g.updatedAt,
    deletedAt: g.deletedAt ?? null,
  };
}
