import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { deletePersonWithPhotos, personRepo, syncLocal, taskOptionRepo, taskRepo } from '../data';
import { closeDB } from '../data/indexeddb/db';
import { ensureDefaultTaskOptions } from '../data/indexeddb/seedTaskOptions';
import { personIdOfTask, prospectTaskId } from '../data/prospectId';
import type { Person, Task } from '../data/types';
import {
  buildProspectTask,
  findBusinessCategoryId,
  migrateCollabToTasks,
  prospectChip,
  prospectsByPerson,
  removeProspect,
  setProspect,
} from './prospects';
import { splitOptions } from './tasks';

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: 'p1',
    displayName: '王小明',
    photoIds: [],
    groupIds: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const NOW = new Date('2026-10-07T03:00:00.000Z');

beforeEach(async () => {
  await closeDB();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  await ensureDefaultTaskOptions();
});

describe('任務編號與人物編號互相推得出來', () => {
  it('prospectTaskId ↔ personIdOfTask', () => {
    expect(prospectTaskId('abc')).toBe('prospect-abc');
    expect(personIdOfTask('prospect-abc')).toBe('abc');
    expect(personIdOfTask('some-other-task')).toBeUndefined();
  });
});

describe('建立與更新合作對象的待辦', () => {
  it('第一次加入：用人物名稱建立任務，放在業務開發，帶上指定的狀態', async () => {
    const o = splitOptions(await taskOptionRepo.list());
    const contact = o.statuses.find((s) => s.name === '需聯繫')!;
    await setProspect(person(), { statusId: contact.id });

    const task = (await taskRepo.get('prospect-p1'))!;
    expect(task).toMatchObject({ name: '王小明', categoryId: 'opt-category-c0', statusId: contact.id, done: false });
  });

  it('已存在：只改狀態，負責人、Deadline、備註保留', () => {
    const existing: Task = {
      id: 'prospect-p1',
      name: '王小明',
      categoryId: 'c',
      ownerId: 'm1',
      dueDate: '2026-10-20',
      note: '報價中',
      statusId: 's1',
      createdAt: 'x',
      updatedAt: 'x',
      done: false,
    };
    const next = buildProspectTask(person(), 'c', { statusId: 's2' }, existing, NOW);
    expect(next).toMatchObject({ statusId: 's2', ownerId: 'm1', dueDate: '2026-10-20', note: '報價中' });
    expect(next.updatedAt).toBe(NOW.toISOString());
  });

  it('設為完成會記下完成日期；從完成改回其他狀態會取消完成', () => {
    const base = buildProspectTask(person(), 'c', { statusId: 's1' }, null, NOW);
    const done = buildProspectTask(person(), 'c', { done: true }, base, NOW);
    expect(done).toMatchObject({ done: true, statusId: 's1' });
    expect(done.doneAt).toBeTruthy();
    const reopened = buildProspectTask(person(), 'c', { statusId: 's2' }, done, NOW);
    expect(reopened.done).toBe(false);
    expect('doneAt' in reopened).toBe(false);
  });

  it('移出業務開發後再加入：被刪掉的那筆會被新的取代', async () => {
    await setProspect(person(), { statusId: 'opt-status-s0' });
    await removeProspect('p1');
    expect(await taskRepo.get('prospect-p1')).toBeNull();
    await setProspect(person(), { statusId: 'opt-status-s1' });
    expect((await taskRepo.get('prospect-p1'))?.statusId).toBe('opt-status-s1');
  });

  it('沒有任何分類時給人看得懂的錯誤', async () => {
    for (const c of await taskOptionRepo.list('category')) await taskOptionRepo.remove(c.id);
    await expect(setProspect(person(), { statusId: 'x' })).rejects.toThrow('分類');
  });

  it('刪除人物時，對應的待辦也一併移除', async () => {
    await personRepo.save(person());
    await setProspect(person(), { statusId: 'opt-status-s0' });
    await deletePersonWithPhotos('p1');
    expect(await taskRepo.get('prospect-p1')).toBeNull();
  });
});

