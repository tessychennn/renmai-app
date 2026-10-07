import { OPTION_SEED_TIME } from '../defaultTaskOptions';
import { dirtyKey, getDB, savePhotoVariant } from './db';
import type { Group, Person, Task, TaskOption } from '../types';
import type { DirtyEntry, EntityKind, SyncLocal } from '../../sync/types';

const INITIALIZED_KEY = 'cloudInitialized';

/** 單筆資料種類 → 對應的 object store */
const STORE_OF = {
  person: 'persons',
  group: 'groups',
  task: 'tasks',
  option: 'taskOptions',
} as const;

export class IndexedDBSyncLocal implements SyncLocal {
  async isInitialized(): Promise<boolean> {
    const db = await getDB();
    return (await db.get('syncMeta', INITIALIZED_KEY)) === true;
  }

  async initialize(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(
      ['persons', 'groups', 'tasks', 'taskOptions', 'dirty', 'syncMeta'],
      'readwrite'
    );
    const dirty = tx.objectStore('dirty');
    for (const p of await tx.objectStore('persons').getAll()) {
      await dirty.put({ key: dirtyKey('person', p.id), kind: 'person', id: p.id });
    }
    for (const g of await tx.objectStore('groups').getAll()) {
      await dirty.put({ key: dirtyKey('group', g.id), kind: 'group', id: g.id });
    }
    for (const t of await tx.objectStore('tasks').getAll()) {
      await dirty.put({ key: dirtyKey('task', t.id), kind: 'task', id: t.id });
    }
    for (const o of await tx.objectStore('taskOptions').getAll()) {
      // 沒被改過的預設選項不上傳（見 defaultTaskOptions.ts）
      if (o.updatedAt !== OPTION_SEED_TIME) {
        await dirty.put({ key: dirtyKey('option', o.id), kind: 'option', id: o.id });
      }
    }
    await tx.objectStore('syncMeta').put(true, INITIALIZED_KEY);
    await tx.done;
  }

  async listPersons(): Promise<Person[]> {
    return (await getDB()).getAll('persons');
  }

  async listGroups(): Promise<Group[]> {
    return (await getDB()).getAll('groups');
  }

  async listTasks(): Promise<Task[]> {
    return (await getDB()).getAll('tasks');
  }

  async listOptions(): Promise<TaskOption[]> {
    return (await getDB()).getAll('taskOptions');
  }

  async getPerson(id: string): Promise<Person | undefined> {
    return (await getDB()).get('persons', id);
  }

  async getGroup(id: string): Promise<Group | undefined> {
    return (await getDB()).get('groups', id);
  }

  async getTask(id: string): Promise<Task | undefined> {
    return (await getDB()).get('tasks', id);
  }

  async getOption(id: string): Promise<TaskOption | undefined> {
    return (await getDB()).get('taskOptions', id);
  }

  /** 寫入雲端版本：只有比本機新才寫，並清掉該筆的待上傳標記 */
  private async applyEntity(
    kind: EntityKind,
    item: { id: string; updatedAt: string }
  ): Promise<boolean> {
    const store = STORE_OF[kind];
    const db = await getDB();
    const tx = db.transaction([store, 'dirty'], 'readwrite');
    const entities = tx.objectStore(store) as unknown as {
      get(id: string): Promise<{ updatedAt: string } | undefined>;
      put(value: unknown): Promise<unknown>;
    };
    const current = await entities.get(item.id);
    if (current && current.updatedAt >= item.updatedAt) {
      await tx.done;
      return false;
    }
    await entities.put(item);
    await tx.objectStore('dirty').delete(dirtyKey(kind, item.id));
    await tx.done;
    return true;
  }

  applyPerson(person: Person): Promise<boolean> {
    return this.applyEntity('person', person);
  }

  applyGroup(group: Group): Promise<boolean> {
    return this.applyEntity('group', group);
  }

  applyTask(task: Task): Promise<boolean> {
    return this.applyEntity('task', task);
  }

  applyOption(option: TaskOption): Promise<boolean> {
    return this.applyEntity('option', option);
  }

  async markDirty(kind: EntityKind, id: string): Promise<void> {
    const db = await getDB();
    await db.put('dirty', { key: dirtyKey(kind, id), kind, id });
  }

  async listDirty(): Promise<DirtyEntry[]> {
    return (await getDB()).getAll('dirty');
  }

  async clearDirty(key: string, ifUpdatedAt?: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['dirty', 'persons', 'groups', 'tasks', 'taskOptions'], 'readwrite');
    if (ifUpdatedAt) {
      const entry = await tx.objectStore('dirty').get(key);
      if (entry && entry.kind !== 'photo') {
        const current = (await (
          tx.objectStore(STORE_OF[entry.kind]) as unknown as {
            get(id: string): Promise<{ updatedAt: string } | undefined>;
          }
        ).get(entry.id)) as { updatedAt: string } | undefined;
        if (current && current.updatedAt !== ifUpdatedAt) {
          await tx.done;
          return;
        }
      }
    }
    await tx.objectStore('dirty').delete(key);
    await tx.done;
  }

  async listPhotosToUpload(): Promise<string[]> {
    const db = await getDB();
    const ids: string[] = [];
    let cursor = await db.transaction('photos').store.openCursor();
    while (cursor) {
      const r = cursor.value;
      if (!r.uploaded && r.blob && r.thumbBlob) ids.push(r.id);
      cursor = await cursor.continue();
    }
    return ids;
  }

  async getPhotoForUpload(id: string): Promise<{ full: Blob; thumb: Blob } | null> {
    const record = await (await getDB()).get('photos', id);
    return record?.blob && record.thumbBlob ? { full: record.blob, thumb: record.thumbBlob } : null;
  }

  async markPhotoUploaded(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('photos', 'readwrite');
    const record = await tx.store.get(id);
    if (record) await tx.store.put({ ...record, uploaded: true });
    await tx.done;
  }

  async missingThumbs(ids: string[]): Promise<string[]> {
    const db = await getDB();
    const missing: string[] = [];
    for (const id of ids) {
      const record = await db.get('photos', id);
      if (!record?.thumbBlob) missing.push(id);
    }
    return missing;
  }

  async savePhotoBlob(id: string, variant: 'full' | 'thumb', blob: Blob): Promise<void> {
    await savePhotoVariant(id, variant, blob);
  }

  async removePhotos(ids: string[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('photos', 'readwrite');
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  }
}
