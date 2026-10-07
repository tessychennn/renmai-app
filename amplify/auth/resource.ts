import { defineAuth } from '@aws-amplify/backend';

// 以信箱＋密碼登入。是否開放自行註冊在 backend.ts 關掉，只有管理員建立的帳號能登入。
// admin 群組：待辦的選項設定（分類、成員、優先級、狀態）只有群組成員能修改，
// 由 AWS 伺服器強制執行。加入群組在 Cognito 主控台操作（Users → 選人 → Add user to group）。
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['admin'],
});
