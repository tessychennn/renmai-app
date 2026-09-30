import { dirtyKey, getDB, savePhotoVariant } from './db';
import type { Group, Person } from '../types';
import type { DirtyEntry, SyncLocal } from '../../sync/types';

const INITIALIZED_KEY = 'cloudInitialized';

export class IndexedDBSyncLocal implements SyncLocal {
  async isInitialized(): Promise<boolean> {
    const db = await getDB();
    return (await db.get('syncMeta', INITIALIZED_KEY)) === true;
  }

  async initialize(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['persons', 'groups', 'dirty', 'syncMeta'], 'readwrite');
    const dirty = tx.objectStore('dirty');
    for (const p of await tx.objectStore('persons').getAll()) {
      await dirty.put({ key: dirtyKey('person', p.id), kind: 'person', id: p.id });
    }
    for (const g of await tx.objectStore('groups').getAll()) {
      await dirty.put({ key: dirtyKey('group', g.id), kind: 'group', id: g.id });
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

  async getPerson(id: string): Promise<Person | undefined> {
    return (await getDB()).get('persons', id);
  }

  async getGroup(id: string): Promise<Group | undefined> {
    return (await getDB()).get('groups', id);
  }

  async applyPerson(person: Person): Promise<boolean> {
    const db = await getDB();
    const tx = db.transaction(['persons', 'dirty'], 'readwrite');
    const current = await tx.objectStore('persons').get(person.id);
    if (current && current.updatedAt >= person.updatedAt) {
      await tx.done;
      return false;
    }
    await tx.objectStore('persons').put(person);
    await tx.objectStore('dirty').delete(dirtyKey('person', person.id));
    await tx.done;
    return true;
  }

  async applyGroup(group: Group): Promise<boolean> {
    const db = await getDB();
    const tx = db.transaction(['groups', 'dirty'], 'readwrite');
    const current = await tx.objectStore('groups').get(group.id);
    if (current && current.updatedAt >= group.updatedAt) {
      await tx.done;
      return false;
    }
    await tx.objectStore('groups').put(group);
    await tx.objectStore('dirty').delete(dirtyKey('group', group.id));
    await tx.done;
    return true;
  }

  async markDirty(kind: 'person' | 'group', id: string): Promise<void> {
    const db = await getDB();
    await db.put('dirty', { key: dirtyKey(kind, id), kind, id });
  }

  async listDirty(): Promise<DirtyEntry[]> {
    return (await getDB()).getAll('dirty');
  }

  async clearDirty(key: string, ifUpdatedAt?: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['dirty', 'persons', 'groups'], 'readwrite');
    if (ifUpdatedAt) {
      const entry = await tx.objectStore('dirty').get(key);
      const current =
        entry?.kind === 'person'
          ? await tx.objectStore('persons').get(entry.id)
          : entry?.kind === 'group'
            ? await tx.objectStore('groups').get(entry.id)
            : undefined;
      if (current && current.updatedAt !== ifUpdatedAt) {
        await tx.done;
        return;
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
