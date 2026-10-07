import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import { closeDB, getDB } from './db';

beforeEach(async () => {
  await closeDB();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('資料庫 v1 → v2 升級', () => {
  it('保留既有人物、照片、設定，並替分組補上 updatedAt', async () => {
    const v1 = await openDB('renmai', 1, {
      upgrade(db) {
        const persons = db.createObjectStore('persons', { keyPath: 'id' });
        persons.createIndex('by-occasion', 'occasion');
        persons.createIndex('by-updatedAt', 'updatedAt');
        db.createObjectStore('groups', { keyPath: 'id' });
        db.createObjectStore('photos', { keyPath: 'id' });
        db.createObjectStore('settings');
      },
    });
    const person = {
      id: 'p1',
      displayName: '王小明',
      photoIds: ['ph1'],
      groupIds: ['g1'],
      occasion: '2026 設計週',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    await v1.put('persons', person);
    await v1.put('groups', { id: 'g1', name: '設計圈', color: '#5B8DEF', order: 0 });
    await v1.put('photos', {
      id: 'ph1',
      blob: new Blob(['full']),
      thumbBlob: new Blob(['thumb']),
      width: 100,
      height: 100,
      createdAt: '2026-09-01T00:00:00.000Z',
    });
    await v1.put('settings', { currentOccasion: '2026 設計週' }, 'app');
    v1.close();

    const db = await getDB();

    expect(db.version).toBe(3);
    expect(await db.get('persons', 'p1')).toEqual(person);
    expect((await db.get('photos', 'ph1'))?.width).toBe(100);
    expect(await db.get('settings', 'app')).toEqual({ currentOccasion: '2026 設計週' });

    const group = await db.get('groups', 'g1');
    expect(group?.name).toBe('設計圈');
    expect(group?.updatedAt).toBeTruthy();

    expect([...db.objectStoreNames]).toEqual(
      expect.arrayContaining([
        'dirty',
        'syncMeta',
        'persons',
        'groups',
        'photos',
        'settings',
        'tasks',
        'taskOptions',
      ])
    );
  });

  it('全新安裝直接建立 v3 結構', async () => {
    const db = await getDB();
    expect(db.version).toBe(3);
    expect([...db.objectStoreNames]).toEqual(
      expect.arrayContaining([
        'dirty',
        'syncMeta',
        'persons',
        'groups',
        'photos',
        'settings',
        'tasks',
        'taskOptions',
      ])
    );
  });

  it('從 v2（已有同步用的 dirty、syncMeta）升級到 v3：既有資料不動，新增待辦的資料表', async () => {
    const v2 = await openDB('renmai', 2, {
      upgrade(db) {
        db.createObjectStore('persons', { keyPath: 'id' });
        db.createObjectStore('groups', { keyPath: 'id' });
        db.createObjectStore('photos', { keyPath: 'id' });
        db.createObjectStore('settings');
        db.createObjectStore('syncMeta');
        db.createObjectStore('dirty', { keyPath: 'key' });
      },
    });
    await v2.put('persons', { id: 'p1', displayName: '王小明', photoIds: [], groupIds: [], createdAt: 'x', updatedAt: 'x' });
    await v2.put('dirty', { key: 'person:p1', kind: 'person', id: 'p1' });
    await v2.put('syncMeta', true, 'cloudInitialized');
    v2.close();

    const db = await getDB();

    expect(db.version).toBe(3);
    expect((await db.get('persons', 'p1'))?.displayName).toBe('王小明');
    expect(await db.get('dirty', 'person:p1')).toBeTruthy();
    expect(await db.get('syncMeta', 'cloudInitialized')).toBe(true);
    expect([...db.objectStoreNames]).toEqual(expect.arrayContaining(['tasks', 'taskOptions']));
  });
});
