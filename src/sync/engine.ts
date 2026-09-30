import type { RemoteStore, SyncLocal, SyncResult } from './types';

// 同步策略（兩人共用、資料量在數百到數千筆以內）：
// - 每次同步先「全量拉取」再「上傳待上傳的變動」。全量拉取省掉游標與時鐘差的問題，
//   數百筆人物只有幾百 KB。
// - 衝突以 updatedAt 較新者為準（整筆覆蓋）。
// - 刪除是墓碑（deletedAt），另一支手機才知道要刪。
// - 照片只會新增或刪除，不會被修改；先上傳照片再上傳人物，別人拉到人物時照片已在雲端。

const DOWNLOAD_CONCURRENCY = 4;

async function runPool<T>(items: T[], size: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function runSync(local: SyncLocal, remote: RemoteStore): Promise<SyncResult> {
  const result: SyncResult = {
    pulled: 0,
    pushed: 0,
    photosUploaded: 0,
    photosDownloaded: 0,
    errors: [],
  };

  if (!(await local.isInitialized())) await local.initialize();

  // 1. 拉取：雲端這頭失敗就整個中止（什麼都還沒動）
  const [remotePersons, remoteGroups, localPersons, localGroups] = await Promise.all([
    remote.listPersons(),
    remote.listGroups(),
    local.listPersons(),
    local.listGroups(),
  ]);

  const localGroupMap = new Map(localGroups.map((g) => [g.id, g]));
  for (const r of remoteGroups) {
    const l = localGroupMap.get(r.id);
    if (!l || r.updatedAt > l.updatedAt) {
      if (await local.applyGroup(r)) result.pulled++;
    } else if (l.updatedAt > r.updatedAt) {
      await local.markDirty('group', l.id);
    }
  }
  const remoteGroupIds = new Set(remoteGroups.map((g) => g.id));
  for (const l of localGroups) {
    if (!remoteGroupIds.has(l.id)) await local.markDirty('group', l.id);
  }

  const localPersonMap = new Map(localPersons.map((p) => [p.id, p]));
  for (const r of remotePersons) {
    const l = localPersonMap.get(r.id);
    if (!l || r.updatedAt > l.updatedAt) {
      if (await local.applyPerson(r)) {
        result.pulled++;
        if (r.deletedAt) await local.removePhotos(r.photoIds);
      }
    } else if (l.updatedAt > r.updatedAt) {
      await local.markDirty('person', l.id);
    }
  }
  // 雲端沒有的本機資料（例如雲端被清空過）補傳上去
  const remotePersonIds = new Set(remotePersons.map((p) => p.id));
  for (const l of localPersons) {
    if (!remotePersonIds.has(l.id)) await local.markDirty('person', l.id);
  }

  // 2. 上傳照片（先於人物，避免別人拉到人物卻抓不到照片）
  for (const id of await local.listPhotosToUpload()) {
    try {
      const blobs = await local.getPhotoForUpload(id);
      if (!blobs) continue;
      await remote.uploadPhoto(id, blobs.full, blobs.thumb);
      await local.markPhotoUploaded(id);
      result.photosUploaded++;
    } catch (e) {
      result.errors.push(`照片 ${id} 上傳失敗：${messageOf(e)}`);
    }
  }

  // 3. 上傳待上傳的變動；單筆失敗不擋其他筆，標記保留到下次重試
  for (const entry of await local.listDirty()) {
    try {
      if (entry.kind === 'photo') {
        await remote.deletePhotos([entry.id]);
        await local.clearDirty(entry.key);
      } else if (entry.kind === 'person') {
        const person = await local.getPerson(entry.id);
        if (!person) {
          await local.clearDirty(entry.key);
          continue;
        }
        await remote.putPerson(person);
        await local.clearDirty(entry.key, person.updatedAt);
        if (person.deletedAt && person.photoIds.length > 0) {
          await remote.deletePhotos(person.photoIds).catch(() => undefined);
        }
        result.pushed++;
      } else {
        const group = await local.getGroup(entry.id);
        if (!group) {
          await local.clearDirty(entry.key);
          continue;
        }
        await remote.putGroup(group);
        await local.clearDirty(entry.key, group.updatedAt);
        result.pushed++;
      }
    } catch (e) {
      result.errors.push(`${entry.key} 上傳失敗：${messageOf(e)}`);
    }
  }

  // 4. 補下載本機缺的縮圖（完整版等使用者點開才下載）
  const persons = await local.listPersons();
  const wanted = [...new Set(persons.filter((p) => !p.deletedAt).flatMap((p) => p.photoIds))];
  const missing = await local.missingThumbs(wanted);
  await runPool(missing, DOWNLOAD_CONCURRENCY, async (id) => {
    try {
      const blob = await remote.downloadPhoto(id, 'thumb');
      if (blob) {
        await local.savePhotoBlob(id, 'thumb', blob);
        result.photosDownloaded++;
      }
    } catch (e) {
      result.errors.push(`照片 ${id} 下載失敗：${messageOf(e)}`);
    }
  });

  return result;
}
