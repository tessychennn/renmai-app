// 「業務開發」裡的合作對象：每個被標記的人對應一筆待辦任務，任務編號由人物編號固定推出。
// 好處：兩支手機各自建立也是同一筆（同步後不會重複）；不需要在雲端資料表多加欄位。

const PROSPECT_PREFIX = 'prospect-';

export const prospectTaskId = (personId: string): string => PROSPECT_PREFIX + personId;

/** 任務對應的人物編號；不是合作對象的任務回傳 undefined */
export const personIdOfTask = (taskId: string): string | undefined =>
  taskId.startsWith(PROSPECT_PREFIX) ? taskId.slice(PROSPECT_PREFIX.length) : undefined;
