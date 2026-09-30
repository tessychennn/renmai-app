import { notifyLocalChange } from '../changeSignal';
import { dirtyKey, getDB } from './db';
import type { Group, GroupRepo } from '../types';

export class IndexedDBGroupRepo implements GroupRepo {
  async list(): Promise<Group[]> {
    const db = await getDB();
    const groups = (await db.getAll('groups')).filter((g) => !g.deletedAt);
    return groups.sort((a, b) => a.order - b.order);
  }

  async save(group: Group): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['groups', 'dirty'], 'readwrite');
    await Promise.all([
      tx.objectStore('groups').put(group),
      tx.objectStore('dirty').put({ key: dirtyKey('group', group.id), kind: 'group', id: group.id }),
      tx.done,
    ]);
    notifyLocalChange();
  }

  async remove(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['groups', 'persons', 'dirty'], 'readwrite');
    const now = new Date().toISOString();
    const groups = tx.objectStore('groups');
    const persons = tx.objectStore('persons');
    const dirty = tx.objectStore('dirty');

    const group = await groups.get(id);
    if (group && !group.deletedAt) {
      await groups.put({ ...group, deletedAt: now, updatedAt: now });
      await dirty.put({ key: dirtyKey('group', id), kind: 'group', id });
    }
    // 同步移除人物身上的引用，避免孤兒 groupId；人物也要標記為待同步
    for (const person of await persons.getAll()) {
      if (!person.deletedAt && person.groupIds.includes(id)) {
        await persons.put({
          ...person,
          groupIds: person.groupIds.filter((g) => g !== id),
          updatedAt: now,
        });
        await dirty.put({ key: dirtyKey('person', person.id), kind: 'person', id: person.id });
      }
    }
    await tx.done;
    notifyLocalChange();
  }
}
