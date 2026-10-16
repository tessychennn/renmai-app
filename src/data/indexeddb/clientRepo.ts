import { notifyLocalChange } from '../changeSignal';
import { dirtyKey, getDB } from './db';
import type { Client, ClientRepo } from '../types';

/** 墓碑：只留同步需要的欄位，已移出客戶的名字與備註不該繼續留在雲端 */
export function makeClientTombstone(c: Client, now: string): Client {
  return {
    id: c.id,
    ...(c.personId ? { personId: c.personId } : {}),
    done: false,
    createdAt: c.createdAt,
    updatedAt: now,
    deletedAt: now,
  };
}

export class IndexedDBClientRepo implements ClientRepo {
  async list(): Promise<Client[]> {
    const db = await getDB();
    return (await db.getAll('clients')).filter((c) => !c.deletedAt);
  }

  async get(id: string): Promise<Client | null> {
    const client = await (await getDB()).get('clients', id);
    return client && !client.deletedAt ? client : null;
  }

  async save(client: Client): Promise<void> {
    await this.saveMany([client]);
  }

  async saveMany(clients: Client[]): Promise<void> {
    if (clients.length === 0) return;
    const db = await getDB();
    const tx = db.transaction(['clients', 'dirty'], 'readwrite');
    await Promise.all([
      ...clients.flatMap((c) => [
        tx.objectStore('clients').put(c),
        tx.objectStore('dirty').put({ key: dirtyKey('client', c.id), kind: 'client' as const, id: c.id }),
      ]),
      tx.done,
    ]);
    notifyLocalChange();
  }

  async remove(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['clients', 'dirty'], 'readwrite');
    const current = await tx.objectStore('clients').get(id);
    if (current && !current.deletedAt) {
      await Promise.all([
        tx.objectStore('clients').put(makeClientTombstone(current, new Date().toISOString())),
        tx.objectStore('dirty').put({ key: dirtyKey('client', id), kind: 'client', id }),
      ]);
    }
    await tx.done;
    notifyLocalChange();
  }
}
