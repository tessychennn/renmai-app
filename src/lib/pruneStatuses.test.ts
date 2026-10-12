import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { taskOptionRepo, taskRepo } from '../data';
import { closeDB, getDB } from '../data/indexeddb/db';
import { ensureDefaultTaskOptions } from '../data/indexeddb/seedTaskOptions';
import type { Task } from '../data/types';
import { pruneLegacyStatuses } from './pruneStatuses';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const opt = (id: string, name: string, order: number) => ({
  id,
  kind: 'status' as const,
  name,
  order,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const task = (id: string, statusId?: string): Task => ({
  id,
  name: id,
  categoryId: 'opt-category-c0',
  statusId,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  done: false,
});

beforeEach(async () => {
  store.clear();
  store.set('renmai.isAdmin', '1');
  await closeDB();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  await ensureDefaultTaskOptions();
  // 舊版預設多出來的兩個，加上管理員自己加的一個
  await taskOptionRepo.saveMany([opt('opt-status-s2', '卡住', 2), opt('opt-status-s6', '已約時間', 6), opt('x', '自訂', 7)]);
  const db = await getDB();
  await db.clear('dirty');
});

const statusNames = async () => (await taskOptionRepo.list('status')).map((o) => o.name);

describe('清掉預設五個以外的狀態', () => {
  it('刪掉其他狀態；用到的待辦改成未設定，其他待辦不動', async () => {
    await taskRepo.saveMany([task('a', 'opt-status-s2'), task('b', 'opt-status-s1'), task('c', 'x')]);
    await (await getDB()).clear('dirty');

    expect(await pruneLegacyStatuses(true)).toBe(3);

    expect(await statusNames()).toEqual(['未開始', '進行中', '等回覆', '需聯繫', '聯繫中']);
    expect((await taskRepo.get('a'))?.statusId).toBeUndefined();
    expect((await taskRepo.get('c'))?.statusId).toBeUndefined();
    expect((await taskRepo.get('b'))?.statusId).toBe('opt-status-s1');

    // 要同步出去：被改的待辦與被刪的選項都標記為待上傳，沒被動到的不標
    const dirty = (await (await getDB()).getAll('dirty')).map((d) => d.key).sort();
    expect(dirty).toEqual([
      'option:opt-status-s2',
      'option:opt-status-s6',
      'option:x',
      'task:a',
      'task:c',
    ]);
  });

  it('只做一次：之後管理員新增的狀態不會被刪', async () => {
    await pruneLegacyStatuses(true);
    await taskOptionRepo.save(opt('y', '自己新增', 9));
    expect(await pruneLegacyStatuses(true)).toBe(0);
    expect(await statusNames()).toContain('自己新增');
  });

  it('不是管理員的裝置不動任何東西', async () => {
    store.set('renmai.isAdmin', '0');
    expect(await pruneLegacyStatuses(true)).toBe(0);
    expect(await statusNames()).toContain('卡住');
  });
});
