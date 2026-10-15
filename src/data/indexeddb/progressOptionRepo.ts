import { notifyLocalChange } from '../changeSignal';
import { dirtyKey, getDB } from './db';
import type { ProgressOption, ProgressOptionKind, ProgressOptionRepo } from '../types';

export class IndexedDBProgressOptionRepo implements ProgressOptionRepo {
  async list(kind?: ProgressOptionKind): Promise<ProgressOption[]> {
    const db = await getDB();
    return (await db.getAll('progressOptions'))
      .filter((o) => !o.deletedAt && (!kind || o.kind === kind))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-Hant'));
  }

  async save(option: ProgressOption): Promise<void> {
    await this.saveMany([option]);
  }

  async saveMany(options: ProgressOption[]): Promise<void> {
    if (options.length === 0) return;
    const db = await getDB();
    const tx = db.transaction(['progressOptions', 'dirty'], 'readwrite');
    await Promise.all([
      ...options.flatMap((o) => [
        tx.objectStore('progressOptions').put(o),
        tx.objectStore('dirty').put({ key: dirtyKey('popt', o.id), kind: 'popt' as const, id: o.id }),
      ]),
      tx.done,
    ]);
    notifyLocalChange();
  }

  /** 刪除是墓碑（另一支手機才知道要刪），名稱等內容清掉 */
  async remove(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['progressOptions', 'dirty'], 'readwrite');
    const current = await tx.objectStore('progressOptions').get(id);
    if (current && !current.deletedAt) {
      const now = new Date().toISOString();
      await Promise.all([
        tx.objectStore('progressOptions').put({
          id: current.id,
          kind: current.kind,
          name: '',
          order: 0,
          color: current.color,
          updatedAt: now,
          deletedAt: now,
        }),
        tx.objectStore('dirty').put({ key: dirtyKey('popt', id), kind: 'popt', id }),
      ]);
    }
    await tx.done;
    notifyLocalChange();
  }
}
