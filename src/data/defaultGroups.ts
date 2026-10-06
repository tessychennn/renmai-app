import type { Group } from './types';

/**
 * 預設分組。識別碼固定，兩支手機各自建立後同步時會對成同一筆，不會變兩份。
 *
 * - updatedAt 刻意設成很早的固定時間：之後任何一支手機改名或刪除（時間比它新）都會勝出，
 *   新手機啟動時補建的預設分組不會把已經被刪掉的分組又救回來。
 * - order 用負數：預設分組固定排在使用者自己建立的分組（order ≥ 0）前面，
 *   而且兩支手機算出來的順序一致。
 */
const SEED_TIME = '2026-01-01T00:00:00.000Z';

export const DEFAULT_GROUPS: Group[] = [
  { id: 'group-important', name: '重要人物', color: '#D8A800', order: -5, updatedAt: SEED_TIME },
  { id: 'group-restaurant', name: '餐飲相關', color: '#E8843C', order: -4, updatedAt: SEED_TIME },
  { id: 'group-food', name: '食品相關', color: '#3FA66A', order: -3, updatedAt: SEED_TIME },
  { id: 'group-brand', name: '品牌設計', color: '#5B8DEF', order: -2, updatedAt: SEED_TIME },
  { id: 'group-none', name: '暫無關聯', color: '#9A9AA0', order: -1, updatedAt: SEED_TIME },
];
