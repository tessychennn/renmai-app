import { notifyLocalChange } from '../changeSignal';
import { dirtyKey, getDB } from './db';
import type { Task, TaskRepo } from '../types';

/** 墓碑：只留同步需要的欄位，已刪除任務的名稱與備註不該繼續留在雲端 */
export function makeTaskTombstone(t: Task, now: string): Task {
  return {
    id: t.id,
    name: '',
    categoryId: '',
    done: false,
    createdAt: t.createdAt,
    updatedAt: now,
    deletedAt: now,
  };
}

export class IndexedDBTaskRepo implements TaskRepo {
  async list(): Promise<Task[]> {
    const db = await getDB();
    return (await db.getAll('tasks')).filter((t) => !t.deletedAt);
  }

  async get(id: string): Promise<Task | null> {
    const task = await (await getDB()).get('tasks', id);
    return task && !task.deletedAt ? task : null;
  }

  async save(task: Task): Promise<void> {
    await this.saveMany([task]);
  }

  async saveMany(tasks: Task[]): Promise<void> {
    if (tasks.length === 0) return;
    const db = await getDB();
    const tx = db.transaction(['tasks', 'dirty'], 'readwrite');
    await Promise.all([
      ...tasks.flatMap((t) => [
        tx.objectStore('tasks').put(t),
        tx.objectStore('dirty').put({ key: dirtyKey('task', t.id), kind: 'task' as const, id: t.id }),
      ]),
      tx.done,
    ]);
    notifyLocalChange();
  }

  async remove(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['tasks', 'dirty'], 'readwrite');
    const current = await tx.objectStore('tasks').get(id);
    if (current && !current.deletedAt) {
      await Promise.all([
        tx.objectStore('tasks').put(makeTaskTombstone(current, new Date().toISOString())),
        tx.objectStore('dirty').put({ key: dirtyKey('task', id), kind: 'task', id }),
      ]);
    }
    await tx.done;
    notifyLocalChange();
  }
}
