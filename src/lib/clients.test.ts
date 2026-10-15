import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clientRepo,
  deletePersonWithPhotos,
  personRepo,
  syncLocal,
  taskOptionRepo,
  taskRepo,
} from '../data';
import { closeDB, getDB } from '../data/indexeddb/db';
import { ensureDefaultTaskOptions } from '../data/indexeddb/seedTaskOptions';
import type { Client, Person, Task } from '../data/types';
import {
  buildClient,
  clientChip,
  clientsByPerson,
  editClient,
  filterClients,
  migrateCollabToClients,
  migrateProspectTasks,
  migrateToClients,
  patchClient,
  removeClient,
  setClient,
  sortClients,
  toggleClientDone,
  UNASSIGNED,
} from './clients';
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

const client = (id: string, o: Partial<Client> = {}): Client => ({
  id: `client-${id}`,
  personId: id,
  done: false,
  createdAt: `2026-10-0${id.length}T00:00:00.000Z`,
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...o,
});

beforeEach(async () => {
  await closeDB();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  await ensureDefaultTaskOptions();
});

describe('建立與更新客戶', () => {
  it('第一次加入：編號由人物編號推出，帶上指定的狀態', async () => {
    const o = splitOptions(await taskOptionRepo.list());
    const contact = o.statuses.find((s) => s.name === '需聯繫')!;
    await setClient(person(), { statusId: contact.id });
    expect(await clientRepo.get('client-p1')).toMatchObject({ personId: 'p1', statusId: contact.id, done: false });
  });

  it('已存在：只改狀態，負責人、下次聯絡、備註保留', () => {
    const existing = client('p1', { ownerId: 'm1', dueDate: '2026-10-20', note: '報價中', statusId: 's1' });
    const next = buildClient(person(), { statusId: 's2' }, existing, NOW);
    expect(next).toMatchObject({ statusId: 's2', ownerId: 'm1', dueDate: '2026-10-20', note: '報價中' });
    expect(next.updatedAt).toBe(NOW.toISOString());
  });

  it('設為完成會記下完成日期；從完成改回其他狀態會取消完成；已完成再存不改完成日', () => {
    const base = buildClient(person(), { statusId: 's1' }, null, NOW);
    const done = buildClient(person(), { done: true }, base, NOW);
    expect(done).toMatchObject({ done: true, statusId: 's1', doneAt: '2026-10-07' });
    expect(buildClient(person(), { done: true }, done, new Date('2026-10-20T03:00:00Z')).doneAt).toBe('2026-10-07');
    const reopened = buildClient(person(), { statusId: 's2' }, done, NOW);
    expect(reopened.done).toBe(false);
    expect('doneAt' in reopened).toBe(false);
  });

  it('移出客戶後再加入：被刪掉的那筆會被新的取代', async () => {
    await setClient(person(), { statusId: 'opt-status-s0' });
    await removeClient('p1');
    expect(await clientRepo.get('client-p1')).toBeNull();
    await setClient(person(), { statusId: 'opt-status-s1' });
    expect((await clientRepo.get('client-p1'))?.statusId).toBe('opt-status-s1');
  });

  it('刪除人物時，客戶紀錄與舊的業務開發待辦都一併移除', async () => {
    await personRepo.save(person());
    await setClient(person(), { statusId: 'opt-status-s0' });
    await taskRepo.save({
      id: 'prospect-p1',
      name: '舊的',
      categoryId: 'opt-category-c0',
      createdAt: 'x',
      updatedAt: 'x',
      done: false,
    });
    await deletePersonWithPhotos('p1');
    expect(await clientRepo.get('client-p1')).toBeNull();
    expect(await taskRepo.get('prospect-p1')).toBeNull();
  });

  it('客戶不存名字，刪掉的客戶不留備註在墓碑裡', async () => {
    await clientRepo.save(client('p1', { note: '機密' }));
    await clientRepo.remove('client-p1');
    const raw = await (await getDB()).get('clients', 'client-p1');
    expect(raw?.deletedAt).toBeTruthy();
    expect(raw?.note).toBeUndefined();
    expect(Object.keys(raw ?? {})).not.toContain('name');
  });
});

