import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { closeDB } from './db';
import { IndexedDBGroupRepo } from './groupRepo';
import { IndexedDBPersonRepo } from './personRepo';
import type { Group, Person } from '../types';

const groupRepo = new IndexedDBGroupRepo();
const personRepo = new IndexedDBPersonRepo();

function makeGroup(overrides: Partial<Group> = {}): Group {
  return { id: crypto.randomUUID(), name: '設計圈', color: '#5B8DEF', order: 0, ...overrides };
}

function makePerson(overrides: Partial<Person> = {}): Person {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    displayName: '王小明',
    photoIds: [],
    groupIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(async () => {
  await closeDB();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('IndexedDBGroupRepo', () => {
  it('list 依 order 排序', async () => {
    await groupRepo.save(makeGroup({ id: 'b', order: 2 }));
    await groupRepo.save(makeGroup({ id: 'a', order: 1 }));
    expect((await groupRepo.list()).map((g) => g.id)).toEqual(['a', 'b']);
  });

  it('remove 會同步移除人物身上的 groupId 引用', async () => {
    await groupRepo.save(makeGroup({ id: 'g1' }));
    await personRepo.save(makePerson({ id: 'p1', groupIds: ['g1', 'g2'] }));

    await groupRepo.remove('g1');

    expect((await groupRepo.list()).length).toBe(0);
    expect((await personRepo.get('p1'))?.groupIds).toEqual(['g2']);
  });
});
