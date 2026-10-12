import type { TaskOption, TaskOptionKind } from './types';

/**
 * 待辦選項的預設值（沿用原本 Google 試算表設定區的預設清單）。
 *
 * - 識別碼固定：每支手機各自建立後是同一筆，不會變成兩份。
 * - updatedAt 是很早的固定時間：管理員之後改名、刪除的版本一定比它新，會勝出。
 * - 預設值只存在本機、不會上傳雲端（只有管理員能寫入選項，一般成員上傳會被拒絕）。
 *   所以同步引擎要略過「updatedAt 還是這個時間」的選項，不能當成「雲端沒有、要補傳」。
 */
export const OPTION_SEED_TIME = '2026-01-01T00:00:00.000Z';

function make(kind: TaskOptionKind, key: string, names: string[]): TaskOption[] {
  return names.map((name, i) => ({
    id: `opt-${kind}-${key}${i}`,
    kind,
    name,
    order: i,
    updatedAt: OPTION_SEED_TIME,
  }));
}

export const DEFAULT_TASK_OPTIONS: TaskOption[] = [
  ...make('category', 'c', ['業務開發', '行銷', '財務', '行政', '活動', '產品']),
  ...make('member', 'm', ['Tessy', 'Serina']),
  ...make('priority', 'p', ['高', '中', '低']),
  // 進度追蹤的大項目（管理員可以在待辦設定新增、改名）
  ...make('project', 'j', ['WebApp 細節修改', 'App', '網頁', 'AI']),
  // 識別碼沿用舊的編號（s0、s1、s3、s4、s5）：已經建好預設選項的手機不會因此多出重複的狀態。
  // 舊預設裡的「卡住」（s2）與「已約時間」（s6）不再預設提供，已有的人要在待辦設定自行刪除。
  ...[
    ['s0', '未開始'],
    ['s1', '進行中'],
    ['s3', '等回覆'],
    ['s4', '需聯繫'],
    ['s5', '聯繫中'],
  ].map(([key, name], i): TaskOption => ({
    id: `opt-status-${key}`,
    kind: 'status',
    name,
    order: i,
    updatedAt: OPTION_SEED_TIME,
  })),
];
