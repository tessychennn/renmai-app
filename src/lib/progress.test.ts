import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Schema } from '../../amplify/data/resource';
import { progressOptionToFields, progressToFields, rowToProgress, rowToProgressOption } from '../cloud/progressMapping';
import { progressOptionRepo, progressRepo } from '../data';
import { closeDB, getDB } from '../data/indexeddb/db';
import { ensureDefaultProgressOptions } from '../data/indexeddb/seedProgressOptions';
import type { ProgressItem, ProgressOption } from '../data/types';
import {
  colorOf,
  completeItem,
  completeStatusId,
  editItem,
  filterItems,
  groupByProject,
  moveItem,
  newItem,
  nextSortOrder,
  patchItem,
  reopenItem,
  reopenStatusId,
  sortItems,
  splitProgressOptions,
  summarize,
  type ProgressOptions,
} from './progress';

const opt = (kind: ProgressOption['kind'], id: string, order: number, extra: Partial<ProgressOption> = {}): ProgressOption => ({
  id,
  kind,
  name: id,
  order,
  color: 'gray',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

// P0 最高；S 最簡單；狀態由前到後，done 代表完成
const OPTS: ProgressOptions = splitProgressOptions([
  opt('project', 'p1', 0),
  opt('project', 'p2', 1),
  opt('project', 'p3', 2),
  opt('priority', 'P0', 0, { color: 'red' }),
  opt('priority', 'P1', 1),
  opt('priority', 'P2', 2),
  opt('priority', 'P3', 3),
  opt('tech', 'S', 0),
  opt('tech', 'M', 1),
  opt('tech', 'XL', 2),
  opt('tech', 'R', 3),
  opt('status', 'proposed', 0),
  opt('status', 'building', 1),
  opt('status', 'testing', 2),
  opt('status', 'done', 3, { isDone: true }),
  opt('status', 'paused', 4),
]);

const item = (id: string, o: Partial<ProgressItem> = {}): ProgressItem => ({
  id,
  name: id,
  projectId: 'p1',
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

  it('營運優先：第一個優先級在前，同級技術簡單的先，沒填的最後', () => {
    expect(ids(sortItems([a, b, c, d, e], 'ops', OPTS))).toEqual(['ccc', 'bb', 'eeeee', 'a', 'dddd']);
  });

  it('技術等級：清單排前面的先，需研究與沒填的最後', () => {
    expect(ids(sortItems([a, b, c, d, e], 'tech', OPTS))).toEqual(['ccc', 'a', 'bb', 'eeeee', 'dddd']);
  });

  it('目標日期：近的在前，沒有日期的最後', () => {
    expect(ids(sortItems([a, b, c, d, e], 'due', OPTS))).toEqual(['eeeee', 'ccc', 'bb', 'a', 'dddd']);
  });

  it('管理員調整選項順序，排序跟著變', () => {
    const reordered = splitProgressOptions([
      opt('priority', 'P0', 3),
      opt('priority', 'P1', 2),
      opt('priority', 'P2', 1),
      opt('priority', 'P3', 0),
    ]);
    expect(ids(sortItems([item('x', { opsPriority: 'P0' }), item('yy', { opsPriority: 'P3' })], 'ops', reordered))).toEqual([
      'yy',
      'x',
    ]);
  });

  it('不改動傳進來的陣列', () => {
    const input = [a, b];
    sortItems(input, 'ops', OPTS);
    expect(ids(input)).toEqual(['a', 'bb']);
  });
});

describe('篩選與分組', () => {
  const items = [
    item('a', { projectId: 'p1' }),
    item('bb', { projectId: 'p2' }),
    item('ccc', { projectId: 'p1' }),
    item('dddd', { projectId: 'gone' }),
  ];

  it('依大項目篩選；沒選就是全部', () => {
    expect(ids(filterItems(items, { projectId: 'p1' }))).toEqual(['a', 'ccc']);
    expect(ids(filterItems(items, {}))).toEqual(['a', 'bb', 'ccc', 'dddd']);
  });

  it('依大項目清單的順序分組；空的不列出；找不到大項目的放最後', () => {
    const groups = groupByProject(items, OPTS.projects);
    expect(groups.map((g) => [g.project?.id ?? null, ids(g.items)])).toEqual([
      ['p1', ['a', 'ccc']],
      ['p2', ['bb']],
      [null, ['dddd']],
    ]);
  });
});

describe('摘要', () => {
  it('進行中、待技術評估、最高優先級、逾期；完成的不算', () => {
    const items = [
      item('a', { opsPriority: 'P0' }), // 待評估、最高優先級
      item('bb', { techLevel: 'M', dueDate: '2026-09-01' }), // 逾期
      item('ccc', { status: 'done' }),
      item('dddd', { opsPriority: 'P1', techLevel: 'S' }),
    ];
    expect(summarize(items, OPTS, '2026-10-07')).toEqual({ open: 3, needsAssessment: 1, urgent: 1, overdue: 1 });
  });

  it('沒有優先級選項時不會當機', () => {
    expect(summarize([item('a')], splitProgressOptions([opt('status', 'done', 0, { isDone: true })]), '2026-10-07').urgent).toBe(0);
  });
});

describe('完成狀態由選項決定', () => {
  it('打勾用第一個代表完成的狀態；取消打勾退回它前面的那個', () => {
    expect(completeStatusId(OPTS)).toBe('done');
    expect(reopenStatusId(OPTS)).toBe('testing');
  });

  it('管理員改了狀態順序或換了代表完成的狀態，跟著變', () => {
    const other = splitProgressOptions([
      opt('status', 'a', 0),
      opt('status', 'ok', 1, { isDone: true }),
      opt('status', 'b', 2),
    ]);
    expect(completeStatusId(other)).toBe('ok');
    expect(reopenStatusId(other)).toBe('a');
    const doneFirst = splitProgressOptions([opt('status', 'ok', 0, { isDone: true }), opt('status', 'b', 1)]);
    expect(reopenStatusId(doneFirst)).toBe('b'); // 完成排第一個：退回第一個非完成的
  });

  it('沒有任何代表完成的狀態：不能打勾', () => {
    const none = splitProgressOptions([opt('status', 'a', 0)]);
    expect(completeStatusId(none)).toBeUndefined();
    expect(completeItem(item('x'), none)).toBeNull();
  });
});

describe('建立與修改', () => {
  const input = { name: '  改按鈕  ', projectId: 'p1', status: 'proposed', opsNote: ' ' };

  it('名稱去空白，空白的欄位不存', () => {
    const created = newItem(input, 'Tessy', OPTS, new Date('2026-10-07T03:00:00Z'));
    expect(created).toMatchObject({ name: '改按鈕', projectId: 'p1', status: 'proposed', createdBy: 'Tessy' });
    expect(created.opsNote).toBeUndefined();
    expect(created.doneAt).toBeUndefined();
  });

  it('狀態改成完成就記下完成日，改回去就清掉；已經完成的再存不會改完成日', () => {
    const base = newItem(input, undefined, OPTS, new Date('2026-10-07T03:00:00Z'));
    const done = patchItem(base, { status: 'done' }, OPTS, new Date('2026-10-09T03:00:00Z'));
    expect(done.doneAt).toBe('2026-10-09');
    const edited = editItem(done, { ...input, status: 'done' }, OPTS, new Date('2026-10-20T03:00:00Z'));
    expect(edited.doneAt).toBe('2026-10-09');
    const reopened = patchItem(done, { status: 'building' }, OPTS);
    expect('doneAt' in reopened).toBe(false);
  });

  it('列上修改：空字串代表清掉，沒提到的欄位不動', () => {
    const base = item('a', { opsPriority: 'P1', techLevel: 'XL', dueDate: '2026-10-10' });
    const next = patchItem(base, { opsPriority: '', dueDate: '' }, OPTS);
    expect('opsPriority' in next).toBe(false);
    expect('dueDate' in next).toBe(false);
    expect(next.techLevel).toBe('XL');
    expect(patchItem(base, { techLevel: 'M' }, OPTS).techLevel).toBe('M');
  });

  it('打勾完成：記下完成日；取消打勾退回測試中並清掉完成日', () => {
    const base = item('a', { status: 'building' });
    const done = completeItem(base, OPTS, new Date('2026-10-09T03:00:00Z'))!;
    expect(done).toMatchObject({ status: 'done', doneAt: '2026-10-09' });
    const back = reopenItem(done, OPTS)!;
    expect(back.status).toBe('testing');
    expect('doneAt' in back).toBe(false);
  });
});

describe('顏色', () => {
  it('依選項設定的顏色；選項不存在回傳 undefined；不認得的顏色當灰色', () => {
    expect(colorOf(OPTS.priorities, 'P0')).toBe('red');
    expect(colorOf(OPTS.priorities, 'nope')).toBeUndefined();
    expect(colorOf([opt('priority', 'x', 0, { color: '亂寫' })], 'x')).toBe('gray');
  });
});

describe('雲端資料列轉換', () => {
  it('項目：寫出去的欄位明確帶 null，編號原樣讀回', () => {
    const fields = progressToFields(item('a', { opsPriority: 'P1' }));
    expect(fields).toMatchObject({ opsPriority: 'P1', techLevel: null, dueDate: null, deletedAt: null, status: 'proposed' });

    const row = {
      id: 'r1',
      name: '項目',
      projectId: 'p1',
      opsPriority: 'custom-id',
      techLevel: 'XL',
      status: 'proposed',
      clientCreatedAt: 'c',
      clientUpdatedAt: 'u',
    } as unknown as Schema['ProgressItem']['type'];
    expect(rowToProgress(row)).toMatchObject({ opsPriority: 'custom-id', techLevel: 'XL', updatedAt: 'u' });
  });

  it('選項：轉換來回一致；不認得的種類被略過', () => {
    const o = opt('status', 's1', 2, { hint: '說明', isDone: true, color: 'green' });
    const fields = progressOptionToFields(o);
    expect(fields).toMatchObject({ kind: 'status', hint: '說明', isDone: true, color: 'green', clientUpdatedAt: o.updatedAt });
    const row = { id: 's1', ...fields } as unknown as Schema['ProgressOption']['type'];
    expect(rowToProgressOption(row)).toEqual(o);
    expect(rowToProgressOption({ ...row, kind: '亂寫' } as Schema['ProgressOption']['type'])).toBeNull();
  });
});

describe('本機資料庫', () => {
  beforeEach(async () => {
    await closeDB();
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  it('項目：存了讀得回來；標記為待上傳；刪除是墓碑且不留名稱與備註', async () => {
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

  it('預設選項：第一次啟動建立，沿用最初的代碼當編號；不標記待上傳；可重複執行', async () => {
    const added = await ensureDefaultProgressOptions();
    expect(added).toBeGreaterThan(0);
    expect(await ensureDefaultProgressOptions()).toBe(0);
    expect(await (await getDB()).getAll('dirty')).toEqual([]);

    const o = splitProgressOptions(await progressOptionRepo.list());
    expect(o.priorities.map((p) => p.id)).toEqual(['P0', 'P1', 'P2', 'P3']);
    expect(o.techLevels.map((p) => p.id)).toEqual(['S', 'M', 'L', 'XL', 'R']);
    expect(o.statuses.map((s) => s.id)).toEqual(['proposed', 'assessing', 'scheduled', 'building', 'testing', 'done', 'paused']);
    expect(o.projects.map((p) => p.name)).toEqual(['WebApp 細節修改', 'App', '網頁', 'AI']);
    expect(completeStatusId(o)).toBe('done');
  });

  it('管理員刪掉的預設選項不會被補回來；改過的不會被蓋回去', async () => {
    await ensureDefaultProgressOptions();
    await progressOptionRepo.remove('P3');
    const [first] = await progressOptionRepo.list('priority');
    await progressOptionRepo.save({ ...first, name: '最急', updatedAt: '2026-10-05T00:00:00.000Z' });
    expect(await ensureDefaultProgressOptions()).toBe(0);
    const names = (await progressOptionRepo.list('priority')).map((p) => p.name);
    expect(names).toEqual(['最急', 'P1', 'P2']);
  });
});

describe('手動拖曳排序', () => {
  const m = (id: string, sortOrder?: number, projectId = 'p1') => item(id, { sortOrder, projectId });
  const orderOf = (list: ProgressItem[], changed: ProgressItem[]) => {
    const map = new Map(list.map((i) => [i.id, i]));
    for (const c of changed) map.set(c.id, c);
    return sortItems([...map.values()], 'manual', OPTS).map((i) => `${i.id}`);
  };

  it('手動排序：位置小的在上面，還沒排過的排最後（依建立時間）', () => {
    const list = [m('ccc', 3), m('a'), m('bb', 1), m('dddd', 2)];
    expect(ids(sortItems(list, 'manual', OPTS))).toEqual(['bb', 'dddd', 'ccc', 'a']);
  });

  it('已經是手動排好的：只改被拖動的那一筆，位置放在前後鄰居中間，其他不動', () => {
    const list = [m('a', 1), m('bb', 2), m('ccc', 3), m('dddd', 4)];
    const changed = moveItem(list, 'dddd', 'bb', new Date('2026-10-20T00:00:00Z')); // 拖到第二個的位置
    expect(changed.map((c) => c.id)).toEqual(['dddd']);
    expect(changed[0].sortOrder).toBe(1.5);
    expect(changed[0].updatedAt).toBe('2026-10-20T00:00:00.000Z');
    expect(orderOf(list, changed)).toEqual(['a', 'dddd', 'bb', 'ccc']);
  });

  it('拖到最上面與最下面', () => {
    const list = [m('a', 1), m('bb', 2), m('ccc', 3)];
    const top = moveItem(list, 'ccc', 'a');
    expect(top[0].sortOrder).toBe(0); // 比第一個小
    expect(orderOf(list, top)).toEqual(['ccc', 'a', 'bb']);
    const bottom = moveItem(list, 'a', 'ccc');
    expect(bottom[0].sortOrder).toBe(4); // 比最後一個大
    expect(orderOf(list, bottom)).toEqual(['bb', 'ccc', 'a']);
  });

  it('連續拖很多次：位置一直取中間，順序始終正確', () => {
    let list = [m('a', 1), m('bb', 2), m('ccc', 3)];
    for (let k = 0; k < 20; k++) {
      // 每次把最後一個拖到第二個位置（兩個鄰居之間的空隙越來越小）
      const sorted = sortItems(list, 'manual', OPTS);
      const changed = moveItem(sorted, sorted[2].id, sorted[1].id);
      const map = new Map(list.map((i) => [i.id, i]));
      for (const c of changed) map.set(c.id, c);
      list = [...map.values()];
    }
    expect(new Set(list.map((i) => i.sortOrder)).size).toBe(3); // 位置沒有重複
  });

  it('第一次拖、或是從別的排序切過來（位置還沒排過）：依目前畫面的順序重新編號', () => {
    const shown = [m('a'), m('bb'), m('ccc')]; // 畫面上是依營運優先之類的順序，還沒有手動位置
    const changed = moveItem(shown, 'ccc', 'a');
    expect(changed.map((c) => [c.id, c.sortOrder])).toEqual([
      ['ccc', 1],
      ['a', 2],
      ['bb', 3],
    ]);
    // 畫面順序與手動位置不一致（切過來之前排過）也重新編號
    const mixed = [m('a', 5), m('bb', 2), m('ccc', 9)];
    const changed2 = moveItem(mixed, 'bb', 'ccc');
    expect(orderOf(mixed, changed2)).toEqual(['a', 'ccc', 'bb']);
  });

  it('拖到原地或找不到項目：什麼都不改', () => {
    const list = [m('a', 1), m('bb', 2)];
    expect(moveItem(list, 'a', 'a')).toEqual([]);
    expect(moveItem(list, 'nope', 'a')).toEqual([]);
  });

  it('新增的項目排在同一個大項目的最後面，不受其他大項目影響', () => {
    const list = [m('a', 1), m('bb', 7), m('x', 100, 'p2')];
    expect(nextSortOrder(list, 'p1')).toBe(8);
    expect(nextSortOrder(list, 'p3')).toBe(1);
  });
});
