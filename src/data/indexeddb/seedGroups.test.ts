import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GROUPS } from '../defaultGroups';
import { closeDB, getDB } from './db';
import { IndexedDBGroupRepo } from './groupRepo';
import { ensureDefaultGroups } from './seedGroups';

const groupRepo = new IndexedDBGroupRepo();
const NAMES = ['重要人物', '餐飲相關', '食品相關', '品牌設計', '暫無關聯'];

beforeEach(async () => {
  await closeDB();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('預設分組', () => {
  it('全新安裝：建立五個分組，順序與名稱照指定的排', async () => {
    expect(await ensureDefaultGroups()).toBe(5);
    expect((await groupRepo.list()).map((g) => g.name)).toEqual(NAMES);
  });

  it('可以重複執行，不會重複建立', async () => {
    await ensureDefaultGroups();
    expect(await ensureDefaultGroups()).toBe(0);
    expect((await groupRepo.list()).length).toBe(5);
  });

  it('標記為待上傳，雲端同步時會送上去', async () => {
    await ensureDefaultGroups();
    const dirty = (await (await getDB()).getAll('dirty')).map((d) => d.key).sort();
    expect(dirty).toEqual(DEFAULT_GROUPS.map((g) => `group:${g.id}`).sort());
  });

  it('使用者刪掉的預設分組不會又冒出來', async () => {
    await ensureDefaultGroups();
    await groupRepo.remove('group-food');
    expect(await ensureDefaultGroups()).toBe(0);
    expect((await groupRepo.list()).map((g) => g.name)).toEqual(
      NAMES.filter((n) => n !== '食品相關')
    );
  });

  it('使用者已經自己建過同名分組時，不會再建一個重複的', async () => {
    await groupRepo.save({
      id: 'my-own',
      name: '品牌設計',
      color: '#000000',
      order: 0,
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(await ensureDefaultGroups()).toBe(4);
    expect((await groupRepo.list()).filter((g) => g.name === '品牌設計').length).toBe(1);
  });

  it('預設分組排在使用者自己建立的分組前面', async () => {
    await groupRepo.save({
      id: 'mine',
      name: '我的分組',
      color: '#000000',
      order: 0,
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
    await ensureDefaultGroups();
    const names = (await groupRepo.list()).map((g) => g.name);
    expect(names).toEqual([...NAMES, '我的分組']);
  });
});
