import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Schema } from '../../amplify/data/resource';
import { progressToFields, rowToProgress } from '../cloud/progressMapping';
import { progressRepo, taskOptionRepo } from '../data';
import { closeDB, getDB } from '../data/indexeddb/db';
import { ensureDefaultTaskOptions } from '../data/indexeddb/seedTaskOptions';
import type { ProgressItem } from '../data/types';
import {
  editItem,
  filterItems,
  groupByProject,
  newItem,
  patchItem,
  sortItems,
  summarize,
  UNASSIGNED,
} from './progress';
import { optionUsage, splitOptions } from './tasks';

const item = (id: string, o: Partial<ProgressItem> = {}): ProgressItem => ({
  id,
  name: id,
  projectId: 'opt-project-j0',
  status: 'proposed',
  createdAt: `2026-09-0${id.length}T00:00:00.000Z`,
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...o,
});

const ids = (list: ProgressItem[]) => list.map((i) => i.id);

describe('排序', () => {
  const a = item('a', { opsPriority: 'P2', techLevel: 'S' });
  const b = item('bb', { opsPriority: 'P0', techLevel: 'XL' });
  const c = item('ccc', { opsPriority: 'P0', techLevel: 'S', dueDate: '2026-10-20' });
  const d = item('dddd'); // 兩個都沒填
  const e = item('eeeee', { opsPriority: 'P1', techLevel: 'R', dueDate: '2026-10-05' });

  it('營運優先：P0 在前，同級技術簡單的先，沒填的最後', () => {
    expect(ids(sortItems([a, b, c, d, e], 'ops'))).toEqual(['ccc', 'bb', 'eeeee', 'a', 'dddd']);
  });

  it('技術等級：簡單的在前，需研究與沒填的最後', () => {
    expect(ids(sortItems([a, b, c, d, e], 'tech'))).toEqual(['ccc', 'a', 'bb', 'eeeee', 'dddd']);
  });

  it('目標日期：近的在前，沒有日期的最後', () => {
    expect(ids(sortItems([a, b, c, d, e], 'due'))).toEqual(['eeeee', 'ccc', 'bb', 'a', 'dddd']);
  });

  it('不改動傳進來的陣列', () => {
    const input = [a, b];
    sortItems(input, 'ops');
    expect(ids(input)).toEqual(['a', 'bb']);
  });
});

describe('篩選與分組', () => {
  const items = [
    item('a', { projectId: 'p1', ownerId: 'm1' }),
    item('bb', { projectId: 'p2' }),
    item('ccc', { projectId: 'p1' }),
    item('dddd', { projectId: 'gone' }),
  ];
  const projects = [
    { id: 'p1', kind: 'project' as const, name: 'App', order: 0, updatedAt: 'x' },
    { id: 'p2', kind: 'project' as const, name: 'AI', order: 1, updatedAt: 'x' },
    { id: 'p3', kind: 'project' as const, name: '空的', order: 2, updatedAt: 'x' },
  ];

  it('依大項目與負責人篩選', () => {
    expect(ids(filterItems(items, { projectId: 'p1' }))).toEqual(['a', 'ccc']);
    expect(ids(filterItems(items, { ownerId: 'm1' }))).toEqual(['a']);
    expect(ids(filterItems(items, { ownerId: UNASSIGNED }))).toEqual(['bb', 'ccc', 'dddd']);
  });

  it('依大項目清單的順序分組；空的不列出；找不到大項目的放最後', () => {
    const groups = groupByProject(items, projects);
    expect(groups.map((g) => [g.project?.name ?? null, ids(g.items)])).toEqual([
      ['App', ['a', 'ccc']],
      ['AI', ['bb']],
      [null, ['dddd']],
    ]);
  });
});

describe('摘要', () => {
  it('進行中、待技術評估、P0、逾期；完成的不算，暫緩的不算待評估或逾期', () => {
    const items = [
      item('a', { opsPriority: 'P0' }), // 待評估、緊急
      item('bb', { techLevel: 'M', dueDate: '2026-09-01' }), // 逾期
      item('ccc', { status: 'done' }),
      item('dddd', { status: 'paused', dueDate: '2026-09-01' }),
    ];
    expect(summarize(items, '2026-10-07')).toEqual({ open: 3, needsAssessment: 1, urgent: 1, overdue: 1 });
  });
});

