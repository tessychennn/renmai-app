import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deletePersonWithPhotos } from '../data';
import { closeDB, getDB } from '../data/indexeddb/db';
import { IndexedDBGroupRepo } from '../data/indexeddb/groupRepo';
import { IndexedDBPersonRepo } from '../data/indexeddb/personRepo';
import { IndexedDBPhotoRepo, setPhotoTransport } from '../data/indexeddb/photoRepo';
import { IndexedDBSyncLocal } from '../data/indexeddb/syncLocal';
import type { Group, Person } from '../data/types';
import { runSync } from './engine';
import type { RemoteStore } from './types';

// canvas 在 Node 環境不存在；壓縮結果以「原內容＋標記」代替，方便辨認是哪一種尺寸
vi.mock('../lib/image', () => ({
  compressImage: vi.fn(async (b: Blob) => ({
    blob: new Blob([`${await b.text()}|full`], { type: 'image/jpeg' }),
    width: 1600,
    height: 900,
  })),
  makeThumbnail: vi.fn(async (b: Blob) => new Blob([`${await b.text()}|thumb`], { type: 'image/jpeg' })),
  readImageSize: vi.fn(async () => ({ width: 1600, height: 900 })),
}));

const createdURLs: Blob[] = [];
URL.createObjectURL = (blob: Blob | MediaSource) => {
  createdURLs.push(blob as Blob);
  return `blob:mock-${createdURLs.length}`;
};
URL.revokeObjectURL = () => undefined;

class FakeRemote implements RemoteStore {
  persons = new Map<string, Person>();
  groups = new Map<string, Group>();
  photos = new Map<string, { full: Blob; thumb: Blob }>();
  downloads: string[] = [];
  failPuts = false;
  failList = false;

  async listPersons() {
    if (this.failList) throw new TypeError('Failed to fetch');
    return [...this.persons.values()].map((p) => structuredClone(p));
  }
  async listGroups() {
    if (this.failList) throw new TypeError('Failed to fetch');
    return [...this.groups.values()].map((g) => structuredClone(g));
  }
  async putPerson(p: Person) {
    if (this.failPuts) throw new Error('network down');
    this.persons.set(p.id, structuredClone(p));
  }
  async putGroup(g: Group) {
    if (this.failPuts) throw new Error('network down');
    this.groups.set(g.id, structuredClone(g));
  }
  async uploadPhoto(id: string, full: Blob, thumb: Blob) {
    this.photos.set(id, { full, thumb });
  }
  async downloadPhoto(id: string, variant: 'full' | 'thumb') {
    this.downloads.push(`${id}:${variant}`);
    const entry = this.photos.get(id);
    return entry ? entry[variant === 'full' ? 'full' : 'thumb'] : null;
  }
  async deletePhotos(ids: string[]) {
    for (const id of ids) this.photos.delete(id);
  }
}

const personRepo = new IndexedDBPersonRepo();
const groupRepo = new IndexedDBGroupRepo();
const photoRepo = new IndexedDBPhotoRepo();
const local = new IndexedDBSyncLocal();

let remote: FakeRemote;
let devices: Record<string, IDBFactory>;

async function useDevice(name: string) {
  await closeDB();
  devices[name] ??= new IDBFactory();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = devices[name];
  setPhotoTransport({ download: (id, variant) => remote.downloadPhoto(id, variant) });
}

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

