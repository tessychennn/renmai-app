// 進度追蹤 ↔ 雲端資料列的轉換。刻意不 import aws-amplify，方便單元測試。
import type { Schema } from '../../amplify/data/resource';
import { parseOpsPriority, parseProgressStatus, parseTechLevel } from '../lib/progress';
import type { ProgressItem } from '../data/types';

export function rowToProgress(row: Schema['ProgressItem']['type']): ProgressItem {
  return {
    id: row.id,
    name: row.name,
    projectId: row.projectId,
    // 雲端欄位是純字串；不認得的值擋掉，避免髒資料讓畫面壞掉
    opsPriority: parseOpsPriority(row.opsPriority),
    techLevel: parseTechLevel(row.techLevel),
    status: parseProgressStatus(row.status) ?? 'proposed',
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
