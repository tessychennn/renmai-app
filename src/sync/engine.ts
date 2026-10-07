import { OPTION_SEED_TIME } from '../data/defaultTaskOptions';
import type { EntityKind, RemoteStore, SyncLocal, SyncResult } from './types';

// 同步策略（共用資料、資料量在數百到數千筆以內）：
// - 每次同步先「全量拉取」再「上傳待上傳的變動」。全量拉取省掉游標與時鐘差的問題，
//   數百筆只有幾百 KB。
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

interface Entity {
  id: string;
  updatedAt: string;
}

/**
 * 合併一種單筆資料：雲端較新就套用到本機；本機較新就標記待上傳；
 * 雲端沒有的本機資料也標記待上傳（雲端被清空時自動補回），除非 shouldRepush 說不用。
 * 回傳套用了幾筆。
 */
async function mergeEntities<T extends Entity>(opts: {
  remote: T[];
  local: T[];
  apply: (item: T) => Promise<boolean>;
  markDirty: (id: string) => Promise<void>;
  shouldRepush?: (item: T) => boolean;
  onApplied?: (item: T) => Promise<void>;
}): Promise<number> {
  const localMap = new Map(opts.local.map((x) => [x.id, x]));
  let applied = 0;
  for (const r of opts.remote) {
    const l = localMap.get(r.id);
    if (!l || r.updatedAt > l.updatedAt) {
      if (await opts.apply(r)) {
        applied++;
        await opts.onApplied?.(r);
      }
    } else if (l.updatedAt > r.updatedAt) {
      await opts.markDirty(l.id);
    }
  }
  const remoteIds = new Set(opts.remote.map((x) => x.id));
  for (const l of opts.local) {
    if (!remoteIds.has(l.id) && (opts.shouldRepush?.(l) ?? true)) await opts.markDirty(l.id);
  }
  return applied;
}

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
  const [
    remotePersons,
    remoteGroups,
    remoteTasks,
    remoteOptions,
    localPersons,
    localGroups,
    localTasks,
    localOptions,
  ] = await Promise.all([
    remote.listPersons(),
    remote.listGroups(),
    remote.listTasks(),
    remote.listOptions(),
    local.listPersons(),
    local.listGroups(),
    local.listTasks(),
    local.listOptions(),
  ]);

  const dirtyOf = (kind: EntityKind) => (id: string) => local.markDirty(kind, id);

  result.pulled += await mergeEntities({
    remote: remoteGroups,
    local: localGroups,
    apply: (g) => local.applyGroup(g),
    markDirty: dirtyOf('group'),
  });
  result.pulled += await mergeEntities({
    remote: remoteTasks,
    local: localTasks,
    apply: (t) => local.applyTask(t),
    markDirty: dirtyOf('task'),
  });
  result.pulled += await mergeEntities({
    remote: remoteOptions,
    local: localOptions,
    apply: (o) => local.applyOption(o),
    markDirty: dirtyOf('option'),
    // 沒被改過的預設選項只存在本機，不是「雲端漏掉的資料」
    shouldRepush: (o) => o.updatedAt !== OPTION_SEED_TIME,
  });
  result.pulled += await mergeEntities({
    remote: remotePersons,
    local: localPersons,
    apply: (p) => local.applyPerson(p),
    markDirty: dirtyOf('person'),
    onApplied: async (p) => {
      if (p.deletedAt) await local.removePhotos(p.photoIds);
    },
  });

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
        continue;
      }
      const item =
        entry.kind === 'person'
          ? await local.getPerson(entry.id)
          : entry.kind === 'group'
            ? await local.getGroup(entry.id)
            : entry.kind === 'task'
              ? await local.getTask(entry.id)
              : await local.getOption(entry.id);
      if (!item) {
        await local.clearDirty(entry.key);
        continue;
      }
      if (entry.kind === 'person') await remote.putPerson(item as Parameters<RemoteStore['putPerson']>[0]);
      else if (entry.kind === 'group') await remote.putGroup(item as Parameters<RemoteStore['putGroup']>[0]);
      else if (entry.kind === 'task') await remote.putTask(item as Parameters<RemoteStore['putTask']>[0]);
      else await remote.putOption(item as Parameters<RemoteStore['putOption']>[0]);
      await local.clearDirty(entry.key, item.updatedAt);
      if (entry.kind === 'person') {
        const person = item as Parameters<RemoteStore['putPerson']>[0];
        if (person.deletedAt && person.photoIds.length > 0) {
          await remote.deletePhotos(person.photoIds).catch(() => undefined);
        }
      }
      result.pushed++;
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
