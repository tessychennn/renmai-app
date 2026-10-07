import { describe, expect, it } from 'vitest';
import { DEFAULT_TASK_OPTIONS } from '../data/defaultTaskOptions';
import { planLegacyImport } from './legacyImport';

const NOW = new Date('2026-10-07T00:00:00.000Z');

const legacy = {
  categories: ['業務開發', '新分類'],
  members: ['Tessy', 'Serina'],
  priorities: ['高', '中', '低'],
  statuses: ['未開始', '卡住'],
  tasks: [
    {
      id: 'ab12cd34',
      name: '寄報價單',
      category: '業務開發',
      owner: 'Tessy',
      due: '2026-10-15',
      priority: '高',
      status: '進行中',
      note: '給 A 公司',
      createdBy: 'Serina',
      createdAt: '2026-09-30 14:05',
      done: false,
      doneAt: null,
      doneBy: '',
    },
    {
      id: 'ef56ab78',
      name: '做海報',
      category: '新分類',
      owner: '',
      due: null,
      priority: '',
      status: '',
      note: '',
      createdBy: '',
      createdAt: '2026-09-01 09:00',
      done: true,
      doneAt: '2026-09-20',
      doneBy: 'Tessy',
    },
  ],
};

describe('匯入原試算表資料', () => {
  it('已存在同名的選項直接沿用，沒有的才新增', () => {
    const plan = planLegacyImport(legacy, DEFAULT_TASK_OPTIONS, new Set(), NOW);
    const names = plan.newOptions.map((o) => `${o.kind}:${o.name}`);
    expect(names).toEqual(['category:新分類']);
    // 「進行中」是預設狀態，「卡住」「未開始」也是 → 都沿用
    const task = plan.newTasks.find((t) => t.name === '寄報價單')!;
    expect(task.categoryId).toBe('opt-category-c0');
    expect(task.ownerId).toBe('opt-member-m0');
    expect(task.priorityId).toBe('opt-priority-p0');
    expect(task.statusId).toBe('opt-status-s1');
  });

  it('欄位轉換：日期、建立時間（台北時間轉 UTC）、完成資訊', () => {
    const plan = planLegacyImport(legacy, DEFAULT_TASK_OPTIONS, new Set(), NOW);
    const a = plan.newTasks.find((t) => t.name === '寄報價單')!;
    expect(a).toMatchObject({
      id: 'legacy-ab12cd34',
      dueDate: '2026-10-15',
      note: '給 A 公司',
      createdBy: 'Serina',
      createdAt: '2026-09-30T06:05:00.000Z',
      done: false,
    });
    expect(a.doneAt).toBeUndefined();
    const b = plan.newTasks.find((t) => t.name === '做海報')!;
    expect(b).toMatchObject({ done: true, doneAt: '2026-09-20', doneBy: 'Tessy' });
    expect(b.dueDate).toBeUndefined();
    expect(b.ownerId).toBeUndefined();
  });

  it('可以重複匯入：編號已存在的任務略過，不會蓋掉使用者之後的修改', () => {
    const first = planLegacyImport(legacy, DEFAULT_TASK_OPTIONS, new Set(), NOW);
    const again = planLegacyImport(
      legacy,
      [...DEFAULT_TASK_OPTIONS, ...first.newOptions],
      new Set(first.newTasks.map((t) => t.id)),
      NOW
    );
    expect(again.newTasks).toEqual([]);
    expect(again.newOptions).toEqual([]);
    expect(again.skippedExisting).toBe(2);
  });

  it('新增的選項編號是穩定的，重複匯入不會產生兩份', () => {
    const a = planLegacyImport(legacy, [], new Set(), NOW);
    const b = planLegacyImport(legacy, [], new Set(), NOW);
    expect(a.newOptions.map((o) => o.id)).toEqual(b.newOptions.map((o) => o.id));
    expect(new Set(a.newOptions.map((o) => o.id)).size).toBe(a.newOptions.length);
  });

  it('任務用到設定區沒列出的分類名稱：自動建立，不丟資料', () => {
    const plan = planLegacyImport(
      { tasks: [{ id: 'x1', name: 'A', category: '舊分類', createdAt: '' }] },
      [],
      new Set(),
      NOW
    );
    expect(plan.newOptions.map((o) => o.name)).toEqual(['舊分類']);
    expect(plan.newTasks.length).toBe(1);
    expect(plan.newTasks[0].createdAt).toBe(NOW.toISOString());
  });

  it('沒有名稱或沒有分類的資料略過並提醒', () => {
    const plan = planLegacyImport(
      {
        tasks: [
          { id: 'a', name: '', category: '業務開發' },
          { id: 'b', name: '沒分類', category: '' },
        ],
      },
      DEFAULT_TASK_OPTIONS,
      new Set(),
      NOW
    );
    expect(plan.newTasks).toEqual([]);
    expect(plan.warnings.length).toBe(2);
  });

  it('內容不對時給人看得懂的錯誤', () => {
    expect(() => planLegacyImport({ foo: 1 }, [], new Set(), NOW)).toThrow('找不到 tasks');
    expect(() => planLegacyImport(null, [], new Set(), NOW)).toThrow('找不到 tasks');
  });

  it('新增選項的順序接在現有選項後面', () => {
    const plan = planLegacyImport(legacy, DEFAULT_TASK_OPTIONS, new Set(), NOW);
    const newCategory = plan.newOptions.find((o) => o.name === '新分類')!;
    expect(newCategory.order).toBe(6); // 預設 6 個分類（0 到 5）
  });
});