const syncNow = () => runSync(local, remote);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-10T00:00:00.000Z'));
  remote = new FakeRemote();
  devices = {};
  createdURLs.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('雲端同步', () => {
  it('A 新增的人與照片，B 同步後看得到；縮圖先下載，完整版點開才下載', async () => {
    await useDevice('A');
    const photoId = await photoRepo.put(new Blob(['card']));
    await personRepo.save(person({ photoIds: [photoId], avatarPhotoId: photoId }));
    const up = await syncNow();
    expect(up.errors).toEqual([]);
    expect(remote.persons.get('p1')?.displayName).toBe('王小明');
    expect(remote.photos.has(photoId)).toBe(true);

    await useDevice('B');
    const down = await syncNow();
    expect(down.photosDownloaded).toBe(1);
    expect((await personRepo.get('p1'))?.displayName).toBe('王小明');
    expect(remote.downloads).toEqual([`${photoId}:thumb`]);

    // 列表用縮圖：不需要再下載
    await photoRepo.getURL(photoId, 'thumb');
    expect(remote.downloads).toEqual([`${photoId}:thumb`]);

    // 詳細頁要完整版：這時才下載，且只下載一次
    await photoRepo.getURL(photoId, 'full');
    await photoRepo.getURL(photoId, 'full');
    expect(remote.downloads).toEqual([`${photoId}:thumb`, `${photoId}:full`]);
    expect(await createdURLs.at(-1)!.text()).toBe('card|full');
  });

  it('兩人同時編輯同一筆：updatedAt 較新的整筆勝出，兩邊最後一致', async () => {
    await useDevice('A');
    await personRepo.save(person());
    await syncNow();
    await useDevice('B');
    await syncNow();

    await useDevice('A');
    await personRepo.save(person({ note: 'A 的修改', updatedAt: '2026-09-02T00:00:00.000Z' }));
    await useDevice('B');
    await personRepo.save(person({ note: 'B 的修改', updatedAt: '2026-09-03T00:00:00.000Z' }));

    // B 先同步：雲端還是舊的，B 的版本上去
    await syncNow();
    // A 再同步：雲端的 B 版本較新，A 的修改被取代
    await useDevice('A');
    await syncNow();

    expect((await personRepo.get('p1'))?.note).toBe('B 的修改');
    expect(remote.persons.get('p1')?.note).toBe('B 的修改');
  });

  it('合作狀態、負責人、備註會同步到另一支手機；移出列表後也同步', async () => {
    await useDevice('A');
    await personRepo.save(person());
    await syncNow();
    await useDevice('B');
    await syncNow();

    // B 標記成「聯絡中」並指定負責人
    await personRepo.save(
      person({
        collabStatus: 'contacting',
        collabOwner: 'Serina',
        collabNote: '下週三視訊',
        updatedAt: '2026-09-05T00:00:00.000Z',
      })
    );
    await syncNow();
    expect(remote.persons.get('p1')).toMatchObject({
      collabStatus: 'contacting',
      collabOwner: 'Serina',
      collabNote: '下週三視訊',
    });

    await useDevice('A');
    await syncNow();
    expect(await personRepo.get('p1')).toMatchObject({
      collabStatus: 'contacting',
      collabOwner: 'Serina',
      collabNote: '下週三視訊',
    });

    // A 把他移出合作列表
    await personRepo.save(person({ updatedAt: '2026-09-06T00:00:00.000Z' }));
    await syncNow();
    await useDevice('B');
    await syncNow();
    const afterRemove = await personRepo.get('p1');
    expect(afterRemove?.collabStatus).toBeUndefined();
    expect(afterRemove?.collabNote).toBeUndefined();
  });

  it('本機較新的資料不會被較舊的雲端版本蓋掉', async () => {
    await useDevice('A');
    await personRepo.save(person({ note: '雲端舊版', updatedAt: '2026-09-02T00:00:00.000Z' }));
    await syncNow();

    await personRepo.save(person({ note: '本機新版', updatedAt: '2026-09-05T00:00:00.000Z' }));
    await syncNow();

    expect((await personRepo.get('p1'))?.note).toBe('本機新版');
    expect(remote.persons.get('p1')?.note).toBe('本機新版');
  });

  it('A 刪除人物後：B 同步就消失、本機照片被清掉、雲端墓碑不含個資、雲端照片被刪', async () => {
    await useDevice('A');
    const photoId = await photoRepo.put(new Blob(['card']));
    await personRepo.save(
      person({
        photoIds: [photoId],
        note: '私人備註',
        lineName: 'wang_xm',
        occasion: '設計週',
        collabStatus: 'contacting',
        collabOwner: 'Tessy',
        collabNote: '報價中',
      })
    );
    await syncNow();
    await useDevice('B');
    await syncNow();
    expect(await personRepo.get('p1')).not.toBeNull();

    vi.setSystemTime(new Date('2026-09-11T00:00:00.000Z'));
    await useDevice('A');
    await deletePersonWithPhotos('p1');
    await syncNow();

    const tombstone = remote.persons.get('p1')!;
    expect(tombstone.deletedAt).toBeTruthy();
    expect(tombstone.note).toBeUndefined();
    expect(tombstone.lineName).toBeUndefined();
    expect(tombstone.collabStatus).toBeUndefined();
    expect(tombstone.collabOwner).toBeUndefined();
    expect(tombstone.collabNote).toBeUndefined();
    expect(tombstone.displayName).toBe('');
    expect(remote.photos.has(photoId)).toBe(false);

    await useDevice('B');
    await syncNow();
    expect(await personRepo.get('p1')).toBeNull();
    expect(await personRepo.list()).toEqual([]);
    expect(await local.missingThumbs([photoId])).toEqual([photoId]);
  });

  it('編輯時移除照片：雲端的那張照片也被刪除', async () => {
    await useDevice('A');
    const keep = await photoRepo.put(new Blob(['keep']));
    const drop = await photoRepo.put(new Blob(['drop']));
    await personRepo.save(person({ photoIds: [keep, drop] }));
    await syncNow();
    expect([...remote.photos.keys()].sort()).toEqual([keep, drop].sort());

    await photoRepo.remove(drop);
    await personRepo.save(person({ photoIds: [keep], updatedAt: '2026-09-05T00:00:00.000Z' }));
    await syncNow();

    expect([...remote.photos.keys()]).toEqual([keep]);
  });

  it('A 刪除分組：B 同步後分組消失，人物身上的引用也一併移除', async () => {
    await useDevice('A');
    await groupRepo.save({ id: 'g1', name: '設計圈', color: '#5B8DEF', order: 0, updatedAt: '2026-09-01T00:00:00.000Z' });
    await personRepo.save(person({ groupIds: ['g1'] }));
    await syncNow();
    await useDevice('B');
    await syncNow();
    expect((await groupRepo.list()).map((g) => g.id)).toEqual(['g1']);

    vi.setSystemTime(new Date('2026-09-11T00:00:00.000Z'));
    await useDevice('A');
    await groupRepo.remove('g1');
    await syncNow();
    await useDevice('B');
    await syncNow();

    expect(await groupRepo.list()).toEqual([]);
    expect((await personRepo.get('p1'))?.groupIds).toEqual([]);
  });

  it('上傳失敗時保留待上傳標記，下次同步重試成功', async () => {
    await useDevice('A');
    await personRepo.save(person());

    remote.failPuts = true;
    const failed = await syncNow();
    expect(failed.errors.length).toBe(1);
    expect((await local.listDirty()).map((d) => d.key)).toEqual(['person:p1']);

    remote.failPuts = false;
    const ok = await syncNow();
    expect(ok.errors).toEqual([]);
    expect(remote.persons.has('p1')).toBe(true);
    expect(await local.listDirty()).toEqual([]);
  });

  it('連不上雲端時整個同步中止、本機資料原封不動', async () => {
    await useDevice('A');
    await personRepo.save(person());

    remote.failList = true;
    await expect(syncNow()).rejects.toThrow('Failed to fetch');

    expect((await personRepo.get('p1'))?.displayName).toBe('王小明');
    expect((await local.listDirty()).map((d) => d.key)).toEqual(['person:p1']);
  });

  it('第一次啟用雲端：啟用前就存在的資料（沒有待上傳標記）也會全部上傳', async () => {
    await useDevice('A');
    // 模擬舊版留下的資料：直接寫進資料庫，繞過 repo，所以沒有待上傳標記
    const db = await getDB();
    await db.put('persons', person({ photoIds: ['old-photo'] }));
    await db.put('groups', { id: 'g1', name: '設計圈', color: '#5B8DEF', order: 0, updatedAt: '2026-09-01T00:00:00.000Z' });
    await db.put('photos', {
      id: 'old-photo',
      blob: new Blob(['full']),
      thumbBlob: new Blob(['thumb']),
      width: 100,
      height: 100,
      createdAt: '2026-09-01T00:00:00.000Z',
    });
    expect(await local.listDirty()).toEqual([]);

    const result = await syncNow();

    expect(result.errors).toEqual([]);
    expect(remote.persons.has('p1')).toBe(true);
    expect(remote.groups.has('g1')).toBe(true);
    expect(remote.photos.has('old-photo')).toBe(true);
    expect(await local.isInitialized()).toBe(true);
  });

  it('雲端被清空後，本機資料會自動補傳回去', async () => {
    await useDevice('A');
    await personRepo.save(person());
    await syncNow();

    remote.persons.clear();
    await syncNow();

    expect(remote.persons.has('p1')).toBe(true);
  });
});
