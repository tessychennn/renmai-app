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
  clientName,
  clientsByPerson,
  editClient,
  filterClients,
  migrateClientStatuses,
  migrateCollabToClients,
  migrateProspectTasks,
  migrateToClients,
  moveItem,
  newStandaloneClient,
  nextClientOrder,
  patchClient,
  removeClient,
  setClient,
  sortClients,
  toggleClientDone,
  UNASSIGNED,
} from './clients';
import { splitOptions } from './tasks';
import { CLIENT_LEVELS, CLIENT_STATUSES } from '../text/clients';

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

  it('刪掉的客戶不留名字與備註在墓碑裡', async () => {
    await clientRepo.save(client('p1', { note: '機密' }));
    await clientRepo.remove('client-p1');
    const raw = await (await getDB()).get('clients', 'client-p1');
    expect(raw?.deletedAt).toBeTruthy();
    expect(raw?.note).toBeUndefined();
    expect(Object.keys(raw ?? {})).not.toContain('name');

    const standalone = newStandaloneClient({ name: '某某公司', note: '機密' }, NOW);
    await clientRepo.save(standalone);
    await clientRepo.remove(standalone.id);
    const raw2 = await (await getDB()).get('clients', standalone.id);
    expect(raw2?.deletedAt).toBeTruthy();
    expect(raw2?.name).toBeUndefined();
    expect(raw2?.note).toBeUndefined();
  });
});

describe('在客戶頁直接新增（不連結人脈記錄）', () => {
  it('自己存名字，編號是隨機的，兩個同名的也是兩筆；空白欄位不存', () => {
    const a = newStandaloneClient({ name: '  某某公司  ', statusId: 'need-contact', note: ' ', ownerId: '' }, NOW);
    const b = newStandaloneClient({ name: '某某公司' }, NOW);
    expect(a).toMatchObject({ name: '某某公司', statusId: 'need-contact', done: false });
    expect(a.personId).toBeUndefined();
    expect(a.note).toBeUndefined();
    expect(a.ownerId).toBeUndefined();
    expect(a.id).not.toBe(b.id);
    expect(a.id.startsWith('client-')).toBe(true);
  });

  it('名字：自己存的優先，連結的讀人物資料，人物不在了顯示提示', () => {
    const persons = new Map([['p1', { displayName: '王小明' }]]);
    expect(clientName(newStandaloneClient({ name: '某某公司' }, NOW), persons)).toBe('某某公司');
    expect(clientName(client('p1'), persons)).toBe('王小明');
    expect(clientName(client('ghost'), persons)).toBe('（已刪除的人）');
  });

  it('沒有連結人物的客戶不會出現在人物卡的標籤對照裡；可以改名，連結的不能', () => {
    const standalone = newStandaloneClient({ name: '某某公司' }, NOW);
    expect(clientsByPerson([standalone, client('a')]).size).toBe(1);
    expect(editClient(standalone, { name: '新名字', statusId: 'contacting' }).name).toBe('新名字');
    expect(editClient(client('a'), { name: '想改名', statusId: 'contacting' }).name).toBeUndefined();
  });

  it('客戶頁新增後同步與讀取：存得進去、讀得回來', async () => {
    const c = newStandaloneClient({ name: '某某公司', statusId: 'agreed', note: '已口頭答應' }, NOW);
    await clientRepo.save(c);
    expect(await clientRepo.get(c.id)).toMatchObject({ name: '某某公司', statusId: 'agreed' });
    expect((await (await getDB()).getAll('dirty')).map((d) => d.key)).toContain(`client:${c.id}`);
  });
});

