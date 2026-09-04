import { getDB } from './db';
import type { Person, PersonFilter, PersonRepo } from '../types';

export class IndexedDBPersonRepo implements PersonRepo {
  async list(filter?: PersonFilter): Promise<Person[]> {
    const db = await getDB();
    let persons = await db.getAll('persons');

    const q = filter?.search?.trim().toLowerCase();
    if (q) {
      persons = persons.filter((p) =>
        [p.displayName, p.occasion, p.note, p.lineName].some((v) =>
          v?.toLowerCase().includes(q)
        )
      );
    }

    const groupIds = filter?.groupIds;
    if (groupIds && groupIds.length > 0) {
      persons = persons.filter((p) => groupIds.some((g) => p.groupIds.includes(g)));
    }

    return persons.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string): Promise<Person | null> {
    const db = await getDB();
    return (await db.get('persons', id)) ?? null;
  }

  async save(person: Person): Promise<void> {
    const db = await getDB();
    await db.put('persons', person);
  }

  async remove(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('persons', id);
  }
}