describe('人物卡上的標籤', () => {
  it('依客戶狀態決定文字與色調', async () => {
    const statuses = splitOptions(await taskOptionRepo.list()).statuses;
    const idOf = (name: string) => statuses.find((s) => s.name === name)!.id;
    const base = client('p');
    const tone = (name: string) => clientChip({ ...base, statusId: idOf(name) }, statuses);
    expect(tone('未開始')).toEqual({ label: '未開始', tone: 'gray' });
    expect(tone('進行中')).toEqual({ label: '進行中', tone: 'green' });
    expect(tone('等回覆')).toEqual({ label: '等回覆', tone: 'yellow' });
    expect(tone('需聯繫')).toEqual({ label: '需聯繫', tone: 'red' });
    expect(tone('聯繫中')).toEqual({ label: '聯繫中', tone: 'purple' });
    expect(clientChip(base, statuses)).toEqual({ label: '客戶', tone: 'outline' });
    expect(clientChip({ ...base, done: true }, statuses)).toEqual({ label: '完成', tone: 'done' });
  });

  it('clientsByPerson 只含未刪除的', () => {
    const map = clientsByPerson([client('a'), client('b', { deletedAt: 'z' })]);
    expect([...map.keys()]).toEqual(['a']);
  });
});

describe('客戶頁的篩選、排序與修改', () => {
  const statuses = [
    { id: 's-contact', kind: 'status' as const, name: '需聯繫', order: 0, updatedAt: 'x' },
    { id: 's-ing', kind: 'status' as const, name: '聯繫中', order: 1, updatedAt: 'x' },
  ];

  it('篩選：狀態、負責人、未指派', () => {
    const list = [client('a', { ownerId: 'm1', statusId: 's-ing' }), client('bb', { statusId: 's-contact' })];
    expect(filterClients(list, { statusId: 's-ing' }).map((c) => c.personId)).toEqual(['a']);
    expect(filterClients(list, { ownerId: 'm1' }).map((c) => c.personId)).toEqual(['a']);
    expect(filterClients(list, { ownerId: UNASSIGNED }).map((c) => c.personId)).toEqual(['bb']);
  });

  it('排序：下次聯絡近的在前（沒有的最後），同日依狀態順序', () => {
    const list = [
      client('a', { statusId: 's-ing' }),
      client('bb', { dueDate: '2026-10-20', statusId: 's-ing' }),
      client('ccc', { dueDate: '2026-10-10' }),
      client('dddd', { dueDate: '2026-10-10', statusId: 's-contact' }),
    ];
    expect(sortClients(list, statuses).map((c) => c.personId)).toEqual(['dddd', 'ccc', 'bb', 'a']);
  });

  it('列上修改：空字串代表清掉，沒提到的欄位不動', () => {
    const c = client('a', { ownerId: 'm1', dueDate: '2026-10-10', statusId: 's-ing' });
    const next = patchClient(c, { ownerId: '', statusId: 's-contact' });
    expect('ownerId' in next).toBe(false);
    expect(next).toMatchObject({ statusId: 's-contact', dueDate: '2026-10-10' });
  });

  it('編輯面板：備註、下次聯絡去掉空白，空的不存', () => {
    const next = editClient(client('a', { note: '舊的' }), { statusId: 's-ing', note: '  新的  ', dueDate: '' });
    expect(next).toMatchObject({ statusId: 's-ing', note: '新的' });
    expect(next.dueDate).toBeUndefined();
  });

  it('打勾完成再按一次取消', () => {
    const done = toggleClientDone(client('a'), NOW);
    expect(done).toMatchObject({ done: true, doneAt: '2026-10-07' });
    const back = toggleClientDone(done, NOW);
    expect(back.done).toBe(false);
    expect('doneAt' in back).toBe(false);
  });
});

