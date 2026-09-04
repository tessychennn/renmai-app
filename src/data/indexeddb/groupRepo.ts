import { getDB } from './db';
import type { Group, GroupRepo } from '../types';

export class IndexedDBGroupRepo implements GroupRepo {
  async list(): Promise<Group[]> {
    const db = await getDB();
    const groups = await db.getAll('groups');
    return groups.sort((a, b) => a.order - b.order);
  }

  async save(group: Group): Promise<void> {
    const db = await getDB();
    await db.put('groups', group);
  }

  async remove(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['groups', 'persons'], 'readwrite');
    await tx.objectStore('groups').delete(id);
    // 同步移除人物身上的引用，避免孤兒 groupId
    const persons = await tx.objectStore('persons').getAll();
    for (const person of persons) {
      if (person.groupIds.includes(id)) {
        await tx.objectStore('persons').put({
          ...person,
          groupIds: person.groupIds.filter((g) => g !== id),
        });
      }
    }
    await tx.done;
  }
}
