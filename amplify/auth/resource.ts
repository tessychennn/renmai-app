import { defineAuth } from '@aws-amplify/backend';

// 以信箱＋密碼登入。是否開放自行註冊在 backend.ts 關掉，只有管理員建立的帳號能進來。
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});
