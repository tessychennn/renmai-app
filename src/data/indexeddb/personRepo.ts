import { notifyLocalChange } from '../changeSignal';
import { dirtyKey, getDB } from './db';
import type { Person, PersonFilter, PersonRepo } from '../types';

/** 墓碑：只留同步需要的欄位。已刪除的人不該把備註、聯絡帳號繼續留在雲端。 */
export function makeTombstone(p: Person, now: string): Person {
  return {
    id: p.id,
    displayName: '',
    photoIds: p.photoIds, // 另一支手機要靠它清掉對應的照片
    groupIds: [],
    createdAt: p.createdAt,
    updatedAt: now,
    deletedAt: now,
  };
}

export class IndexedDBPersonRepo implements PersonRepo {
  async list(filter?: PersonFilter): Promise<Person[]> {
    const db = await getDB();
    let persons = (await db.getAll('persons')).filter((p) => !p.deletedAt);

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
    const person = await db.get('persons', id);
    return person && !person.deletedAt ? person : null;
  }

  async save(person: Person): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['persons', 'dirty'], 'readwrite');
    await Promise.all([
      tx.objectStore('persons').put(person),
      tx.objectStore('dirty').put({ key: dirtyKey('person', person.id), kind: 'person', id: person.id }),
      tx.done,
    ]);
    notifyLocalChange();
  }

  async remove(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['persons', 'dirty'], 'readwrite');
    const current = await tx.objectStore('persons').get(id);
    if (current && !current.deletedAt) {
      await Promise.all([
        tx.objectStore('persons').put(makeTombstone(current, new Date().toISOString())),
        tx.objectStore('dirty').put({ key: dirtyKey('person', id), kind: 'person', id }),
      ]);
    }
    await tx.done;
    notifyLocalChange();
  }
}
