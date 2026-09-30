import { defineStorage } from '@aws-amplify/backend';

// 照片放私人 bucket，只有登入的人讀得到。每張照片兩個檔：
//   photos/{id}/full.jpg  長邊 1600px 的完整版
//   photos/{id}/thumb.jpg 長邊 320px 的縮圖
export const storage = defineStorage({
  name: 'renmaiPhotos',
  access: (allow) => ({
    'photos/*': [allow.authenticated.to(['read', 'write', 'delete'])],
  }),
});