describe('建立與修改', () => {
  const input = { name: '  改按鈕  ', projectId: 'p1', status: 'proposed' as const, opsNote: ' ', ownerId: '' };

  it('名稱去空白，空白的欄位不存', () => {
    const created = newItem(input, 'Tessy', new Date('2026-10-07T03:00:00Z'));
    expect(created).toMatchObject({ name: '改按鈕', projectId: 'p1', status: 'proposed', createdBy: 'Tessy' });
    expect(created.opsNote).toBeUndefined();
    expect(created.ownerId).toBeUndefined();
    expect(created.doneAt).toBeUndefined();
  });

  it('狀態改成完成就記下完成日，改回去就清掉；已經完成的再存不會改完成日', () => {
    const base = newItem(input, undefined, new Date('2026-10-07T03:00:00Z'));
    const done = patchItem(base, { status: 'done' }, new Date('2026-10-09T03:00:00Z'));
    expect(done.doneAt).toBe('2026-10-09');
    const edited = editItem(done, { ...input, status: 'done' }, new Date('2026-10-20T03:00:00Z'));
    expect(edited.doneAt).toBe('2026-10-09');
    const reopened = patchItem(done, { status: 'building' });
    expect('doneAt' in reopened).toBe(false);
  });

  it('列上修改：空字串代表清掉，沒提到的欄位不動', () => {
    const base = item('a', { opsPriority: 'P1', techLevel: 'L', ownerId: 'm1', dueDate: '2026-10-10' });
    const next = patchItem(base, { opsPriority: '', ownerId: '' });
    expect('opsPriority' in next).toBe(false);
    expect('ownerId' in next).toBe(false);
    expect(next.techLevel).toBe('L');
    expect(next.dueDate).toBe('2026-10-10');
    expect(patchItem(base, { techLevel: 'XL' }).techLevel).toBe('XL');
  });
});

describe('雲端資料列轉換', () => {
  it('寫出去的欄位明確帶 null，讀回來不認得的值被擋掉', () => {
    const fields = progressToFields(item('a', { opsPriority: 'P1' }));
    expect(fields).toMatchObject({ opsPriority: 'P1', techLevel: null, ownerId: null, deletedAt: null, status: 'proposed' });

    const row = {
      id: 'r1',
      name: '項目',
      projectId: 'p1',
      opsPriority: 'P9',
      techLevel: 'XL',
      status: '亂寫的',
      clientCreatedAt: 'c',
      clientUpdatedAt: 'u',
    } as unknown as Schema['ProgressItem']['type'];
    const back = rowToProgress(row);
    expect(back.opsPriority).toBeUndefined();
    expect(back.techLevel).toBe('XL');
    expect(back.status).toBe('proposed');
    expect(back.updatedAt).toBe('u');
  });
});

describe('本機資料庫', () => {
  beforeEach(async () => {
    await closeDB();
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  it('存了讀得回來；標記為待上傳；刪除是墓碑且不留名稱與備註', async () => {
    await progressRepo.save(item('a', { opsNote: '客戶要求' }));
    expect((await progressRepo.get('a'))?.opsNote).toBe('客戶要求');
    expect((await (await getDB()).getAll('dirty')).map((d) => d.key)).toEqual(['item:a']);

    await progressRepo.remove('a');
    expect(await progressRepo.get('a')).toBeNull();
    expect(await progressRepo.list()).toEqual([]);
    const raw = await (await getDB()).get('progress', 'a');
    expect(raw?.deletedAt).toBeTruthy();
    expect(raw?.name).toBe('');
    expect(raw?.opsNote).toBeUndefined();
  });

  it('預設有四個大項目；刪除大項目前檢查有沒有項目在用', async () => {
    await ensureDefaultTaskOptions();
    const { projects } = splitOptions(await taskOptionRepo.list());
    expect(projects.map((p) => p.name)).toEqual(['WebApp 細節修改', 'App', '網頁', 'AI']);
    const app = projects[1];
    await progressRepo.save(item('a', { projectId: app.id }));
    expect(optionUsage([], app, await progressRepo.list())).toBe(1);
    expect(optionUsage([], projects[0], await progressRepo.list())).toBe(0);
  });
});
