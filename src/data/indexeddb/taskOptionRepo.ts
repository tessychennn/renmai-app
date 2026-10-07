import { notifyLocalChange } from '../changeSignal';
import { dirtyKey, getDB } from './db';
import type { TaskOption, TaskOptionKind, TaskOptionRepo } from '../types';

export class IndexedDBTaskOptionRepo implements TaskOptionRepo {
  async list(kind?: TaskOptionKind): Promise<TaskOption[]> {
    const db = await getDB();
    return (await db.getAll('taskOptions'))
      .filter((o) => !o.deletedAt && (!kind || o.kind === kind))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-Hant'));
  }

  async save(option: TaskOption): Promise<void> {
    await this.saveMany([option]);
  }

  async saveMany(options: TaskOption[]): Promise<void> {
    if (options.length === 0) return;
    const db = await getDB();
    const tx = db.transaction(['taskOptions', 'dirty'], 'readwrite');
    await Promise.all([
      ...options.flatMap((o) => [
        tx.objectStore('taskOptions').put(o),
        tx.objectStore('dirty').put({ key: dirtyKey('option', o.id), kind: 'option' as const, id: o.id }),
      ]),
      tx.done,
    ]);
    notifyLocalChange();
  }

  async remove(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['taskOptions', 'dirty'], 'readwrite');
    const current = await tx.objectStore('taskOptions').get(id);
    if (current && !current.deletedAt) {
      const now = new Date().toISOString();
      await Promise.all([
        tx.objectStore('taskOptions').put({
          id: current.id,
          kind: current.kind,
          name: '',
          order: 0,
          updatedAt: now,
          deletedAt: now,
        }),
        tx.objectStore('dirty').put({ key: dirtyKey('option', id), kind: 'option', id }),
      ]);
    }
    await tx.done;
    notifyLocalChange();
  }
}
