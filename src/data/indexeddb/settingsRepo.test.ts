import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { closeDB } from './db';
import { IndexedDBSettingsRepo } from './settingsRepo';

const repo = new IndexedDBSettingsRepo();

beforeEach(async () => {
  await closeDB();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('IndexedDBSettingsRepo', () => {
  it('尚未儲存時回傳空物件', async () => {
    expect(await repo.get()).toEqual({});
  });

  it('save 之後 get 拿得回設定', async () => {
    await repo.save({ currentOccasion: '2026 設計週', lastExportAt: '2026-09-04T00:00:00Z' });
    expect(await repo.get()).toEqual({
      currentOccasion: '2026 設計週',
      lastExportAt: '2026-09-04T00:00:00Z',
    });
  });
});
