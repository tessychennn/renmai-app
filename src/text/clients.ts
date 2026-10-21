// ─────────────────────────────────────────────────────────────
// 「客戶」頁的狀態清單（也是人物卡上標籤與長按選單的選項），以及客戶的「等級」清單。
//
// 想改狀態的名稱：只改引號裡面的 name（例如把「後續處理」改成別的字）。
// 想改順序：調整每一行的位置；列表上的篩選鈕、下拉選單都依這個順序。
// 想改顏色：改 color，可以用 gray 灰、green 綠、yellow 黃、red 紅、purple 紫、blue 藍。
// 想新增狀態：照格式多加一行，id 取一個沒用過的英文代號（例如 'signed'）。
//
// 注意：id 是存進資料庫的代號，**已經有客戶用到的狀態不要改 id**，否則那些客戶會變成「未設定」。
// 存檔後在終端機執行 `npm run dev` 可以預覽，確認沒問題再 commit、push。
// ─────────────────────────────────────────────────────────────

import type { StatusColor } from '../lib/statusTone';

export interface ClientStatus {
  id: string;
  name: string;
  color: StatusColor;
}

/** 客戶的等級（輕重緩急）。**排在前面的越重要**：依「重要等級」排序時，排越前面的客戶越上面。 */
export const CLIENT_LEVELS: readonly ClientStatus[] = [
  { id: 'important', name: '重要', color: 'yellow' },
  { id: 'potential', name: '潛在', color: 'gray' },
];

export const CLIENT_STATUSES: readonly ClientStatus[] = [
  { id: 'need-contact', name: '需聯繫', color: 'red' },
  { id: 'contacting', name: '聯繫中', color: 'purple' },
  { id: 'agreed', name: '答應加入', color: 'green' },
  { id: 'follow-up', name: '後續處理', color: 'blue' },
];
