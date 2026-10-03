import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

// 兩個人共用同一份資料：任何登入的帳號都能讀寫全部（帳號池只有管理員建立的兩個人）。
// Amplify 會自動加上 createdAt / updatedAt（伺服器時間），所以 App 自己的時間戳
// 另存為 clientCreatedAt / clientUpdatedAt，同步比對新舊用的是後者。
const schema = a.schema({
  Person: a
    .model({
      displayName: a.string().required(),
      lineName: a.string(),
      avatarPhotoId: a.string(),
      photoIds: a.string().array().required(),
      groupIds: a.string().array().required(),
      occasion: a.string(),
      metDate: a.string(),
      note: a.string(),
      // 合作機會：用字串存，值的範圍由 App 端把關（之後加狀態不用動後端）
      collabStatus: a.string(),
      collabOwner: a.string(),
      collabNote: a.string(),
      clientCreatedAt: a.string().required(),
      clientUpdatedAt: a.string().required(),
      deletedAt: a.string(),
    })
    .authorization((allow) => [allow.authenticated()]),

  Group: a
    .model({
      name: a.string().required(),
      color: a.string().required(),
      order: a.integer().required(),
      clientUpdatedAt: a.string().required(),
      deletedAt: a.string(),
    })
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
