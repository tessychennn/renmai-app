import { notifyLocalChange } from '../changeSignal';
import { DEFAULT_GROUPS } from '../defaultGroups';
import { dirtyKey, getDB } from './db';

/**
 * 補建預設分組，可重複執行。回傳這次新增了幾個。
 * 以下情況不會建立：
 * - 同識別碼的分組已存在（包含已被刪除的墓碑，使用者刪掉的不會又冒出來）
 * - 已有同名稱的分組（使用者自己建過，避免重複）
 */
export async function ensureDefaultGroups(): Promise<number> {
  const db = await getDB();
  const tx = db.transaction(['groups', 'dirty'], 'readwrite');
  const groups = tx.objectStore('groups');
  const existing = await groups.getAll();
  const knownIds = new Set(existing.map((g) => g.id));
  const liveNames = new Set(existing.filter((g) => !g.deletedAt).map((g) => g.name));

  let added = 0;
  for (const group of DEFAULT_GROUPS) {
    if (knownIds.has(group.id) || liveNames.has(group.name)) continue;
    await groups.put(group);
    await tx.objectStore('dirty').put({ key: dirtyKey('group', group.id), kind: 'group', id: group.id });
    added++;
  }
  await tx.done;
  if (added > 0) notifyLocalChange();
  return added;
}
