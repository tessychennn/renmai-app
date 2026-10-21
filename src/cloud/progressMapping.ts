// 產品進度與客戶 ↔ 雲端資料列的轉換。刻意不 import aws-amplify，方便單元測試。
import type { Schema } from '../../amplify/data/resource';
import type { Client, ProgressItem, ProgressOption, ProgressOptionKind } from '../data/types';

export function rowToProgress(row: Schema['ProgressItem']['type']): ProgressItem {
  return {
    id: row.id,
    name: row.name,
    projectId: row.projectId,
    opsPriority: row.opsPriority ?? undefined,
    techLevel: row.techLevel ?? undefined,
    status: row.status,
    dueDate: row.dueDate ?? undefined,
    opsNote: row.opsNote ?? undefined,
    techNote: row.techNote ?? undefined,
    doneAt: row.doneAt ?? undefined,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.clientCreatedAt,
    updatedAt: row.clientUpdatedAt,
    deletedAt: row.deletedAt ?? undefined,
  };
}

/** 欄位一律明確送出（沒有的送 null），清掉優先級、備註等才會真的清掉雲端的值 */
export function progressToFields(i: ProgressItem) {
  return {
    name: i.name,
    projectId: i.projectId,
    opsPriority: i.opsPriority ?? null,
    techLevel: i.techLevel ?? null,
    status: i.status,
    dueDate: i.dueDate ?? null,
    opsNote: i.opsNote ?? null,
    techNote: i.techNote ?? null,
    doneAt: i.doneAt ?? null,
    createdBy: i.createdBy ?? null,
    clientCreatedAt: i.createdAt,
    clientUpdatedAt: i.updatedAt,
    deletedAt: i.deletedAt ?? null,
  };
}

const PROGRESS_OPTION_KINDS: readonly ProgressOptionKind[] = ['project', 'priority', 'tech', 'status'];

/** 雲端出現不認得的種類就回傳 null，由呼叫端略過，避免髒資料讓畫面壞掉 */
export function rowToProgressOption(row: Schema['ProgressOption']['type']): ProgressOption | null {
  const kind = PROGRESS_OPTION_KINDS.find((k) => k === row.kind);
  if (!kind) return null;
  return {
    id: row.id,
    kind,
    name: row.name,
    order: row.order,
    color: row.color,
    hint: row.hint ?? undefined,
    isDone: row.isDone ?? undefined,
    updatedAt: row.clientUpdatedAt,
    deletedAt: row.deletedAt ?? undefined,
  };
}

export function progressOptionToFields(o: ProgressOption) {
  return {
    kind: o.kind,
    name: o.name,
    order: o.order,
    color: o.color,
    hint: o.hint ?? null,
    isDone: o.isDone ?? null,
    clientUpdatedAt: o.updatedAt,
    deletedAt: o.deletedAt ?? null,
  };
}

export function rowToClient(row: Schema['Client']['type']): Client {
  return {
    id: row.id,
    personId: row.personId ?? undefined,
    name: row.name ?? undefined,
    level: row.level ?? undefined,
    statusId: row.statusId ?? undefined,
    ownerId: row.ownerId ?? undefined,
    dueDate: row.dueDate ?? undefined,
    note: row.note ?? undefined,
    done: row.done,
    doneAt: row.doneAt ?? undefined,
    createdAt: row.clientCreatedAt,
    updatedAt: row.clientUpdatedAt,
    deletedAt: row.deletedAt ?? undefined,
  };
}

/** 欄位一律明確送出（沒有的送 null），清掉備註、下次聯絡等才會真的清掉雲端的值 */
export function clientToFields(c: Client) {
  return {
    personId: c.personId ?? null,
    name: c.name ?? null,
    level: c.level ?? null,
    statusId: c.statusId ?? null,
    ownerId: c.ownerId ?? null,
    dueDate: c.dueDate ?? null,
    note: c.note ?? null,
    done: c.done,
    doneAt: c.doneAt ?? null,
    clientCreatedAt: c.createdAt,
    clientUpdatedAt: c.updatedAt,
    deletedAt: c.deletedAt ?? null,
  };
}