describe('找業務開發分類', () => {
  it('優先預設編號，其次名稱，最後第一個', () => {
    const cat = (id: string, name: string, order: number) => ({
      id,
      kind: 'category' as const,
      name,
      order,
      updatedAt: 'x',
    });
    expect(findBusinessCategoryId([cat('z', '行銷', 0), cat('opt-category-c0', '改過名', 1)])).toBe('opt-category-c0');
    expect(findBusinessCategoryId([cat('z', '行銷', 0), cat('y', '業務開發', 1)])).toBe('y');
    expect(findBusinessCategoryId([cat('z', '行銷', 0)])).toBe('z');
    expect(findBusinessCategoryId([])).toBeUndefined();
  });
});

describe('人物卡上的標籤', () => {
  it('依待辦狀態決定文字與色調', async () => {
    const statuses = splitOptions(await taskOptionRepo.list()).statuses;
    const idOf = (name: string) => statuses.find((s) => s.name === name)!.id;
    const base: Task = { id: 'prospect-p', name: 'x', categoryId: 'c', createdAt: 'a', updatedAt: 'a', done: false };
    expect(prospectChip({ ...base, statusId: idOf('需聯繫') }, statuses)).toEqual({ label: '需聯繫', tone: 'alert' });
    expect(prospectChip({ ...base, statusId: idOf('已約時間') }, statuses)).toEqual({ label: '已約時間', tone: 'strong' });
    expect(prospectChip({ ...base, statusId: idOf('聯繫中') }, statuses)).toEqual({ label: '聯繫中', tone: 'outline' });
    expect(prospectChip(base, statuses)).toEqual({ label: '業務開發', tone: 'outline' });
    expect(prospectChip({ ...base, done: true }, statuses)).toEqual({ label: '完成', tone: 'done' });
  });

  it('prospectsByPerson 只認 prospect- 開頭、未刪除的待辦', () => {
    const t = (id: string, extra: Partial<Task> = {}): Task => ({
      id,
      name: 'x',
      categoryId: 'c',
      createdAt: 'a',
      updatedAt: 'a',
      done: false,
      ...extra,
    });
    const map = prospectsByPerson([t('prospect-a'), t('prospect-b', { deletedAt: 'z' }), t('normal')]);
    expect([...map.keys()]).toEqual(['a']);
  });
});

describe('把原本的「合作機會」搬成業務開發的待辦', () => {
  it('狀態、負責人、備註都轉過去；完成的變成已完成', async () => {
    await personRepo.save(person({ id: 'a', displayName: '甲', collabStatus: 'contacting', collabOwner: 'Serina', collabNote: '週三視訊' }));
    await personRepo.save(person({ id: 'b', displayName: '乙', collabStatus: 'done' }));
    await personRepo.save(person({ id: 'c', displayName: '丙' })); // 沒標記

    expect(await migrateCollabToTasks(NOW)).toBe(2);

    const o = splitOptions(await taskOptionRepo.list());
    const a = (await taskRepo.get('prospect-a'))!;
    expect(a).toMatchObject({
      name: '甲',
      categoryId: 'opt-category-c0',
      ownerId: o.members.find((m) => m.name === 'Serina')!.id,
      statusId: o.statuses.find((s) => s.name === '聯繫中')!.id,
      note: '週三視訊',
      done: false,
    });
    expect(await taskRepo.get('prospect-b')).toMatchObject({ done: true });
    expect(await taskRepo.get('prospect-c')).toBeNull();
  });

  it('可重複執行，不會重複建立', async () => {
    await personRepo.save(person({ collabStatus: 'contact' }));
    expect(await migrateCollabToTasks(NOW)).toBe(1);
    expect(await migrateCollabToTasks(NOW)).toBe(0);
    expect((await taskRepo.list()).length).toBe(1);
  });

  it('使用者把待辦刪掉之後不會又冒出來（人物上的舊欄位還在也一樣）', async () => {
    await personRepo.save(person({ collabStatus: 'contact' }));
    await migrateCollabToTasks(NOW);
    await taskRepo.remove('prospect-p1');
    expect(await migrateCollabToTasks(NOW)).toBe(0);
    expect(await taskRepo.get('prospect-p1')).toBeNull();
    expect(await syncLocal.getTask('prospect-p1')).toMatchObject({ deletedAt: expect.any(String) });
  });
});
