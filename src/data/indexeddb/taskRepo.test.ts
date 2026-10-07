import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TASK_OPTIONS, OPTION_SEED_TIME } from '../defaultTaskOptions';
import type { Task, TaskOption } from '../types';
import { closeDB, getDB } from './db';
import { ensureDefaultTaskOptions } from './seedTaskOptions';
import { IndexedDBTaskOptionRepo } from './taskOptionRepo';
import { IndexedDBTaskRepo } from './taskRepo';

const tasks = new IndexedDBTaskRepo();
const options = new IndexedDBTaskOptionRepo();

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    name: '寄報價單',
    categoryId: 'c1',
    note: '給 A 公司',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    done: false,
    ...overrides,
  };
}

beforeEach(async () => {
  await closeDB();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('待辦任務', () => {
  it('存了讀得回來，list 含已完成的', async () => {
    await tasks.save(task());
    await tasks.save(task({ id: 't2', done: true, doneAt: '2026-10-02' }));
    expect(await tasks.get('t1')).toEqual(task());
    expect((await tasks.list()).map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('標記為待上傳（同步用）', async () => {
    await tasks.saveMany([task(), task({ id: 't2' })]);
    const dirty = (await (await getDB()).getAll('dirty')).map((d) => d.key).sort();
    expect(dirty).toEqual(['task:t1', 'task:t2']);
  });

  it('刪除是墓碑：list 與 get 都看不到，且不留名稱與備註', async () => {
    await tasks.save(task());
    await tasks.remove('t1');
    expect(await tasks.get('t1')).toBeNull();
    expect(await tasks.list()).toEqual([]);
    const raw = await (await getDB()).get('tasks', 't1');
    expect(raw?.deletedAt).toBeTruthy();
    expect(raw?.name).toBe('');
    expect(raw?.note).toBeUndefined();
  });

  it('刪除不存在的任務不會出錯', async () => {
    await expect(tasks.remove('nope')).resolves.toBeUndefined();
  });
});

describe('待辦選項', () => {
  const opt = (id: string, kind: TaskOption['kind'], name: string, order: number): TaskOption => ({
    id,
    kind,
    name,
    order,
    updatedAt: '2026-10-01T00:00:00.000Z',
  });

  it('依 order 排序，可以只取某一種', async () => {
    await options.saveMany([
      opt('a', 'category', '行銷', 1),
      opt('b', 'category', '業務', 0),
      opt('c', 'member', 'Tessy', 0),
    ]);
    expect((await options.list('category')).map((o) => o.name)).toEqual(['業務', '行銷']);
    expect((await options.list()).length).toBe(3);
  });

  it('刪除是墓碑，不再出現在清單', async () => {
    await options.save(opt('a', 'category', '行銷', 0));
    await options.remove('a');
    expect(await options.list()).toEqual([]);
  });
});

describe('預設選項', () => {
  it('第一次啟動建立全部預設值', async () => {
    expect(await ensureDefaultTaskOptions()).toBe(DEFAULT_TASK_OPTIONS.length);
    expect((await options.list('category')).map((o) => o.name)).toEqual([
      '業務開發',
      '行銷',
      '財務',
      '行政',
      '活動',
      '產品',
    ]);
    expect((await options.list('member')).map((o) => o.name)).toEqual(['Tessy', 'Serina']);
    expect((await options.list('priority')).map((o) => o.name)).toEqual(['高', '中', '低']);
    expect((await options.list('status')).map((o) => o.name)).toEqual([
      '未開始',
      '進行中',
      '卡住',
      '等回覆',
      '需聯繫',
      '聯繫中',
      '已約時間',
    ]);
  });

  it('可重複執行，不會重複建立', async () => {
    await ensureDefaultTaskOptions();
    expect(await ensureDefaultTaskOptions()).toBe(0);
    expect((await options.list()).length).toBe(DEFAULT_TASK_OPTIONS.length);
  });

  it('不標記為待上傳：只有管理員能寫入選項，預設值只存在本機', async () => {
    await ensureDefaultTaskOptions();
    expect(await (await getDB()).getAll('dirty')).toEqual([]);
  });

  it('管理員刪掉的預設選項不會又被補回來', async () => {
    await ensureDefaultTaskOptions();
    await options.remove('opt-category-c1');
    expect(await ensureDefaultTaskOptions()).toBe(0);
    expect((await options.list('category')).map((o) => o.name)).not.toContain('行銷');
  });

  it('管理員改過名稱的預設選項不會被覆蓋回去', async () => {
    await ensureDefaultTaskOptions();
    const [first] = await options.list('category');
    await options.save({ ...first, name: '客戶開發', updatedAt: '2026-10-05T00:00:00.000Z' });
    await ensureDefaultTaskOptions();
    expect((await options.list('category'))[0].name).toBe('客戶開發');
  });

  it('預設值的時間戳是固定的很早的時間（讓任何後續修改都能勝出）', () => {
    expect(DEFAULT_TASK_OPTIONS.every((o) => o.updatedAt === OPTION_SEED_TIME)).toBe(true);
  });
});
