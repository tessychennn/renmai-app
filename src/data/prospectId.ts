// 舊版的做法：被標記為合作對象的人會變成「業務開發」裡的一筆待辦，任務編號是 prospect-人物編號。
// 現在改成獨立的「客戶」頁（見 clientId.ts），這個檔案只用來認出舊的待辦，把它們搬成客戶紀錄（lib/clients.ts）。

const PROSPECT_PREFIX = 'prospect-';

export const prospectTaskId = (personId: string): string => PROSPECT_PREFIX + personId;

/** 任務對應的人物編號；不是合作對象的任務回傳 undefined */
export const personIdOfTask = (taskId: string): string | undefined =>
  taskId.startsWith(PROSPECT_PREFIX) ? taskId.slice(PROSPECT_PREFIX.length) : undefined;
