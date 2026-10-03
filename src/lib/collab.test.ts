import { describe, expect, it } from 'vitest';
import type { Person } from '../data/types';
import { collabCounts, collabList, isMarked, statusLabel, withCollab } from './collab';

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: 'p',
    displayName: '王小明',
    photoIds: [],
    groupIds: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('合作機會列表', () => {
  const persons = [
    person({ id: 'none' }),
    person({ id: 'done', collabStatus: 'done', updatedAt: '2026-09-05T00:00:00.000Z' }),
    person({ id: 'contact-old', collabStatus: 'contact', updatedAt: '2026-09-02T00:00:00.000Z' }),
    person({ id: 'contact-new', collabStatus: 'contact', updatedAt: '2026-09-04T00:00:00.000Z', collabOwner: 'Tessy' }),
    person({ id: 'scheduled', collabStatus: 'scheduled', collabOwner: 'Serina' }),
    person({ id: 'contacting', collabStatus: 'contacting' }),
  ];

  it('只列出被標記的人；需要處理的在前，同狀態內最近更新的在上', () => {
    expect(collabList(persons).map((p) => p.id)).toEqual([
      'contact-new',
      'contact-old',
      'contacting',
      'scheduled',
      'done',
    ]);
  });

  it('可依狀態篩選', () => {
    expect(collabList(persons, { status: 'contact' }).map((p) => p.id)).toEqual([
      'contact-new',
      'contact-old',
    ]);
  });

  it('可依負責人篩選，也能找出未指定負責人的', () => {
    expect(collabList(persons, { owner: 'Tessy' }).map((p) => p.id)).toEqual(['contact-new']);
    expect(collabList(persons, { owner: 'unassigned' }).map((p) => p.id).sort()).toEqual([
      'contact-old',
      'contacting',
      'done',
    ]);
  });

  it('狀態與負責人條件可以疊加', () => {
    expect(collabList(persons, { status: 'scheduled', owner: 'Serina' }).map((p) => p.id)).toEqual([
      'scheduled',
    ]);
    expect(collabList(persons, { status: 'scheduled', owner: 'Tessy' })).toEqual([]);
  });

  it('統計各狀態人數、判斷是否被標記', () => {
    expect(collabCounts(persons)).toEqual({ contact: 2, contacting: 1, scheduled: 1, done: 1 });
    expect(isMarked(persons[0])).toBe(false);
    expect(isMarked(persons[1])).toBe(true);
    expect(statusLabel('scheduled')).toBe('已約時間');
  });
});

describe('修改合作欄位', () => {
  const NOW = '2026-09-10T00:00:00.000Z';

  it('標記狀態會更新 updatedAt（同步才知道這筆是新的）', () => {
    const next = withCollab(person(), { status: 'contact' }, NOW);
    expect(next.collabStatus).toBe('contact');
    expect(next.updatedAt).toBe(NOW);
  });

  it('可設定負責人與備註，備註會去掉前後空白，空白備註視為清除', () => {
    let next = withCollab(person({ collabStatus: 'contacting' }), { owner: 'Serina', note: '  下週三視訊  ' }, NOW);
    expect(next.collabOwner).toBe('Serina');
    expect(next.collabNote).toBe('下週三視訊');
    next = withCollab(next, { note: '   ' }, NOW);
    expect(next.collabNote).toBeUndefined();
  });

  it('負責人傳 null 代表改成未指定', () => {
    const next = withCollab(person({ collabStatus: 'contact', collabOwner: 'Tessy' }), { owner: null }, NOW);
    expect(next.collabOwner).toBeUndefined();
    expect(next.collabStatus).toBe('contact');
  });

  it('移出列表會連負責人與備註一起清掉', () => {
    const next = withCollab(
      person({ collabStatus: 'done', collabOwner: 'Tessy', collabNote: '已簽約' }),
      { status: null },
      NOW
    );
    expect(next.collabStatus).toBeUndefined();
    expect(next.collabOwner).toBeUndefined();
    expect(next.collabNote).toBeUndefined();
    expect('collabStatus' in next).toBe(false);
  });

  it('不會改動原本的物件', () => {
    const original = person({ collabStatus: 'contact' });
    withCollab(original, { status: 'done' }, NOW);
    expect(original.collabStatus).toBe('contact');
  });
});