describe('把原本的「合作機會」搬成客戶', () => {
  it('狀態、負責人、備註都轉過去；完成的變成已完成', async () => {
    await personRepo.save(person({ id: 'a', displayName: '甲', collabStatus: 'contacting', collabOwner: 'Serina', collabNote: '週三視訊' }));
    await personRepo.save(person({ id: 'b', displayName: '乙', collabStatus: 'done' }));
    await personRepo.save(person({ id: 'c', displayName: '丙' })); // 沒標記

    expect(await migrateCollabToClients(NOW)).toBe(2);

    const o = splitOptions(await taskOptionRepo.list());
    expect(await clientRepo.get('client-a')).toMatchObject({
      personId: 'a',
      ownerId: o.members.find((m) => m.name === 'Serina')!.id,
      statusId: o.statuses.find((s) => s.name === '聯繫中')!.id,
      note: '週三視訊',
      done: false,
    });
    expect(await clientRepo.get('client-b')).toMatchObject({ done: true });
    expect(await clientRepo.get('client-c')).toBeNull();
  });

  it('可重複執行，不會重複建立；移出客戶之後不會又冒出來', async () => {
    await personRepo.save(person({ collabStatus: 'contact' }));
    expect(await migrateCollabToClients(NOW)).toBe(1);
    expect(await migrateCollabToClients(NOW)).toBe(0);
    await removeClient('p1');
    expect(await migrateCollabToClients(NOW)).toBe(0);
    expect(await syncLocal.getClient('client-p1')).toMatchObject({ deletedAt: expect.any(String) });
  });
});

describe('把「業務開發」裡的合作對象搬成客戶', () => {
  const prospectTask = (personId: string, o: Partial<Task> = {}): Task => ({
    id: `prospect-${personId}`,
    name: '王小明',
    categoryId: 'opt-category-c0',
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    done: false,
    ...o,
  });

  it('狀態、負責人、下次聯絡、備註、完成都帶過去，待辦本身被收掉', async () => {
    await personRepo.save(person());
    await taskRepo.save(
      prospectTask('p1', { statusId: 'opt-status-s4', ownerId: 'm1', dueDate: '2026-10-20', note: '報價中' })
    );
    await taskRepo.save(prospectTask('p2', { done: true, doneAt: '2026-10-01' }));
    await personRepo.save(person({ id: 'p2', displayName: '乙' }));
    await taskRepo.save({ ...prospectTask('x'), id: 'normal-task' }); // 一般待辦不動

    expect(await migrateProspectTasks(NOW)).toBe(2);

    expect(await clientRepo.get('client-p1')).toMatchObject({
      personId: 'p1',
      statusId: 'opt-status-s4',
      ownerId: 'm1',
      dueDate: '2026-10-20',
      note: '報價中',
      done: false,
    });
    expect(await clientRepo.get('client-p2')).toMatchObject({ done: true, doneAt: '2026-10-01' });
    expect(await taskRepo.get('prospect-p1')).toBeNull();
    expect(await taskRepo.get('prospect-p2')).toBeNull();
    expect(await taskRepo.get('normal-task')).not.toBeNull();
  });

  it('可重複執行；客戶已存在就只收掉待辦、不覆蓋客戶；人物已不在也收掉待辦', async () => {
    await personRepo.save(person());
    await clientRepo.save(client('p1', { note: '新的備註' }));
    await taskRepo.save(prospectTask('p1', { note: '舊的備註' }));
    await taskRepo.save(prospectTask('ghost')); // 對應的人不在了

    expect(await migrateProspectTasks(NOW)).toBe(0);
    expect((await clientRepo.get('client-p1'))?.note).toBe('新的備註');
    expect(await taskRepo.get('prospect-p1')).toBeNull();
    expect(await taskRepo.get('prospect-ghost')).toBeNull();
    expect(await clientRepo.get('client-ghost')).toBeNull();
    expect(await migrateProspectTasks(NOW)).toBe(0);
  });

  it('migrateToClients：舊的人物欄位與舊的待辦一起處理，同一個人不會建兩份', async () => {
    await personRepo.save(person({ id: 'a', collabStatus: 'contact' }));
    await personRepo.save(person({ id: 'b' }));
    await taskRepo.save(prospectTask('b', { note: '來自待辦' }));
    await taskRepo.save(prospectTask('a', { note: '待辦版本' })); // a 同時有舊欄位與待辦：以待辦為準

    expect(await migrateToClients(NOW)).toBe(2);
    expect((await clientRepo.get('client-a'))?.note).toBe('待辦版本');
    expect((await clientRepo.get('client-b'))?.note).toBe('來自待辦');
    expect((await clientRepo.list()).length).toBe(2);
  });
});
