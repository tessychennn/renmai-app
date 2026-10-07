import { DEFAULT_TASK_OPTIONS } from '../defaultTaskOptions';
import { getDB } from './db';

/**
 * 補建待辦選項的預設值，可重複執行。回傳這次新增了幾個。
 * 同識別碼已存在（包含被管理員刪掉的墓碑）就不建立。
 * 刻意不標記為待上傳，原因見 defaultTaskOptions.ts。
 */
export async function ensureDefaultTaskOptions(): Promise<number> {
  const db = await getDB();
  const tx = db.transaction('taskOptions', 'readwrite');
  const known = new Set((await tx.store.getAllKeys()) as string[]);
  let added = 0;
  for (const option of DEFAULT_TASK_OPTIONS) {
    if (known.has(option.id)) continue;
    await tx.store.put(option);
    added++;
  }
  await tx.done;
  return added;
}
