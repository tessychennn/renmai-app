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

    // 沒填認識日期的人以加入日期代替，排序時不會沉到最後
    const metOf = (p: Person) => p.metDate ?? p.createdAt.slice(0, 10);
    switch (filter?.sort ?? 'createdAt-desc') {
      case 'createdAt-asc':
        return persons.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      case 'metDate-desc':
        return persons.sort((a, b) => metOf(b).localeCompare(metOf(a)));
      case 'metDate-asc':
        return persons.sort((a, b) => metOf(a).localeCompare(metOf(b)));
      case 'name':
        return persons.sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-Hant'));
      default:
        return persons.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
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
