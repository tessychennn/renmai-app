import { DEFAULT_PROGRESS_OPTIONS } from '../defaultProgressOptions';
import { getDB } from './db';

/**
 * 補建產品進度選項的預設值，可重複執行。回傳這次新增了幾個。
 * 同編號已存在（包含被管理員刪掉的墓碑）就不建立。
 * 刻意不標記為待上傳，原因見 defaultProgressOptions.ts。
 */
export async function ensureDefaultProgressOptions(): Promise<number> {
  const db = await getDB();
  const tx = db.transaction('progressOptions', 'readwrite');
  const known = new Set((await tx.store.getAllKeys()) as string[]);
  let added = 0;
  for (const option of DEFAULT_PROGRESS_OPTIONS) {
    if (known.has(option.id)) continue;
    await tx.store.put(option);
    added++;
  }
  await tx.done;
  return added;
}
