import { notifyLocalChange } from '../changeSignal';
import { dirtyKey, getDB } from './db';
import type { ProgressItem, ProgressRepo } from '../types';

/** 墓碑：只留同步需要的欄位，已刪除項目的名稱與備註不該繼續留在雲端 */
export function makeProgressTombstone(item: ProgressItem, now: string): ProgressItem {
  return {
    id: item.id,
    name: '',
    projectId: '',
    status: 'proposed',
    createdAt: item.createdAt,
    updatedAt: now,
    deletedAt: now,
  };
}

export class IndexedDBProgressRepo implements ProgressRepo {
  async list(): Promise<ProgressItem[]> {
    const db = await getDB();
    return (await db.getAll('progress')).filter((i) => !i.deletedAt);
  }

  async get(id: string): Promise<ProgressItem | null> {
    const item = await (await getDB()).get('progress', id);
    return item && !item.deletedAt ? item : null;
  }

  async save(item: ProgressItem): Promise<void> {
    await this.saveMany([item]);
  }

  async saveMany(items: ProgressItem[]): Promise<void> {
    if (items.length === 0) return;
    const db = await getDB();
    const tx = db.transaction(['progress', 'dirty'], 'readwrite');
    await Promise.all([
      ...items.flatMap((i) => [
        tx.objectStore('progress').put(i),
        tx.objectStore('dirty').put({ key: dirtyKey('item', i.id), kind: 'item' as const, id: i.id }),
      ]),
      tx.done,
    ]);
    notifyLocalChange();
  }

  async remove(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['progress', 'dirty'], 'readwrite');
    const current = await tx.objectStore('progress').get(id);
    if (current && !current.deletedAt) {
      await Promise.all([
        tx.objectStore('progress').put(makeProgressTombstone(current, new Date().toISOString())),
        tx.objectStore('dirty').put({ key: dirtyKey('item', id), kind: 'item', id }),
      ]);
    }
    await tx.done;
    notifyLocalChange();
  }
}
