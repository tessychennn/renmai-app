import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDB } from './db';
import { IndexedDBPhotoRepo } from './photoRepo';
import type { Person } from '../types';

// canvas 在 Node 環境不存在，壓縮邏輯以假實作代替（image.ts 的行為屬於瀏覽器整合測試範圍）
vi.mock('../../lib/image', () => ({
  compressImage: vi.fn(async () => ({
    blob: new Blob(['full'], { type: 'image/jpeg' }),
    width: 1600,
    height: 900,
  })),
  makeThumbnail: vi.fn(async () => new Blob(['thumb'], { type: 'image/jpeg' })),
}));

const createObjectURL = vi.fn((_blob: Blob) => `blob:mock-${createObjectURL.mock.calls.length}`);
const revokeObjectURL = vi.fn();
URL.createObjectURL = createObjectURL;
URL.revokeObjectURL = revokeObjectURL;

const repo = new IndexedDBPhotoRepo();

beforeEach(async () => {
  await closeDB();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

describe('IndexedDBPhotoRepo', () => {
  it('put 後 getURL 分別取得完整版與縮圖', async () => {
    const id = await repo.put(new Blob(['raw']));

    await repo.getURL(id);
    await repo.getURL(id, 'thumb');

    const fullArg = createObjectURL.mock.calls[0][0];
    const thumbArg = createObjectURL.mock.calls[1][0];
    expect(await fullArg.text()).toBe('full');
    expect(await thumbArg.text()).toBe('thumb');
  });

  it('getURL 不存在的 id 會拋錯', async () => {
    await expect(repo.getURL('nope')).rejects.toThrow();
  });

  it('releaseURL 呼叫 revokeObjectURL', () => {
    repo.releaseURL('blob:mock-0');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-0');
  });

  it('remove 之後 getURL 拋錯', async () => {
    const id = await repo.put(new Blob(['raw']));
    await repo.remove(id);
    await expect(repo.getURL(id)).rejects.toThrow();
  });
});

describe('deletePersonWithPhotos', () => {
  it('刪除人物時一併刪除其照片', async () => {
    const { deletePersonWithPhotos, personRepo } = await import('../index');
    const photoId = await repo.put(new Blob(['raw']));
    const now = new Date().toISOString();
    const person: Person = {
      id: 'p1',
      displayName: '王小明',
      photoIds: [photoId],
      groupIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await personRepo.save(person);

    await deletePersonWithPhotos('p1');

    expect(await personRepo.get('p1')).toBeNull();
    await expect(repo.getURL(photoId)).rejects.toThrow();
  });
});
