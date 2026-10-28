import { describe, expect, it } from 'vitest';
import type { Task, TaskOption } from '../data/types';
import {
  addDays,
  completeTask,
  dueLabel,
  dueState,
  editTask,
  filterTasks,
  groupByCategory,
  monthGrid,
  newTask,
  optionUsage,
  patchTask,
  priorityTone,
  restoreTask,
  shiftMonth,
  moveItem,
  nextTaskOrder,
  sortBoard,
  sortBoardStable,
  sortDone,
  splitOptions,
  tasksByDate,
  todayStr,
  UNASSIGNED,
} from './tasks';

const opt = (kind: TaskOption['kind'], id: string, name: string, order: number): TaskOption => ({
  id,
  kind,
  name,
  order,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't',
    name: '任務',
    categoryId: 'c1',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    done: false,
    ...overrides,
  };
}

describe('日期與到期狀態', () => {
  it('addDays 跨月、跨年、閏年都正確', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });

  it('todayStr 用本地日期', () => {
    expect(todayStr(new Date(2026, 9, 7, 23, 59))).toBe('2026-10-07');
  });

  it('逾期、今天、3 天內、之後、沒有 Deadline', () => {
    const today = '2026-10-07';
    expect(dueState('2026-10-06', today)).toBe('overdue');
    expect(dueState('2026-10-07', today)).toBe('today');
    expect(dueState('2026-10-10', today)).toBe('soon');
    expect(dueState('2026-10-11', today)).toBe('later');
    expect(dueState(undefined, today)).toBe('none');
  });
});

describe('Deadline 顯示', () => {
  it('今天、明天、月/日，跨年才帶年份', () => {
    const today = '2026-10-07';
    expect(dueLabel('2026-10-07', today)).toBe('今天');
    expect(dueLabel('2026-10-08', today)).toBe('明天');
    expect(dueLabel('2026-10-15', today)).toBe('10/15');
    expect(dueLabel('2026-10-01', today)).toBe('10/1');
    expect(dueLabel('2027-01-05', today)).toBe('2027/1/5');
  });
});

describe('選項', () => {
  const options = [
    opt('category', 'c2', '行銷', 1),
    opt('category', 'c1', '業務', 0),
    opt('member', 'm1', 'Tessy', 0),
    opt('priority', 'p1', '高', 0),
    opt('priority', 'p2', '中', 1),
    opt('priority', 'p3', '低', 2),
    { ...opt('status', 's1', '舊的', 0), deletedAt: '2026-10-01T00:00:00.000Z' },
  ];

  it('依種類分開並照 order 排序，已刪除的不算', () => {
    const s = splitOptions(options);
    expect(s.categories.map((c) => c.name)).toEqual(['業務', '行銷']);
    expect(s.members.length).toBe(1);
    expect(s.statuses).toEqual([]);
  });

  it('優先級：第一個＝最高，最後一個＝最低，只有兩個選項時沒有「最低」', () => {
    const { priorities } = splitOptions(options);
    expect(priorityTone(priorities, 'p1')).toBe('high');
    expect(priorityTone(priorities, 'p2')).toBe('normal');
    expect(priorityTone(priorities, 'p3')).toBe('low');
    expect(priorityTone(priorities, undefined)).toBe('normal');
    expect(priorityTone(priorities.slice(0, 2), 'p2')).toBe('normal');
  });

  it('optionUsage 算出有多少未刪除的任務在使用', () => {
    const tasks = [
      task({ id: '1', categoryId: 'c1' }),
      task({ id: '2', categoryId: 'c1' }),
      task({ id: '3', categoryId: 'c1', deletedAt: '2026-10-02T00:00:00.000Z' }),
      task({ id: '4', categoryId: 'c9', ownerId: 'm1' }),
    ];
    expect(optionUsage(tasks, opt('category', 'c1', '業務', 0))).toBe(2);
    expect(optionUsage(tasks, opt('member', 'm1', 'Tessy', 0))).toBe(1);
    expect(optionUsage(tasks, opt('status', 's9', 'x', 0))).toBe(0);
  });
});

