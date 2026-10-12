import { defineAuth } from '@aws-amplify/backend';

// 以信箱＋密碼登入。是否開放自行註冊在 backend.ts 關掉，只有管理員建立的帳號能登入。
// 三個群組（加入群組在 Cognito 主控台操作：Users → 選人 → Add user to group）：
//   admin  管理員：全部功能，並且是唯一能修改待辦選項設定（分類、成員、優先級、狀態）的人
//   team   團隊成員：人脈記錄、待辦、產品進度
//   tech   技術端：只能存取產品進度，其他資料與照片伺服器都不給
// 權限由 AWS 伺服器強制執行（見 data/resource.ts 與 storage/resource.ts），畫面上只是配合隱藏。
// 沒有加入任何群組的帳號什麼資料都讀不到，所以每個人都要加進其中一個群組。
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['admin', 'team', 'tech'],
});
