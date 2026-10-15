import {
  OPS_PRIORITY_CHOICES,
  PROGRESS_STATUS_CHOICES,
  PROJECTS,
  TECH_LEVEL_CHOICES,
} from '../text/productProgress';
import type { ProgressOption, ProgressOptionKind } from './types';

/**
 * 產品進度選項的預設值（內容來自 src/text/productProgress.ts 裡的預設清單）。
 *
 * - 編號沿用最初的代碼（P0、S、proposed、opt-project-j0…），之前建立的項目不用轉換。
 * - updatedAt 是很早的固定時間：管理員之後改名、刪除的版本一定比它新，會勝出。
 * - 預設值只存在本機、不會上傳雲端（只有管理員能寫入選項，其他人上傳會被拒絕），
 *   所以同步引擎要略過「updatedAt 還是這個時間」的選項。
 * - 這份預設只在第一次啟動時補建；之後的修改一律在 App 的「產品進度設定」裡做。
 */
export const PROGRESS_OPTION_SEED_TIME = '2026-01-01T00:00:00.000Z';

type Seed = { value: string; label: string; hint?: string; color: string; done?: boolean };

function make(kind: ProgressOptionKind, seeds: readonly Seed[]): ProgressOption[] {
  return seeds.map((s, i) => ({
    id: s.value,
    kind,
    name: s.label,
    order: i,
    color: s.color,
    hint: s.hint,
    isDone: s.done ? true : undefined,
    updatedAt: PROGRESS_OPTION_SEED_TIME,
  }));
}

export const DEFAULT_PROGRESS_OPTIONS: ProgressOption[] = [
  ...make(
    'project',
    PROJECTS.map((p) => ({ value: p.id, label: p.name, color: 'gray' }))
  ),
  ...make('priority', OPS_PRIORITY_CHOICES),
  ...make('tech', TECH_LEVEL_CHOICES),
  ...make('status', PROGRESS_STATUS_CHOICES),
];
