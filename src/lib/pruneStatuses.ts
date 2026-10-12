import { cloudEnabled } from '../cloud/config';
import { DEFAULT_TASK_OPTIONS } from '../data/defaultTaskOptions';
import { taskOptionRepo, taskRepo } from '../data';

const DONE_KEY = 'renmai.prunedStatuses.v1';

const KEEP_NAMES = new Set(DEFAULT_TASK_OPTIONS.filter((o) => o.kind === 'status').map((o) => o.name));

function flag(value?: string): string | null {
  try {
    if (value) localStorage.setItem(DONE_KEY, value);
    return localStorage.getItem(DONE_KEY);
  } catch {
    return null;
  }
}

function isAdminDevice(): boolean {
  if (!cloudEnabled) return true;
  try {
    return localStorage.getItem('renmai.isAdmin') === '1';
  } catch {
    return false;
  }
}

/**
 * 一次性清理：狀態只留預設的五個（未開始、進行中、等回覆、需聯繫、聯繫中），其他刪掉。
 * 用到被刪狀態的待辦改成「未設定」，其他欄位不動。
 *
 * - 只有管理員能刪選項（伺服器也只認管理員），所以只在管理員的裝置上執行。
 * - 有雲端時要等第一次同步成功後才做，避免只清到本機、漏掉雲端上另一支手機建的狀態。
 * - 每支裝置只做一次：之後管理員自己再新增的狀態不會被刪。
 * 回傳刪掉了幾個狀態。
 */
export async function pruneLegacyStatuses(afterSync = false): Promise<number> {
  if (flag()) return 0;
  if (!isAdminDevice()) return 0;
  if (cloudEnabled && !afterSync) return 0;

  const extra = (await taskOptionRepo.list('status')).filter((s) => !KEEP_NAMES.has(s.name));
  if (extra.length > 0) {
    const ids = new Set(extra.map((s) => s.id));
    const now = new Date().toISOString();
    const affected = (await taskRepo.list())
      .filter((t) => t.statusId && ids.has(t.statusId))
      .map((t) => ({ ...t, statusId: undefined, updatedAt: now }));
    if (affected.length > 0) await taskRepo.saveMany(affected);
    for (const s of extra) await taskOptionRepo.remove(s.id);
  }
  flag(new Date().toISOString());
  return extra.length;
}
