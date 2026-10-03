import { describe, expect, it } from 'vitest';
import type { Schema } from '../../amplify/data/resource';
import type { Person } from '../data/types';
import { hasCollabData, personToFields, rowToPerson } from './mapping';

type PersonRow = Schema['Person']['type'];

function row(overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    id: 'p1',
    displayName: '王小明',
    photoIds: ['a', 'b'],
    groupIds: [],
    clientCreatedAt: '2026-09-01T00:00:00.000Z',
    clientUpdatedAt: '2026-09-02T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  } as PersonRow;
}

describe('雲端資料列 → 本機人物', () => {
  it('合作欄位原樣帶回，時間戳用 App 自己的 client 時間', () => {
    const p = rowToPerson(
      row({ collabStatus: 'scheduled', collabOwner: 'Serina', collabNote: '週三 14:00' })
    );
    expect(p.collabStatus).toBe('scheduled');
    expect(p.collabOwner).toBe('Serina');
    expect(p.collabNote).toBe('週三 14:00');
    expect(p.createdAt).toBe('2026-09-01T00:00:00.000Z');
    expect(p.updatedAt).toBe('2026-09-02T00:00:00.000Z');
  });

  it('雲端沒有合作欄位（舊資料或欄位為 null）時是 undefined，不會變成「null」字串', () => {
    const p = rowToPerson(row({ collabStatus: null, collabOwner: null, collabNote: null }));
    expect(p.collabStatus).toBeUndefined();
    expect(p.collabOwner).toBeUndefined();
    expect(p.collabNote).toBeUndefined();
  });

  it('雲端出現不認得的狀態或負責人時直接忽略，避免畫面壞掉', () => {
    const p = rowToPerson(row({ collabStatus: 'weird-status', collabOwner: 'Someone' }));
    expect(p.collabStatus).toBeUndefined();
    expect(p.collabOwner).toBeUndefined();
  });
});

describe('本機人物 → 雲端欄位', () => {
  const base: Person = {
    id: 'p1',
    displayName: '王小明',
    photoIds: [],
    groupIds: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  };

  it('移出列表（沒有合作欄位）時明確送 null，雲端的值才會被清掉', () => {
    const fields = personToFields(base);
    expect(fields.collabStatus).toBeNull();
    expect(fields.collabOwner).toBeNull();
    expect(fields.collabNote).toBeNull();
  });

  it('有合作欄位時照樣送出', () => {
    const fields = personToFields({ ...base, collabStatus: 'contact', collabOwner: 'Tessy', collabNote: 'x' });
    expect(fields).toMatchObject({ collabStatus: 'contact', collabOwner: 'Tessy', collabNote: 'x' });
  });

  it('hasCollabData：任何一個合作欄位有值就算', () => {
    expect(hasCollabData(base)).toBe(false);
    expect(hasCollabData({ ...base, collabStatus: 'done' })).toBe(true);
    expect(hasCollabData({ ...base, collabNote: 'x' })).toBe(true);
  });
});