describe('排序', () => {
  const priorities = [opt('priority', 'p1', '高', 0), opt('priority', 'p2', '中', 1)];

  it('待辦：Deadline 近的在前、沒有的最後；同天看優先級；再看建立時間', () => {
    const tasks = [
      task({ id: 'nodate' }),
      task({ id: 'late', dueDate: '2026-10-20' }),
      task({ id: 'soon-mid', dueDate: '2026-10-08', priorityId: 'p2' }),
      task({ id: 'soon-high', dueDate: '2026-10-08', priorityId: 'p1' }),
      task({ id: 'soon-none-old', dueDate: '2026-10-08', createdAt: '2026-09-01T00:00:00.000Z' }),
    ];
    expect(sortBoard(tasks, priorities).map((t) => t.id)).toEqual([
      'soon-high',
      'soon-mid',
      'soon-none-old',
      'late',
      'nodate',
    ]);
  });

  it('待辦的排序選項：預設是 Deadline；也可以依優先級、狀態、最新建立', () => {
    const statuses = [opt('status', 's1', '未開始', 0), opt('status', 's2', '進行中', 1)];
    const tasks = [
      task({ id: 'a', dueDate: '2026-10-20', priorityId: 'p1', statusId: 's2', createdAt: '2026-09-01T00:00:00.000Z' }),
      task({ id: 'b', dueDate: '2026-10-08', priorityId: 'p2', statusId: 's1', createdAt: '2026-09-03T00:00:00.000Z' }),
      task({ id: 'c', priorityId: 'p1', createdAt: '2026-09-02T00:00:00.000Z' }),
    ];
    const ids = (sort?: Parameters<typeof sortBoard>[2]) =>
      sortBoard(tasks, priorities, sort, statuses).map((t) => t.id);
    expect(ids()).toEqual(['b', 'a', 'c']); // 預設：Deadline（沒有的最後）
    expect(ids('due')).toEqual(ids());
    expect(ids('priority')).toEqual(['a', 'c', 'b']); // 高優先在前；同級看 Deadline
    expect(ids('status')).toEqual(['b', 'a', 'c']); // 未開始、進行中，沒填的最後
    expect(ids('created')).toEqual(['b', 'c', 'a']); // 最新建立的在前
  });

  it('手動排序：位置小的在上面，還沒排過的排最後；拖曳只改被拖動的那一筆；新增的放分類最後', () => {
    const t = (id: string, sortOrder?: number, categoryId = 'c1') => task({ id, sortOrder, categoryId });
    const list = [t('c', 3), t('a'), t('b', 1), t('d', 2)];
    expect(sortBoard(list, priorities, 'manual').map((x) => x.id)).toEqual(['b', 'd', 'c', 'a']);

    const sorted = [t('a', 1), t('b', 2), t('c', 3)];
    const changed = moveItem(sorted, 'c', 'a');
    expect(changed.map((x) => [x.id, x.sortOrder])).toEqual([['c', 0]]);
    // 還沒排過的：依目前畫面順序重新編號
    expect(moveItem([t('x'), t('y'), t('z')], 'z', 'x').map((x) => [x.id, x.sortOrder])).toEqual([
      ['z', 1],
      ['x', 2],
      ['y', 3],
    ]);

    expect(nextTaskOrder([t('a', 4), t('b', 9, 'c2')], 'c1')).toBe(5);
    expect(nextTaskOrder([t('b', 9, 'c2')], 'c1')).toBe(1);
  });

  it('完成區：最近完成的在前', () => {
    const tasks = [
      task({ id: 'a', done: true, doneAt: '2026-10-01' }),
      task({ id: 'b', done: true, doneAt: '2026-10-05' }),
    ];
    expect(sortDone(tasks).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('排序不會改動傳進來的陣列', () => {
    const tasks = [task({ id: 'b', dueDate: '2026-10-09' }), task({ id: 'a', dueDate: '2026-10-08' })];
    sortBoard(tasks, priorities);
    expect(tasks.map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('直接在列上修改', () => {
  const NOW = new Date('2026-10-07T03:00:00.000Z');
  const priorities = [opt('priority', 'p1', '高', 0)];

  it('改負責人、Deadline、狀態；空字串＝清掉；同時更新 updatedAt', () => {
    const base = task({ ownerId: 'm1', dueDate: '2026-10-10', statusId: 's1' });
    const next = patchTask(base, { ownerId: '', dueDate: '2026-10-20', statusId: 's2' }, NOW);
    expect(next.ownerId).toBeUndefined();
    expect('ownerId' in next).toBe(false);
    expect(next.dueDate).toBe('2026-10-20');
    expect(next.statusId).toBe('s2');
    expect(next.updatedAt).toBe(NOW.toISOString());
    expect(base.ownerId).toBe('m1'); // 不改動原物件
  });

  it('只改傳進來的欄位，其他不動', () => {
    const base = task({ ownerId: 'm1', dueDate: '2026-10-10', note: '備註' });
    const next = patchTask(base, { statusId: 's1' }, NOW);
    expect(next).toMatchObject({ ownerId: 'm1', dueDate: '2026-10-10', note: '備註', statusId: 's1' });
  });

  it('被修改過的任務沿用修改前的值排序，列不會立刻跳位置；清掉 frozen 後才重排', () => {
    const a = task({ id: 'a', dueDate: '2026-10-08' });
    const b = task({ id: 'b', dueDate: '2026-10-09' });
    // 使用者把 a 的 Deadline 改到很後面
    const editedA = patchTask(a, { dueDate: '2026-12-01' }, NOW);
    const frozen = new Map([['a', a]]);

    expect(sortBoardStable([editedA, b], priorities, frozen).map((t) => t.id)).toEqual(['a', 'b']);
    // 回傳的是修改後的最新資料，只是位置沿用舊值
    expect(sortBoardStable([editedA, b], priorities, frozen)[0].dueDate).toBe('2026-12-01');
    expect(sortBoardStable([editedA, b], priorities, new Map()).map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('篩選與分組', () => {
  const tasks = [
    task({ id: '1', categoryId: 'c1', ownerId: 'm1' }),
    task({ id: '2', categoryId: 'c1', ownerId: 'm2' }),
    task({ id: '3', categoryId: 'c2' }),
  ];

  it('依負責人、分類、未指派篩選，條件可以疊加', () => {
    expect(filterTasks(tasks, {}).length).toBe(3);
    expect(filterTasks(tasks, { ownerId: 'm1' }).map((t) => t.id)).toEqual(['1']);
    expect(filterTasks(tasks, { categoryId: 'c1' }).map((t) => t.id)).toEqual(['1', '2']);
    expect(filterTasks(tasks, { ownerId: UNASSIGNED }).map((t) => t.id)).toEqual(['3']);
    expect(filterTasks(tasks, { categoryId: 'c1', ownerId: 'm2' }).map((t) => t.id)).toEqual(['2']);
  });

  it('依分類清單順序分組，空的分類不列出，找不到分類的任務歸在最後', () => {
    const categories = [opt('category', 'c3', '空的', 0), opt('category', 'c2', '行銷', 1), opt('category', 'c1', '業務', 2)];
    const groups = groupByCategory([...tasks, task({ id: '4', categoryId: 'gone' })], categories);
    expect(groups.map((g) => g.category?.name ?? '（已刪除）')).toEqual(['行銷', '業務', '（已刪除）']);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['1', '2']);
  });
});

describe('日曆', () => {
  it('2026 年 10 月：週日開頭，5 週，前後補上相鄰月份的日期', () => {
    const weeks = monthGrid(2026, 10);
    expect(weeks.length).toBe(5);
    expect(weeks[0][0]).toEqual({ date: '2026-09-27', inMonth: false });
    expect(weeks[0][4]).toEqual({ date: '2026-10-01', inMonth: true });
    expect(weeks[4][6]).toEqual({ date: '2026-10-31', inMonth: true });
    expect(weeks.flat().filter((d) => d.inMonth).length).toBe(31);
  });

  it('需要 6 週的月份', () => {
    // 2026 年 8 月 1 日是週六，31 天 → 6 週
    expect(monthGrid(2026, 8).length).toBe(6);
  });

  it('剛好 4 週的月份（2026 年 2 月）只顯示 4 週，不會多出一整排下個月的空白列', () => {
    const weeks = monthGrid(2026, 2); // 2026/2/1 週日，28 天
    expect(weeks.length).toBe(4);
    expect(weeks.every((w) => w.some((d) => d.inMonth))).toBe(true);
    expect(weeks.flat().filter((d) => d.inMonth).length).toBe(28);
  });

  it('上個月、下個月（跨年）', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 10, 0)).toEqual({ year: 2026, month: 10 });
  });

  it('依 Deadline 放進日期，沒有 Deadline 的不出現在日曆', () => {
    const map = tasksByDate([
      task({ id: 'a', dueDate: '2026-10-07' }),
      task({ id: 'b', dueDate: '2026-10-07', done: true }),
      task({ id: 'c' }),
    ]);
    expect(map.get('2026-10-07')?.map((t) => t.id)).toEqual(['a', 'b']);
    expect(map.size).toBe(1);
  });
});

describe('建立與修改任務', () => {
  const NOW = new Date('2026-10-07T03:00:00.000Z');

  it('新增：名稱去空白、空欄位不存、預設未完成', () => {
    const t = newTask({ name: '  寄報價單  ', categoryId: 'c1', ownerId: '', note: '  ' }, 'Tessy', NOW);
    expect(t.name).toBe('寄報價單');
    expect(t.ownerId).toBeUndefined();
    expect(t.note).toBeUndefined();
    expect(t.createdBy).toBe('Tessy');
    expect(t.done).toBe(false);
    expect(t.createdAt).toBe(NOW.toISOString());
  });

  it('編輯：更新欄位與 updatedAt，可以清掉 Deadline', () => {
    const base = task({ dueDate: '2026-10-10', ownerId: 'm1' });
    const next = editTask(base, { name: '新名稱', categoryId: 'c2', dueDate: '' }, NOW);
    expect(next.name).toBe('新名稱');
    expect(next.categoryId).toBe('c2');
    expect(next.dueDate).toBeUndefined();
    expect(next.ownerId).toBeUndefined();
    expect(next.updatedAt).toBe(NOW.toISOString());
    expect(next.createdAt).toBe(base.createdAt);
  });

  it('完成：記下完成日期與完成者；還原：清掉這兩項', () => {
    const done = completeTask(task(), 'Serina', new Date(2026, 9, 7, 10));
    expect(done).toMatchObject({ done: true, doneAt: '2026-10-07', doneBy: 'Serina' });
    const back = restoreTask(done, NOW);
    expect(back.done).toBe(false);
    expect('doneAt' in back).toBe(false);
    expect('doneBy' in back).toBe(false);
    expect(back.updatedAt).toBe(NOW.toISOString());
  });
});
