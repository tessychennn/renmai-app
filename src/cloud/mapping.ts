// 本機資料 ↔ 雲端資料列的轉換。刻意不 import aws-amplify，方便單元測試。
import type { Schema } from '../../amplify/data/resource';
import type { CollabOwner, CollabStatus, Group, Person } from '../data/types';

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
