import { defineStorage } from '@aws-amplify/backend';

// 照片放私人 bucket，只有登入的人讀得到。每張照片兩個檔：
//   photos/{id}/full.jpg  長邊 1600px 的完整版
//   photos/{id}/thumb.jpg 長邊 320px 的縮圖
//
// 屬於 admin 群組的人，Cognito 會改用「群組角色」發放憑證，不再套用一般登入者的權限，
// 所以群組也要各自授權，否則管理員會讀不到任何照片（AccessDenied）。
export const storage = defineStorage({
  name: 'renmaiPhotos',
  access: (allow) => ({
    'photos/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['admin']).to(['read', 'write', 'delete']),
    ],
  }),
});
