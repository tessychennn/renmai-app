import type { CollabOwner, CollabStatus, Person } from '../data/types';

/** 狀態依處理流程排序：需聯繫 → 聯繫中 → 已約時間 → 完成 */
export const COLLAB_STATUSES: { value: CollabStatus; label: string }[] = [
  { value: 'contact', label: '需聯繫' },
  { value: 'contacting', label: '聯繫中' },
  { value: 'scheduled', label: '已約時間' },
  { value: 'done', label: '完成' },
];

/** 目前只有兩個人共用，負責人固定這兩位 */
export const COLLAB_OWNERS: CollabOwner[] = ['Tessy', 'Serina'];

export const statusLabel = (status: CollabStatus): string =>
  COLLAB_STATUSES.find((s) => s.value === status)?.label ?? status;

const statusOrder = (status: CollabStatus): number =>
  COLLAB_STATUSES.findIndex((s) => s.value === status);

export const isMarked = (p: Person): boolean => p.collabStatus !== undefined;

export interface CollabFilter {
  status?: CollabStatus;
  owner?: CollabOwner | 'unassigned';
}

/**
 * 合作列表：只留被標記的人。需要處理的排前面（需聯繫最前、完成最後），
 * 同狀態內最近更新的在上。
 */
export function collabList(persons: Person[], filter: CollabFilter = {}): Person[] {
  return persons
    .filter((p) => {
      if (!p.collabStatus) return false;
      if (filter.status && p.collabStatus !== filter.status) return false;
      if (filter.owner === 'unassigned' && p.collabOwner) return false;
      if (filter.owner && filter.owner !== 'unassigned' && p.collabOwner !== filter.owner) return false;
      return true;
    })
    .sort(
      (a, b) =>
        statusOrder(a.collabStatus!) - statusOrder(b.collabStatus!) ||
        b.updatedAt.localeCompare(a.updatedAt)
    );
}

/** 各狀態的人數（篩選列顯示用） */
export function collabCounts(persons: Person[]): Record<CollabStatus, number> {
  const counts: Record<CollabStatus, number> = { contact: 0, contacting: 0, scheduled: 0, done: 0 };
  for (const p of persons) if (p.collabStatus) counts[p.collabStatus]++;
  return counts;
}

/** 改合作欄位：改狀態時一併更新時間，同步才知道這筆是新的。status 傳 null 代表移出列表。 */
export function withCollab(
  person: Person,
  changes: { status?: CollabStatus | null; owner?: CollabOwner | null; note?: string },
  now = new Date().toISOString()
): Person {
  const next: Person = { ...person, updatedAt: now };
  if (changes.status === null) {
    // 移出列表：負責人和備註一併清掉，之後重新標記是乾淨的
    delete next.collabStatus;
    delete next.collabOwner;
    delete next.collabNote;
    return next;
  }
  if (changes.status !== undefined) next.collabStatus = changes.status;
  if (changes.owner === null) delete next.collabOwner;
  else if (changes.owner !== undefined) next.collabOwner = changes.owner;
  if (changes.note !== undefined) {
    const trimmed = changes.note.trim();
    if (trimmed) next.collabNote = trimmed;
    else delete next.collabNote;
  }
  return next;
}
