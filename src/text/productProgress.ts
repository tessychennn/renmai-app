// ─────────────────────────────────────────────────────────────
// 「產品進度」頁的所有文字都在這個檔案，想改字就改這裡。
//
// 怎麼改：
//   1. 只改「引號裡面」的中文，其他符號（逗號、冒號、括號、大括號）不要動。
//   2. 存檔後在終端機執行 `npm run dev` 就能在瀏覽器預覽；確認沒問題再 commit、push。
//   3. 有 ${...} 的地方是會被換成實際內容的位置（例如項目名稱），整段 ${...} 要原樣保留，
//      但前後的字可以改、可以調整順序。
//
// 注意：每個選項的「value」是存進資料庫的代號，**不要改**，只改 label（顯示的字）和 hint（說明）。
// ─────────────────────────────────────────────────────────────

import type { StatusColor } from '../lib/statusTone';

export interface Choice<T extends string> {
  /** 存進資料庫的代號，不要改 */
  value: T;
  /** 標籤上顯示的字（要短） */
  label: string;
  /** 下拉選單裡的說明 */
  hint: string;
  /** 標籤的顏色：gray 灰、green 綠、yellow 黃、red 紅、purple 紫、blue 藍 */
  color: StatusColor;
}

/** 營運優先級：營運端決定，只表示對營運有多重要 */
export const OPS_PRIORITY_CHOICES = [
  { value: 'P0', label: 'P0', hint: '緊急：壞了或擋住營運，立刻處理', color: 'red' },
  { value: 'P1', label: 'P1', hint: '本月一定要做', color: 'yellow' },
  { value: 'P2', label: 'P2', hint: '排隊，有空檔就做', color: 'blue' },
  { value: 'P3', label: 'P3', hint: '想做但不急，或先擱著', color: 'gray' },
] as const satisfies readonly Choice<string>[];

/** 技術等級：技術端自己估的工作量 */
export const TECH_LEVEL_CHOICES = [
  { value: 'S', label: 'S', hint: '半天以內', color: 'green' },
  { value: 'M', label: 'M', hint: '1 到 3 天', color: 'yellow' },
  { value: 'L', label: 'L', hint: '1 到 2 週', color: 'red' },
  { value: 'XL', label: 'XL', hint: '兩週以上', color: 'purple' },
  { value: 'R', label: '需研究', hint: '還估不出來，要先研究', color: 'gray' },
] as const satisfies readonly Choice<string>[];

/** 進度狀態（由前到後）。「完成」會自動記錄完成日並移到完成頁籤 */
export const PROGRESS_STATUS_CHOICES = [
  { value: 'proposed', label: '提出', hint: '營運剛提出，技術端還沒看', color: 'gray' },
  { value: 'assessing', label: '評估中', hint: '技術端正在評估', color: 'purple' },
  { value: 'scheduled', label: '排程中', hint: '評估完，排進開發', color: 'yellow' },
  { value: 'building', label: '開發中', hint: '正在做', color: 'blue' },
  { value: 'testing', label: '測試中', hint: '做好了，在測試', color: 'green' },
  { value: 'done', label: '完成', hint: '已上線', color: 'gray' },
  { value: 'paused', label: '暫緩', hint: '先擱置', color: 'gray' },
] as const satisfies readonly Choice<string>[];

/**
 * 大項目（頁面上的一個個區塊，依這裡的順序排列）。
 * 想新增大項目：照格式多加一行，id 取一個沒用過的英文代號（例如 'proj-5'）。
 * 想改名：只改 name。已經有項目掛在底下的大項目，**id 不要改**，否則那些項目會找不到大項目。
 */
export const PROJECTS = [
  { id: 'opt-project-j0', name: 'WebApp 細節修改' },
  { id: 'opt-project-j1', name: 'App' },
  { id: 'opt-project-j2', name: '網頁' },
  { id: 'opt-project-j3', name: 'AI' },
] as const;

export const PROGRESS_TEXT = {
  /** 下方分頁列的名稱 */
  tabLabel: '產品進度',
  /** 頁面最上面的標題 */
  pageTitle: '產品進度',
  /** 頁面上方兩個切換鈕 */
  viewOpen: '進行中',
  viewDone: '完成',

  /** 篩選列 */
  allProjects: '所有大項目',
  sortLabel: '排序',
  sortOps: '營運優先',
  sortTech: '技術等級',
  sortDue: '目標日期',

  /** 每個區塊的欄位標題（手機上空間小，請盡量短） */
  colName: '項目',
  colOps: '營運',
  colTech: '技術',
  colStatus: '狀態',
  colDue: '目標日',

  /** 列表上方的摘要：進行中 3 項，待技術評估 1 項… */
  summaryOpen: '進行中',
  summaryNeedsAssessment: '待技術評估',
  summaryUrgent: 'P0 緊急',
  summaryOverdue: '逾期',
  summaryUnit: '項',

  /** 沒有資料時的提示 */
  emptyNone: '還沒有項目。按右下角的 + 新增第一個。',
  emptyFiltered: '這個篩選條件下沒有項目。',
  emptyOpen: '目前沒有進行中的項目。',
  emptyDone: '還沒有完成的項目。',
  orphanProject: '（大項目已刪除）',

  /** 下拉選單裡「沒有選」的選項 */
  unsetOps: '未設定',
  unsetTech: '未設定（技術端還沒評估）',

  /** 新增、編輯面板 */
  sheetAddTitle: '新增項目',
  sheetEditTitle: '編輯項目',
  fieldName: '項目名稱',
  fieldNamePlaceholder: '要改什麼、要做什麼',
  fieldProject: '大項目',
  fieldOps: '營運優先級',
  fieldTech: '技術等級',
  fieldStatus: '狀態',
  fieldDue: '目標日期',
  fieldOpsNote: '營運備註',
  fieldOpsNoteHint: '為什麼需要、希望達到什麼',
  fieldTechNote: '技術備註',
  fieldTechNoteHint: '做法、風險、卡在哪',
  buttonDelete: '刪除',
  buttonCancel: '取消',
  buttonAddAndContinue: '加入並繼續',
  buttonAdd: '加入',
  buttonSave: '儲存',
  errorNoName: '請輸入項目名稱',
  errorSaveFailed: '儲存失敗，請再試一次。',
  deletedOption: '（已刪除的選項）',

  /** 提示訊息。${name} 會換成項目名稱 */
  toastAdded: (name: string) => `已加入「${name}」`,
  toastDeleted: '已刪除',
  justAdded: (name: string) => `已加入「${name}」，可以繼續新增。`,
  confirmDeleteTitle: (name: string) => `刪除「${name}」？`,
  confirmDeleteMessage: '刪除後無法復原。',

  /** 給螢幕閱讀器與按鈕提示用的文字 */
  addButtonLabel: '新增項目',
  markDoneLabel: (name: string) => `完成「${name}」`,
  reopenLabel: (name: string) => `還原「${name}」到進行中`,
  hasNoteLabel: '有備註',
  ariaOps: (name: string) => `「${name}」的營運優先級`,
  ariaTech: (name: string) => `「${name}」的技術等級`,
  ariaStatus: (name: string) => `「${name}」的狀態`,
  ariaDue: (name: string) => `「${name}」的目標日期`,
} as const;