describe('人物卡上的標籤', () => {
  it('客戶的狀態只有需聯繫、聯繫中、答應加入、後續處理四個，各有固定顏色', () => {
    expect(CLIENT_STATUSES.map((s) => s.name)).toEqual(['需聯繫', '聯繫中', '答應加入', '後續處理']);
    const base = client('p');
    const tone = (id: string) => clientChip({ ...base, statusId: id });
    expect(tone('need-contact')).toEqual({ label: '需聯繫', tone: 'red' });
    expect(tone('contacting')).toEqual({ label: '聯繫中', tone: 'purple' });
    expect(tone('agreed')).toEqual({ label: '答應加入', tone: 'green' });
    expect(tone('follow-up')).toEqual({ label: '後續處理', tone: 'blue' });
    expect(clientChip(base)).toEqual({ label: '客戶', tone: 'outline' });
    expect(clientChip({ ...base, statusId: 'unknown' })).toEqual({ label: '客戶', tone: 'outline' });
    expect(clientChip({ ...base, done: true })).toEqual({ label: '完成', tone: 'done' });
  });

  it('clientsByPerson 只含未刪除的', () => {
    const map = clientsByPerson([client('a'), client('b', { deletedAt: 'z' })]);
    expect([...map.keys()]).toEqual(['a']);
  });
});

