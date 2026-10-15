// 客戶紀錄的編號：每個人最多一筆，由人物編號固定推出（兩支手機各自建立也是同一筆）。
// 單獨放一個檔案是因為資料層（data/index.ts）也要用，而 lib/clients.ts 又會引用資料層。

const CLIENT_PREFIX = 'client-';

export const clientIdOf = (personId: string): string => CLIENT_PREFIX + personId;
