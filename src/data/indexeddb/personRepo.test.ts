import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { closeDB } from './db';
import { IndexedDBPersonRepo } from './personRepo';
import type { Person } from '../types';

function makePerson(overrides: Partial<Person> = {}): Person {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    displayName: '王小明',
    photoIds: [],
    groupIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const repo = new IndexedDBPersonRepo();

beforeEach(async () => {
  await closeDB();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('IndexedDBPersonRepo', () => {
  it('save 之後 get 拿得回同一筆', async () => {
    const p = makePerson({ occasion: '2026 設計週' });
    await repo.save(p);
    expect(await repo.get(p.id)).toEqual(p);
  });

  it('get 不存在的 id 回傳 null', async () => {
    expect(await repo.get('nope')).toBeNull();
  });

  it('list 依 createdAt 新到舊排序', async () => {
    await repo.save(makePerson({ id: 'old', createdAt: '2026-01-01T00:00:00Z' }));
    await repo.save(makePerson({ id: 'new', createdAt: '2026-09-01T00:00:00Z' }));
    const ids = (await repo.list()).map((p) => p.id);
    expect(ids).toEqual(['new', 'old']);
  });

  it('可依認識日期排序，沒填的以加入日期代替', async () => {
    await repo.save(
      makePerson({ id: 'a', metDate: '2026-03-01', createdAt: '2026-09-01T00:00:00Z' })
    );
    await repo.save(
      makePerson({ id: 'b', metDate: '2026-08-01', createdAt: '2026-09-02T00:00:00Z' })
    );
    await repo.save(makePerson({ id: 'c', createdAt: '2026-05-01T00:00:00Z' })); // 無 metDate → 2026-05-01

    expect((await repo.list({ sort: 'metDate-desc' })).map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect((await repo.list({ sort: 'metDate-asc' })).map((p) => p.id)).toEqual(['a', 'c', 'b']);
  });

  it('搜尋比對 displayName、occasion、note、lineName（不分大小寫）', async () => {
    await repo.save(makePerson({ id: 'a', displayName: '阿明' }));
    await repo.save(makePerson({ id: 'b', displayName: '小華', lineName: 'Hua_Design' }));
    await repo.save(makePerson({ id: 'c', displayName: '阿花', note: '喜歡爬山' }));

    expect((await repo.list({ search: 'hua_' })).map((p) => p.id)).toEqual(['b']);
    expect((await repo.list({ search: '爬山' })).map((p) => p.id)).toEqual(['c']);
    expect((await repo.list({ search: '找不到' })).length).toBe(0);
  });

  it('分組篩選：符合任一選取分組即列出', async () => {
    await repo.save(makePerson({ id: 'a', groupIds: ['g1'] }));
    await repo.save(makePerson({ id: 'b', groupIds: ['g2'] }));
    await repo.save(makePerson({ id: 'c', groupIds: [] }));

    const ids = (await repo.list({ groupIds: ['g1', 'g2'] })).map((p) => p.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('remove 之後 get 回傳 null', async () => {
    const p = makePerson();
    await repo.save(p);
    await repo.remove(p.id);
    expect(await repo.get(p.id)).toBeNull();
  });
});