describe('客戶頁的篩選、排序與修改', () => {
  it('篩選：狀態、負責人、未指派', () => {
    const list = [client('a', { ownerId: 'm1', statusId: 'contacting' }), client('bb', { statusId: 'need-contact' })];
    expect(filterClients(list, { statusId: 'contacting' }).map((c) => c.personId)).toEqual(['a']);
    expect(filterClients(list, { ownerId: 'm1' }).map((c) => c.personId)).toEqual(['a']);
    expect(filterClients(list, { ownerId: UNASSIGNED }).map((c) => c.personId)).toEqual(['bb']);
  });

  it('排序（依下次聯絡）：近的在前（沒有的最後），同日依等級、狀態順序', () => {
    const list = [
      client('a', { statusId: 'contacting' }),
      client('bb', { dueDate: '2026-10-20', statusId: 'contacting' }),
      client('ccc', { dueDate: '2026-10-10' }),
      client('dddd', { dueDate: '2026-10-10', statusId: 'need-contact' }),
      client('eeeee', { dueDate: '2026-10-10', level: 'important' }),
    ];
    expect(sortClients(list, 'due').map((c) => c.personId)).toEqual(['eeeee', 'dddd', 'ccc', 'bb', 'a']);
  });

  it('排序（預設依重要等級）：重要在潛在上面，沒設定的最後；同級再依下次聯絡', () => {
    const list = [
      client('a'), // 沒設定等級
      client('bb', { level: 'potential', dueDate: '2026-10-05' }),
      client('ccc', { level: 'important', dueDate: '2026-10-20' }),
      client('dddd', { level: 'important', dueDate: '2026-10-10' }),
      client('eeeee', { level: 'potential' }),
    ];
    expect(sortClients(list).map((c) => c.personId)).toEqual(['dddd', 'ccc', 'bb', 'eeeee', 'a']);
    expect(sortClients(list, 'level')).toEqual(sortClients(list));
  });

  it('手動排序：位置小的在上面；還沒排過的排後面（先照重要等級）；都沒排過時就是重要等級的順序', () => {
    const list = [
      client('a', { level: 'potential' }),
      client('bb', { level: 'important' }),
      client('ccc'),
    ];
    expect(sortClients(list, 'manual').map((c) => c.personId)).toEqual(sortClients(list, 'level').map((c) => c.personId));
    const ordered = [client('a', { sortOrder: 2 }), client('bb', { sortOrder: 1 }), client('ccc', { level: 'important' })];
    expect(sortClients(ordered, 'manual').map((c) => c.personId)).toEqual(['bb', 'a', 'ccc']);
  });

  it('拖曳排序：只改被拖動的那一筆；新增的客戶只有在已經手動排過時才放最後', () => {
    const list = [client('a', { sortOrder: 1 }), client('bb', { sortOrder: 2 }), client('ccc', { sortOrder: 3 })];
    const changed = moveItem(list, 'client-ccc', 'client-bb');
    expect(changed.map((c) => [c.personId, c.sortOrder])).toEqual([['ccc', 1.5]]);
    expect(nextClientOrder(list)).toBe(4);
    expect(nextClientOrder([client('x'), client('y', { deletedAt: 'z', sortOrder: 9 })])).toBeUndefined();
  });

  it('等級：清單只有重要與潛在；可以在列上改、改成未設定、在新增時帶上', () => {
    expect(CLIENT_LEVELS.map((l) => l.name)).toEqual(['重要', '潛在']);
    const c = client('a', { level: 'potential' });
    expect(patchClient(c, { level: 'important' }).level).toBe('important');
    expect('level' in patchClient(c, { level: '' })).toBe(false);
    expect(editClient(c, { level: 'important', statusId: 'contacting' }).level).toBe('important');
    expect(newStandaloneClient({ name: '某某公司', level: 'important' }, NOW).level).toBe('important');
    expect(newStandaloneClient({ name: '某某公司' }, NOW).level).toBeUndefined();
  });

  it('列上修改：空字串代表清掉，沒提到的欄位不動', () => {
    const c = client('a', { ownerId: 'm1', dueDate: '2026-10-10', statusId: 'contacting' });
    const next = patchClient(c, { ownerId: '', statusId: 'need-contact' });
    expect('ownerId' in next).toBe(false);
    expect(next).toMatchObject({ statusId: 'need-contact', dueDate: '2026-10-10' });
  });

  it('編輯面板：備註、下次聯絡去掉空白，空的不存', () => {
    const next = editClient(client('a', { note: '舊的' }), { statusId: 'contacting', note: '  新的  ', dueDate: '' });
    expect(next).toMatchObject({ statusId: 'contacting', note: '新的' });
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
      statusId: 'contacting',
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
      statusId: 'need-contact', // 舊的待辦狀態「需聯繫」轉成客戶的需聯繫
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

describe('客戶狀態改成固定的四個：舊的待辦狀態轉過去', () => {
  it('需聯繫／未開始→需聯繫，聯繫中／進行中／等回覆→聯繫中；對不上的變成未設定；新的與認不得的編號不動', async () => {
    const o = splitOptions(await taskOptionRepo.list());
    const idOf = (name: string) => o.statuses.find((s) => s.name === name)!.id;
    await clientRepo.saveMany([
      client('a', { statusId: idOf('需聯繫') }),
      client('bb', { statusId: idOf('未開始') }),
      client('ccc', { statusId: idOf('聯繫中') }),
      client('dddd', { statusId: idOf('進行中') }),
      client('eeeee', { statusId: idOf('等回覆') }),
      client('ffffff', { statusId: 'agreed' }), // 已經是新的
      client('ggggggg', { statusId: 'removed-from-list' }), // 之後從清單拿掉的：不要默默清掉
    ]);
    // 舊的「已約時間」之類不在預設選項裡：用一個自訂的舊選項模擬
    await taskOptionRepo.save({ id: 'old-custom', kind: 'status', name: '已約時間', order: 9, updatedAt: '2026-10-01T00:00:00.000Z' });
    await clientRepo.save(client('hhhhhhhh', { statusId: 'old-custom' }));

    expect(await migrateClientStatuses(NOW)).toBe(6);
    const status = async (id: string) => (await clientRepo.get(`client-${id}`))?.statusId;
    expect(await status('a')).toBe('need-contact');
    expect(await status('bb')).toBe('need-contact');
    expect(await status('ccc')).toBe('contacting');
    expect(await status('dddd')).toBe('contacting');
    expect(await status('eeeee')).toBe('contacting');
    expect(await status('ffffff')).toBe('agreed');
    expect(await status('ggggggg')).toBe('removed-from-list');
    expect(await status('hhhhhhhh')).toBeUndefined();
    expect(await migrateClientStatuses(NOW)).toBe(0); // 可重複執行
  });
});
