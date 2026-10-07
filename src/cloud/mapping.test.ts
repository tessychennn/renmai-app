import { describe, expect, it } from 'vitest';
import type { Schema } from '../../amplify/data/resource';
import type { Person } from '../data/types';
import {
  hasCollabData,
  optionToFields,
  personToFields,
  rowToOption,
  rowToPerson,
  rowToTask,
  taskToFields,
} from './mapping';

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

describe('待辦：雲端資料列 ↔ 本機', () => {
  const taskRow = (overrides: Partial<Schema['Task']['type']> = {}) =>
    ({
      id: 'k1',
      name: '寄報價單',
      categoryId: 'c1',
      done: false,
      clientCreatedAt: '2026-10-01T00:00:00.000Z',
      clientUpdatedAt: '2026-10-02T00:00:00.000Z',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
      ...overrides,
    }) as Schema['Task']['type'];

  it('任務：欄位帶回、null 變成 undefined、時間戳用 client 時間', () => {
    const t = rowToTask(
      taskRow({ ownerId: 'm1', dueDate: '2026-10-15', note: null, doneAt: null, done: true, doneBy: 'Tessy' })
    );
    expect(t).toMatchObject({
      id: 'k1',
      ownerId: 'm1',
      dueDate: '2026-10-15',
      done: true,
      doneBy: 'Tessy',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
    });
    expect(t.note).toBeUndefined();
    expect(t.doneAt).toBeUndefined();
  });

  it('任務送出時沒有的欄位明確送 null，清掉 Deadline 才會真的清掉雲端的值', () => {
    const f = taskToFields({
      id: 'k1',
      name: 'x',
      categoryId: 'c1',
      createdAt: 'a',
      updatedAt: 'b',
      done: false,
    });
    expect(f).toMatchObject({ ownerId: null, dueDate: null, note: null, doneAt: null, deletedAt: null });
    expect(f.clientCreatedAt).toBe('a');
    expect(f.clientUpdatedAt).toBe('b');
  });

  it('選項：正常帶回；種類不認得就略過（回傳 null），不讓髒資料進本機', () => {
    const row = (kind: string) =>
      ({ id: 'o1', kind, name: '高', order: 0, clientUpdatedAt: 'z' }) as Schema['TaskOption']['type'];
    expect(rowToOption(row('priority'))).toMatchObject({ id: 'o1', kind: 'priority', name: '高', updatedAt: 'z' });
    expect(rowToOption(row('weird'))).toBeNull();
  });

  it('選項送出：成員的 Email 沒填送 null', () => {
    expect(optionToFields({ id: 'o', kind: 'member', name: 'Tessy', order: 0, updatedAt: 'z' }).email).toBeNull();
    expect(
      optionToFields({ id: 'o', kind: 'member', name: 'Tessy', order: 0, email: 'a@b.c', updatedAt: 'z' }).email
    ).toBe('a@b.c');
  });
});
